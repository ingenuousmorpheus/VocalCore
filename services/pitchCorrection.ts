/**
 * VocalCore Pitch Correction Engine
 *
 * Takes a pitch track and corrects the audio signal to snap to the nearest
 * musical note using TD-PSOLA (Time-Domain Pitch-Synchronous Overlap-Add).
 *
 * Parameters:
 * - retuneSpeed: 0-100ms — how fast pitch snaps to target (0 = instant/robotic)
 * - humanize: 0-100% — adds natural variation back after correction
 * - tuneAmount: 0-100% — blend between original and corrected signal
 */

import {
  PitchFrame,
  PitchTrack,
  detectPitch,
  smoothPitchTrack,
  frequencyToMidi,
  midiToFrequency,
} from './pitchDetection';

export interface CorrectionParams {
  /** 0-100ms, how fast pitch converges to target note */
  retuneSpeed: number;
  /** 0-100%, natural variation added back */
  humanize: number;
  /** 0-100%, wet/dry blend of corrected signal */
  tuneAmount: number;
}

/**
 * Compute the target (corrected) frequency for each frame.
 * Applies retune speed smoothing and humanize jitter.
 */
function computeTargetPitches(
  frames: PitchFrame[],
  sampleRate: number,
  hopSize: number,
  params: CorrectionParams
): number[] {
  const targets: number[] = new Array(frames.length);
  const hopDuration = hopSize / sampleRate; // seconds per frame

  // Retune speed as a time constant (0ms = instant, 100ms = very slow correction)
  // Convert to a per-frame smoothing coefficient
  const retuneTimeSec = params.retuneSpeed / 1000;
  const alpha = retuneTimeSec > 0
    ? 1 - Math.exp(-hopDuration / retuneTimeSec)
    : 1.0; // instant correction when retuneSpeed = 0

  // Humanize: random walk seeded per-frame for reproducibility
  const humanizeAmount = params.humanize / 100;
  // Max pitch deviation from humanize in cents
  const maxHumanizeCents = humanizeAmount * 30; // up to 30 cents deviation at 100%

  // Slow LFO-style humanize (natural vibrato-like)
  const vibratoRate = 4.5 + humanizeAmount * 2; // 4.5-6.5 Hz
  const vibratoDepth = humanizeAmount * 15; // up to 15 cents

  let currentCorrectedMidi = 0;
  let initialized = false;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    if (!frame.voiced || frame.frequency <= 0) {
      targets[i] = 0; // unvoiced — no correction
      continue;
    }

    const originalMidi = frequencyToMidi(frame.frequency);
    const targetMidi = Math.round(originalMidi); // nearest semitone

    if (!initialized) {
      currentCorrectedMidi = targetMidi;
      initialized = true;
    }

    // Smoothly converge to target note based on retune speed
    currentCorrectedMidi += alpha * (targetMidi - currentCorrectedMidi);

    // Apply humanize: add back controlled pitch variation
    let humanizedMidi = currentCorrectedMidi;
    if (humanizeAmount > 0) {
      // Slow vibrato component
      const vibrato = Math.sin(2 * Math.PI * vibratoRate * frame.time) * vibratoDepth / 100;
      // Random drift component (seeded by frame index for consistency)
      const drift = (Math.sin(i * 0.1) * Math.cos(i * 0.037)) * maxHumanizeCents / 100;
      humanizedMidi += vibrato + drift;
    }

    targets[i] = midiToFrequency(humanizedMidi);
  }

  return targets;
}

/**
 * Find pitch-synchronous marks (peaks) in the signal for PSOLA.
 * These mark the start of each glottal pulse period.
 */
function findPitchMarks(
  signal: Float32Array,
  frames: PitchFrame[],
  sampleRate: number,
  hopSize: number
): number[] {
  const marks: number[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame.voiced || frame.frequency <= 0) continue;

    const period = Math.round(sampleRate / frame.frequency);
    const frameStart = i * hopSize;
    const frameEnd = Math.min(frameStart + hopSize, signal.length);

    // Find the highest peak in this frame region as anchor
    if (marks.length === 0) {
      let maxVal = -Infinity;
      let maxIdx = frameStart;
      for (let j = frameStart; j < Math.min(frameStart + period, signal.length); j++) {
        if (Math.abs(signal[j]) > maxVal) {
          maxVal = Math.abs(signal[j]);
          maxIdx = j;
        }
      }
      marks.push(maxIdx);
    }

    // Place marks at pitch-period intervals from last mark
    const lastMark = marks[marks.length - 1];
    if (lastMark + period < frameEnd + period) {
      let nextMark = lastMark + period;
      while (nextMark < frameEnd && nextMark < signal.length) {
        // Refine: search for nearest peak within ±period/4
        const searchRadius = Math.floor(period / 4);
        let bestPos = nextMark;
        let bestVal = -Infinity;
        for (
          let j = Math.max(0, nextMark - searchRadius);
          j < Math.min(signal.length, nextMark + searchRadius);
          j++
        ) {
          if (Math.abs(signal[j]) > bestVal) {
            bestVal = Math.abs(signal[j]);
            bestPos = j;
          }
        }
        marks.push(bestPos);
        nextMark = bestPos + period;
      }
    }
  }

  return marks;
}

/**
 * TD-PSOLA: Pitch-shift by resampling overlap-add grains at pitch marks.
 *
 * For each output pitch mark (placed at the target pitch period),
 * we extract a Hanning-windowed grain from the input centered at the
 * nearest analysis pitch mark, then overlap-add.
 */
function psolaShift(
  signal: Float32Array,
  pitchMarks: number[],
  frames: PitchFrame[],
  targetFreqs: number[],
  sampleRate: number,
  hopSize: number
): Float32Array {
  const output = new Float32Array(signal.length);
  const envelope = new Float32Array(signal.length); // for normalization

  if (pitchMarks.length < 2) {
    // Not enough marks; return original
    output.set(signal);
    return output;
  }

  // Build a map: for each sample position, what frame index is it?
  const getFrameIndex = (samplePos: number) => {
    return Math.min(frames.length - 1, Math.max(0, Math.floor(samplePos / hopSize)));
  };

  // Generate output pitch marks at target frequencies
  const outputMarks: number[] = [pitchMarks[0]];
  let inputMarkIdx = 0;

  let pos = pitchMarks[0];
  while (pos < signal.length) {
    const frameIdx = getFrameIndex(pos);
    const targetFreq = targetFreqs[frameIdx];

    if (!targetFreq || targetFreq <= 0) {
      // Unvoiced region: copy through without pitch modification
      pos += hopSize;
      continue;
    }

    const targetPeriod = sampleRate / targetFreq;
    pos += targetPeriod;

    if (pos < signal.length) {
      outputMarks.push(Math.round(pos));
    }
  }

  // For each output mark, find the nearest input mark and extract+place a grain
  for (let i = 0; i < outputMarks.length; i++) {
    const outPos = outputMarks[i];

    // Find nearest input pitch mark
    let nearestInputMark = pitchMarks[0];
    let minDist = Math.abs(outPos - pitchMarks[0]);
    // Binary-style search since marks are sorted
    for (let j = inputMarkIdx; j < pitchMarks.length; j++) {
      const dist = Math.abs(outPos - pitchMarks[j]);
      if (dist < minDist) {
        minDist = dist;
        nearestInputMark = pitchMarks[j];
        inputMarkIdx = j;
      } else if (dist > minDist) {
        break; // Past the minimum
      }
    }

    // Determine grain size from original pitch period
    const frameIdx = getFrameIndex(nearestInputMark);
    const origFreq = frames[frameIdx]?.frequency;
    if (!origFreq || origFreq <= 0) continue;

    const origPeriod = Math.round(sampleRate / origFreq);
    const grainSize = origPeriod * 2; // Two periods for smooth overlap
    const halfGrain = grainSize / 2;

    // Extract grain centered at input mark with Hanning window
    for (let j = -Math.floor(halfGrain); j < Math.ceil(halfGrain); j++) {
      const inIdx = nearestInputMark + j;
      const outIdx = outPos + j;

      if (inIdx < 0 || inIdx >= signal.length) continue;
      if (outIdx < 0 || outIdx >= signal.length) continue;

      // Hanning window
      const t = (j + halfGrain) / grainSize;
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * t));

      output[outIdx] += signal[inIdx] * window;
      envelope[outIdx] += window;
    }
  }

  // Normalize by overlap envelope to prevent amplitude modulation
  for (let i = 0; i < output.length; i++) {
    if (envelope[i] > 0.001) {
      output[i] /= envelope[i];
    } else {
      output[i] = signal[i]; // Fallback to original in gaps
    }
  }

  return output;
}

/**
 * Main pitch correction function.
 *
 * Takes raw audio samples and returns corrected audio.
 *
 * @param inputSignal - Mono audio samples (Float32Array)
 * @param sampleRate - Sample rate in Hz
 * @param params - Correction parameters (retuneSpeed, humanize, tuneAmount)
 * @returns Corrected audio samples
 */
export function correctPitch(
  inputSignal: Float32Array,
  sampleRate: number,
  params: CorrectionParams
): Float32Array {
  // If tuneAmount is 0, return original unmodified
  if (params.tuneAmount <= 0) {
    return new Float32Array(inputSignal);
  }

  const hopSize = 256;
  const windowSize = 2048;

  // Step 1: Detect pitch using YIN
  const pitchTrack = detectPitch(inputSignal, sampleRate, hopSize, windowSize);

  // Step 2: Smooth pitch track (remove octave jumps)
  const smoothedFrames = smoothPitchTrack(pitchTrack);

  // Step 3: Compute target (corrected) frequencies
  const targetFreqs = computeTargetPitches(
    smoothedFrames,
    sampleRate,
    hopSize,
    params
  );

  // Step 4: Find pitch-synchronous marks in the original signal
  const pitchMarks = findPitchMarks(inputSignal, smoothedFrames, sampleRate, hopSize);

  // Step 5: Apply TD-PSOLA pitch shifting
  const corrected = psolaShift(
    inputSignal,
    pitchMarks,
    smoothedFrames,
    targetFreqs,
    sampleRate,
    hopSize
  );

  // Step 6: Wet/dry mix based on tuneAmount
  const wetAmount = params.tuneAmount / 100;
  const dryAmount = 1 - wetAmount;
  const output = new Float32Array(inputSignal.length);

  for (let i = 0; i < output.length; i++) {
    output[i] = corrected[i] * wetAmount + inputSignal[i] * dryAmount;
  }

  return output;
}

/**
 * Hard-tune mode for T-Pain/robotic effect.
 * Instant pitch quantization with no smoothing.
 * Uses aggressive PSOLA with zero retune speed.
 */
export function hardTune(
  inputSignal: Float32Array,
  sampleRate: number
): Float32Array {
  return correctPitch(inputSignal, sampleRate, {
    retuneSpeed: 0,
    humanize: 0,
    tuneAmount: 100,
  });
}
