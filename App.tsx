
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { ViewMode, ProcessingState, CloneState, AudioAnalysis } from './types';
import { AutoView } from './components/AutoView';
import { ExpertView } from './components/ExpertView';
import { CloneView } from './components/CloneView';
import { analyzeAudioCharacteristics } from './services/geminiService';

const DEFAULT_ANALYSIS: AudioAnalysis = {
  genre: "Vocal",
  key: "C Major",
  bpm: 120,
  qualityScore: 8,
  vocalType: "Lead",
  detectedGender: "Neutral",
  issues: [],
  metrics: { lufs: -14, peak: -0.1, dynamicRange: 8 },
  suggestedParameters: {
    intensity: 75,
    tuneAmount: 0,
    compression: 40,
    reverb: 20,
    deNoise: 10,
    deRoom: 5,
    deEss: 30,
    comp2: 20,
    limit: 95,
    air: 30,
    body: 30,
    saturate: 10,
    revSize: 50,
    revDecay: 40,
    revMix: 15,
    delay: 15,
    autoEq: 50,
    retuneSpeed: 20,
    humanize: 40,
    breathe: 15
  }
};

function wrapPcmInWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmData.length, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmData.length, true);
  return new Blob([header, pcmData], { type: 'audio/wav' });
}

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.AUTO);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micProfile, setMicProfile] = useState<'Vintage Tube' | 'Modern Condenser'>('Modern Condenser');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  
  const [state, setState] = useState<ProcessingState>({
    isAnalyzing: false,
    isProcessing: false,
    isRenderingExpert: false,
    expertResultUrl: null,
    renderStep: "",
    progress: 0,
    analysis: null,
  });

  const [cloneState, setCloneState] = useState<CloneState>({
    referenceVoice: null,
    referenceUrl: null,
    targetFile: null,
    targetUrl: null,
    inputText: "Experience the perfected studio-grade vocal synthesis.",
    isGenerating: false,
    processingStep: "",
    resultAudioUrl: null,
    formant: 0,
    stability: 85,
    similarity: 95,
    variance: 45,
    breathiness: 15
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const saturatorRef = useRef<WaveShaperNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayFeedbackRef = useRef<GainNode | null>(null);
  const eqRef = useRef<BiquadFilterNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const makeDistortionCurve = useCallback((amount: number) => {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const k = amount;
    for (let i = 0; i < n_samples; ++i) {
      const normalizedX = (i * 2) / n_samples - 1;
      if (k === 0) {
        curve[i] = normalizedX;
      } else {
        curve[i] = ((1 + k) * normalizedX) / (1 + k * Math.abs(normalizedX));
      }
    }
    return curve;
  }, []);

  const initAudioEngine = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    
    const ctx = audioContextRef.current;

    if (!sourceNodeRef.current && audioRef.current) {
      sourceNodeRef.current = ctx.createMediaElementSource(audioRef.current);
      
      const saturator = ctx.createWaveShaper();
      saturator.curve = makeDistortionCurve(0);
      saturator.oversample = '4x';
      saturatorRef.current = saturator;

      const eq = ctx.createBiquadFilter();
      eq.type = 'highshelf';
      eq.frequency.value = 8000;
      eq.gain.value = 0;
      eqRef.current = eq;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.3;
      delayNodeRef.current = delay;

      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0;
      delayFeedbackRef.current = delayFeedback;
      
      const master = ctx.createGain();
      const currentIntensity = state.analysis?.suggestedParameters.intensity ?? DEFAULT_ANALYSIS.suggestedParameters.intensity;
      master.gain.value = (currentIntensity / 100) * 2; 
      masterGainRef.current = master;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -0.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      limiterRef.current = limiter;
      
      sourceNodeRef.current.connect(saturator);
      saturator.connect(eq);
      
      eq.connect(delay);
      delay.connect(delayFeedback);
      delayFeedback.connect(delay); 
      delayFeedback.connect(master);

      eq.connect(master);
      master.connect(limiter);
      limiter.connect(ctx.destination);
    }
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }, [makeDistortionCurve, state.analysis]);

  const handleApplyTPain = () => {
    const updates = {
      retuneSpeed: 0,
      humanize: 0,
      tuneAmount: 100,
      intensity: 98,
      saturate: 40,
      autoEq: 85,
    };

    setState(prev => ({
      ...prev,
      analysis: {
        ...(prev.analysis || DEFAULT_ANALYSIS),
        suggestedParameters: {
          ...(prev.analysis || DEFAULT_ANALYSIS).suggestedParameters,
          ...updates
        }
      }
    }));

    // Explicitly sync audio nodes for real-time changes
    const ctx = audioContextRef.current;
    if (ctx) {
      masterGainRef.current?.gain.setTargetAtTime((98 / 100) * 3.5, ctx.currentTime, 0.1);
      if (saturatorRef.current) saturatorRef.current.curve = makeDistortionCurve(40 / 15);
      eqRef.current?.gain.setTargetAtTime((85 - 50) * 0.4, ctx.currentTime, 0.1);
    }
  };

  const handleApplyDrake = () => {
    const updates = {
      retuneSpeed: 15,
      humanize: 80,
      tuneAmount: 88,
      intensity: 85,
      reverb: 55,
      delay: 35,
      autoEq: 65,
      saturate: 10,
      revMix: 25,
      revSize: 70
    };

    setState(prev => ({
      ...prev,
      analysis: {
        ...(prev.analysis || DEFAULT_ANALYSIS),
        suggestedParameters: {
          ...(prev.analysis || DEFAULT_ANALYSIS).suggestedParameters,
          ...updates
        }
      }
    }));

    const ctx = audioContextRef.current;
    if (ctx) {
      masterGainRef.current?.gain.setTargetAtTime((85 / 100) * 3.5, ctx.currentTime, 0.1);
      if (saturatorRef.current) saturatorRef.current.curve = makeDistortionCurve(10 / 15);
      eqRef.current?.gain.setTargetAtTime((65 - 50) * 0.4, ctx.currentTime, 0.1);
      delayFeedbackRef.current?.gain.setTargetAtTime((35 / 100) * 0.6, ctx.currentTime, 0.1);
    }
  };

  const runAnalysis = useCallback(async (file: File | Blob) => {
    setState(p => ({ ...p, isAnalyzing: true }));
    try {
      const fileName = (file instanceof File) ? file.name : 'recording.wav';
      const res = await analyzeAudioCharacteristics(fileName, file.size);
      setState(p => ({ ...p, isAnalyzing: false, analysis: res }));
      
      if (masterGainRef.current && audioContextRef.current) {
        const targetGain = (res.suggestedParameters.intensity / 100) * 2.5; 
        masterGainRef.current.gain.setTargetAtTime(targetGain, audioContextRef.current.currentTime, 0.1);
      }
    } catch (e) {
      console.error("Analysis failed:", e);
      setState(p => ({ ...p, isAnalyzing: false }));
    }
  }, []);

  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        initAudioEngine();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          const file = new File([blob], "recording.wav", { type: "audio/wav" });
          
          setAudioFile(file);
          setAudioUrl(url);
          setIsPlaying(false);
          setPlaybackProgress(0);
          setState(prev => ({ ...prev, analysis: null, expertResultUrl: null }));
          runAnalysis(file);
          
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Recording failed:", err);
      }
    }
  };

  const performOfflineBounce = async () => {
    if (!audioFile) return null;
    
    const params = state.analysis?.suggestedParameters || DEFAULT_ANALYSIS.suggestedParameters;
    const arrayBuffer = await audioFile.arrayBuffer();
    const baseAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const decodedBuffer = await baseAudioContext.decodeAudioData(arrayBuffer);
    
    const offlineCtx = new OfflineAudioContext(
      decodedBuffer.numberOfChannels,
      decodedBuffer.length,
      decodedBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;

    // Simulate robotic pitch quantizing if retuneSpeed is 0
    if (params.retuneSpeed === 0) {
      const data = decodedBuffer.getChannelData(0);
      const windowSize = 512; // Robotic steps
      for (let i = 0; i < data.length; i += windowSize) {
        let sum = 0;
        for (let j = 0; j < windowSize && i + j < data.length; j++) {
          sum += data[i + j];
        }
        const avg = sum / windowSize;
        for (let j = 0; j < windowSize && i + j < data.length; j++) {
           // Slightly quantize the waveform for a 'bit-crushed' robotic feel
           data[i+j] = avg * 0.7 + data[i+j] * 0.3;
        }
      }
    }

    const eq = offlineCtx.createBiquadFilter();
    eq.type = 'highshelf';
    eq.frequency.setValueAtTime(8000, offlineCtx.currentTime);
    const eqGain = (params.autoEq - 50) * 0.4 + (micProfile === 'Vintage Tube' ? 5 : 0);
    eq.gain.setValueAtTime(eqGain, offlineCtx.currentTime);

    const breatheGain = offlineCtx.createGain();
    breatheGain.gain.setValueAtTime((params.breathe / 100) * 0.15, offlineCtx.currentTime);
    const noiseBuffer = offlineCtx.createBuffer(1, decodedBuffer.length, decodedBuffer.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < decodedBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noiseSource = offlineCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = offlineCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(10000, offlineCtx.currentTime);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(breatheGain);

    const saturator = offlineCtx.createWaveShaper();
    const curveAmount = params.retuneSpeed === 0 ? (params.saturate / 8) : (params.saturate / 15);
    saturator.curve = makeDistortionCurve(curveAmount);
    saturator.oversample = '4x';

    const limiter = offlineCtx.createDynamicsCompressor();
    const thresholdVal = -35 + (100 - params.compression) * 0.4;
    limiter.threshold.setValueAtTime(thresholdVal, offlineCtx.currentTime);
    limiter.ratio.setValueAtTime(12, offlineCtx.currentTime);
    limiter.attack.setValueAtTime(0.003, offlineCtx.currentTime);
    limiter.release.setValueAtTime(0.25, offlineCtx.currentTime);

    const master = offlineCtx.createGain();
    const masterGain = Math.max(0.1, (params.intensity / 100) * 2.8);
    master.gain.setValueAtTime(masterGain, offlineCtx.currentTime);

    const delay = offlineCtx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.3, offlineCtx.currentTime);
    const feedback = offlineCtx.createGain();
    const fbGain = (params.delay / 100) * 0.55;
    feedback.gain.setValueAtTime(fbGain, offlineCtx.currentTime);

    source.connect(saturator);
    saturator.connect(eq);
    eq.connect(master);
    eq.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.connect(master);
    
    breatheGain.connect(master);

    master.connect(limiter);
    limiter.connect(offlineCtx.destination);

    source.start(0);
    noiseSource.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    await baseAudioContext.close();
    
    return await audioBufferToWavBlob(renderedBuffer);
  };

  const handleDownloadResult = async () => {
    setState(prev => ({ ...prev, isProcessing: true, renderStep: "Exporting..." }));
    try {
      let blob: Blob | null = null;
      if (state.expertResultUrl) {
        const response = await fetch(state.expertResultUrl);
        blob = await response.blob();
      } else {
        blob = await performOfflineBounce();
      }

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VocalCore_Titan_Render_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleRenderExpert = async () => {
    if (!audioFile) return;
    setState(prev => ({ ...prev, isRenderingExpert: true, renderStep: "Neural Prep..." }));
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const params = state.analysis?.suggestedParameters || DEFAULT_ANALYSIS.suggestedParameters;
      const isTPain = params.retuneSpeed === 0;
      
      await ai.models.generateContent({
        model: "gemini-3-flash-preview", 
        contents: `AI MASTERING START: Applying ${micProfile} character. Mode: ${isTPain ? 'ULTRA-HARD T-PAIN ROBOTIC AUTO-TUNE' : 'NATURAL'}. Key: ${state.analysis?.key}. Retune Speed: ${params.retuneSpeed}ms. Humanize: ${params.humanize}%. Generate a high-fidelity vocal with extreme robotic character if in T-Pain mode.`,
      });

      setState(prev => ({ ...prev, renderStep: "DSP Rendering..." }));

      const wavBlob = await performOfflineBounce();
      if (wavBlob) {
        const url = URL.createObjectURL(wavBlob);
        setState(prev => ({ 
          ...prev, 
          isRenderingExpert: false, 
          expertResultUrl: url, 
          renderStep: "Finalized" 
        }));
        setAudioUrl(url);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Mastering failed:", error);
      setState(prev => ({ ...prev, isRenderingExpert: false, renderStep: "DSP Error" }));
    }
  };

  async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
    const workerCode = `
      self.onmessage = function(e) {
        const { channelData, sampleRate } = e.data;
        const length = channelData.length * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        
        view.setUint32(0, 0x52494646, false);
        view.setUint32(4, length - 8, true);
        view.setUint32(8, 0x57415645, false);
        view.setUint32(12, 0x666d7420, false);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false);
        view.setUint32(40, length - 44, true);
        
        let offset = 44;
        for (let i = 0; i < channelData.length; i++) {
          let s = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          offset += 2;
        }
        
        self.postMessage(buffer, [buffer]);
      }
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    
    return new Promise((resolve) => {
      worker.onmessage = (e) => {
        resolve(new Blob([e.data], { type: 'audio/wav' }));
        worker.terminate();
        URL.revokeObjectURL(url);
      };
      worker.postMessage({ 
        channelData: buffer.getChannelData(0), 
        sampleRate: buffer.sampleRate 
      });
    });
  }

  const handleGenerateClone = async (perfected: boolean = true) => {
    if (!cloneState.referenceVoice) return;
    setCloneState(prev => ({ ...prev, isGenerating: true, processingStep: "Neural Synthesis...", resultAudioUrl: null }));

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Ref = await blobToBase64(cloneState.referenceVoice);
      const prompt = `CLONE ENGINE INFERENCE: Synthesize text: "${cloneState.inputText}". Match timbre of reference.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ inlineData: { mimeType: cloneState.referenceVoice.type, data: base64Ref } }, { text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        },
      });
      const outputPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const outputBase64 = outputPart?.inlineData?.data;
      if (outputBase64) {
        const binaryString = atob(outputBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const wavBlob = wrapPcmInWav(bytes, 24000);
        setCloneState(prev => ({ ...prev, isGenerating: false, resultAudioUrl: URL.createObjectURL(wavBlob), processingStep: "Complete" }));
      }
    } catch (error) {
      setCloneState(prev => ({ ...prev, isGenerating: false, processingStep: "Inference Error" }));
    }
  };

  const handleControlChange = (key: string, val: number) => {
    setState(prev => {
      const baseAnalysis = prev.analysis || DEFAULT_ANALYSIS;
      return { ...prev, analysis: { ...baseAnalysis, suggestedParameters: { ...baseAnalysis.suggestedParameters, [key]: val } } };
    });
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (key === 'saturate' && saturatorRef.current) saturatorRef.current.curve = makeDistortionCurve(val / 15);
    if (key === 'intensity' && masterGainRef.current) masterGainRef.current.gain.setTargetAtTime((val / 100) * 3.5, ctx.currentTime, 0.1);
    if (key === 'autoEq' && eqRef.current) eqRef.current.gain.setTargetAtTime((val - 50) * 0.4, ctx.currentTime, 0.1);
    if (key === 'delay' && delayFeedbackRef.current) delayFeedbackRef.current.gain.setTargetAtTime((val / 100) * 0.6, ctx.currentTime, 0.1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(file);
      setAudioUrl(url);
      setIsPlaying(false);
      setPlaybackProgress(0);
      setState(prev => ({ ...prev, analysis: null, expertResultUrl: null }));
      runAnalysis(file);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => setPlaybackProgress(audio.currentTime / audio.duration || 0);
    audio.addEventListener('timeupdate', updateProgress);
    if (isPlaying) { initAudioEngine(); audio.play().catch(() => setIsPlaying(false)); } 
    else { audio.pause(); }
    return () => audio.removeEventListener('timeupdate', updateProgress);
  }, [isPlaying, audioUrl, initAudioEngine]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 selection:bg-cyan-500/30">
      <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />
      <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} className="hidden" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>
      <main className="relative max-w-5xl mx-auto px-6 py-12 flex flex-col gap-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">VocalCore <span className="text-cyan-500">Titan</span></h1>
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Pristine Neural DSP Chain v6.2.0</p>
            </div>
          </div>
          <nav className="flex bg-slate-900/50 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
            {[ViewMode.AUTO, ViewMode.EXPERT, ViewMode.CLONE].map((tab) => (
              <button key={tab} onClick={() => setViewMode(tab)} className={`px-6 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${viewMode === tab ? 'bg-white/10 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>{tab}</button>
            ))}
          </nav>
        </header>
        <div className="flex-1 bg-slate-900/20 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
          {viewMode === ViewMode.AUTO && (
            <AutoView state={state} audioFile={audioFile} isPlaying={isPlaying} isRecording={isRecording} audioUrl={audioUrl} progress={playbackProgress} onControlChange={handleControlChange} onAnalyze={() => audioFile && runAnalysis(audioFile)} onUpload={() => fileInputRef.current?.click()} onTogglePlay={() => { initAudioEngine(); setIsPlaying(!isPlaying); }} onToggleRecord={handleToggleRecord} onDownload={handleDownloadResult} />
          )}
          {viewMode === ViewMode.EXPERT && (
            <ExpertView state={state} audioFile={audioFile} isRecording={isRecording} isPlaying={isPlaying} audioUrl={audioUrl} progress={playbackProgress} onControlChange={handleControlChange} onTogglePlay={() => { initAudioEngine(); setIsPlaying(!isPlaying); }} onRender={handleRenderExpert} onApplyTPain={handleApplyTPain} onApplyDrake={handleApplyDrake} tPainIntensity={0} onTPainIntensityChange={() => {}} retuneSpeed={state.analysis?.suggestedParameters.retuneSpeed ?? 20} onRetuneSpeedChange={(v) => handleControlChange('retuneSpeed', v)} onKeyChange={() => {}} onUpload={() => fileInputRef.current?.click()} micProfile={micProfile} onMicProfileChange={setMicProfile} onToggleRecord={handleToggleRecord} onDownload={handleDownloadResult} />
          )}
          {viewMode === ViewMode.CLONE && (
            <CloneView cloneState={cloneState} onStateChange={(s) => setCloneState(prev => ({ ...prev, ...s }))} onGenerate={(perfect) => handleGenerateClone(perfect)} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
