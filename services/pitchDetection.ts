/**
 * VocalCore Pitch Detection Engine
 *
 * Implements the YIN algorithm for robust fundamental frequency (F0) detection.
 * Based on: de Cheveigné, A. & Kawahara, H. (2002) "YIN, a fundamental frequency estimator for speech and music"
 */

/** Musical note frequencies (A4 = 440Hz, equal temperament) */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface PitchFrame {
  /** Time in seconds */
  time: number;
  /** Detected frequency in Hz, 0 if unvoiced */
  frequency: number;
  /** Confidence 0-1 (lower YIN threshold = higher confidence) */
  confidence: number;
  /** Nearest MIDI note number */
  midiNote: number;
  /** Cents deviation from nearest note (-50 to +50) */
  centsOff: number;
  /** Note name e.g. "A4" */
  noteName: string;
  /** Whether this frame is considered voiced */
  voiced: boolean;
}

export interface PitchTrack {
  frames: PitchFrame[];
  sampleRate: number;
  hopSize: number;
  /** Median pitch across voiced frames */
  medianPitch: number;
}

/**
 * Convert frequency to MIDI note number (fractional)
 * A4 (440Hz) = MIDI 69
 */
export function frequencyToMidi(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Convert MIDI note number to frequency
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Get the note name for a MIDI number
 */
export function midiToNoteName(midi: number): string {
  const roundedMidi = Math.round(midi);
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteIndex = roundedMidi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Get cents deviation from nearest semitone
 */
export function getCentsOff(midi: number): number {
  return (midi - Math.round(midi)) * 100;
}

/**
 * YIN pitch detection algorithm
 *
 * @param signal - Audio samples (mono Float32Array)
 * @param sampleRate - Sample rate in Hz
 * @param hopSize - Hop size in samples (default: 256 for ~5.8ms at 44.1kHz)
 * @param windowSize - Analysis window in samples (default: 2048 for ~46ms at 44.1kHz)
 * @param threshold - YIN threshold (default: 0.15, lower = stricter)
 * @param minFreq - Minimum detectable frequency (default: 60Hz)
 * @param maxFreq - Maximum detectable frequency (default: 1200Hz)
 */
export function detectPitch(
  signal: Float32Array,
  sampleRate: number,
  hopSize: number = 256,
  windowSize: number = 2048,
  threshold: number = 0.15,
  minFreq: number = 60,
  maxFreq: number = 1200
): PitchTrack {
  const frames: PitchFrame[] = [];
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.ceil(sampleRate / minFreq);
  const halfWindow = Math.floor(windowSize / 2);

  for (let center = 0; center + windowSize < signal.length; center += hopSize) {
    const time = center / sampleRate;

    // Step 1: Difference function d(tau)
    const diff = new Float32Array(halfWindow);
    for (let tau = 0; tau < halfWindow; tau++) {
      let sum = 0;
      for (let j = 0; j < halfWindow; j++) {
        const delta = signal[center + j] - signal[center + j + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Step 2: Cumulative mean normalized difference function d'(tau)
    const cmndf = new Float32Array(halfWindow);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfWindow; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = diff[tau] * tau / runningSum;
    }

    // Step 3: Absolute threshold — find first tau where cmndf dips below threshold
    let bestTau = -1;
    let bestVal = 1;

    const searchMin = Math.max(minPeriod, 2);
    const searchMax = Math.min(maxPeriod, halfWindow - 1);

    for (let tau = searchMin; tau < searchMax; tau++) {
      if (cmndf[tau] < threshold) {
        // Walk to the local minimum
        while (tau + 1 < searchMax && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        bestTau = tau;
        bestVal = cmndf[tau];
        break;
      }
    }

    // If no dip below threshold, find global minimum
    if (bestTau < 0) {
      for (let tau = searchMin; tau < searchMax; tau++) {
        if (cmndf[tau] < bestVal) {
          bestVal = cmndf[tau];
          bestTau = tau;
        }
      }
    }

    // Step 4: Parabolic interpolation for sub-sample accuracy
    let refinedTau = bestTau;
    if (bestTau > 0 && bestTau < halfWindow - 1) {
      const s0 = cmndf[bestTau - 1];
      const s1 = cmndf[bestTau];
      const s2 = cmndf[bestTau + 1];
      const adjustment = (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
      if (Math.abs(adjustment) < 1) {
        refinedTau = bestTau + adjustment;
      }
    }

    const voiced = bestVal < threshold * 2;
    const frequency = voiced && refinedTau > 0 ? sampleRate / refinedTau : 0;
    const midi = frequencyToMidi(frequency);
    const confidence = voiced ? 1 - bestVal : 0;

    frames.push({
      time,
      frequency,
      confidence,
      midiNote: Math.round(midi),
      centsOff: getCentsOff(midi),
      noteName: frequency > 0 ? midiToNoteName(midi) : '-',
      voiced,
    });
  }

  // Calculate median pitch of voiced frames
  const voicedFreqs = frames.filter(f => f.voiced).map(f => f.frequency).sort((a, b) => a - b);
  const medianPitch = voicedFreqs.length > 0
    ? voicedFreqs[Math.floor(voicedFreqs.length / 2)]
    : 0;

  return { frames, sampleRate, hopSize, medianPitch };
}

/**
 * Smooth a pitch track to remove octave jumps and jitter
 */
export function smoothPitchTrack(track: PitchTrack, medianWindowSize: number = 5): PitchFrame[] {
  const frames = [...track.frames];

  // Median filter to remove octave jumps
  for (let i = 0; i < frames.length; i++) {
    if (!frames[i].voiced) continue;

    const neighborhood: number[] = [];
    const halfWin = Math.floor(medianWindowSize / 2);
    for (let j = Math.max(0, i - halfWin); j <= Math.min(frames.length - 1, i + halfWin); j++) {
      if (frames[j].voiced) {
        neighborhood.push(frames[j].frequency);
      }
    }

    if (neighborhood.length >= 3) {
      neighborhood.sort((a, b) => a - b);
      const medianFreq = neighborhood[Math.floor(neighborhood.length / 2)];

      // If current pitch is more than ~6 semitones from neighborhood median, correct it
      const ratio = frames[i].frequency / medianFreq;
      if (ratio > 1.5) {
        frames[i].frequency /= 2; // Octave down
      } else if (ratio < 0.67) {
        frames[i].frequency *= 2; // Octave up
      }

      // Update derived values
      const midi = frequencyToMidi(frames[i].frequency);
      frames[i].midiNote = Math.round(midi);
      frames[i].centsOff = getCentsOff(midi);
      frames[i].noteName = midiToNoteName(midi);
    }
  }

  return frames;
}
