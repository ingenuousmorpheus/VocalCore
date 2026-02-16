
export enum ViewMode {
  AUTO = 'AUTO',
  EXPERT = 'EXPERT',
  CLONE = 'CLONE'
}

export interface AudioAnalysis {
  genre: string;
  key: string;
  bpm: number;
  qualityScore: number;
  vocalType: string;
  detectedGender: 'Masculine' | 'Feminine' | 'Neutral';
  issues: string[];
  metrics: {
    lufs: number;
    peak: number;
    dynamicRange: number;
  };
  suggestedParameters: {
    intensity: number;
    tuneAmount: number;
    compression: number;
    reverb: number;
    deNoise: number;
    deRoom: number;
    deEss: number;
    comp2: number;
    limit: number;
    air: number;
    body: number;
    saturate: number;
    revSize: number;
    revDecay: number;
    revMix: number;
    delay: number;
    autoEq: number;
    // New EFX+ Parameters
    retuneSpeed: number;
    humanize: number;
    breathe: number;
  };
}

export interface CloneState {
  referenceVoice: File | null;
  referenceUrl: string | null;
  targetFile: File | null;
  targetUrl: string | null;
  inputText: string;
  isGenerating: boolean;
  processingStep: string;
  resultAudioUrl: string | null;
  formant: number;
  stability: number;
  similarity: number;
  variance: number; // RVC-inspired
  breathiness: number; // RVC-inspired
}

export interface ProcessingState {
  isAnalyzing: boolean;
  isProcessing: boolean;
  isRenderingExpert: boolean;
  expertResultUrl: string | null;
  renderStep: string;
  progress: number;
  analysis: AudioAnalysis | null;
}

export interface ControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (val: number) => void;
  color?: string;
}
