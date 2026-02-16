
import React from 'react';
import { ProcessingState } from '../types';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';

interface AutoViewProps {
  state: ProcessingState;
  audioFile: File | null;
  isPlaying: boolean;
  isRecording: boolean;
  audioUrl?: string | null;
  progress?: number;
  onControlChange: (key: string, val: number) => void;
  onAnalyze: () => void;
  onUpload: () => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onDownload: () => void;
}

export const AutoView: React.FC<AutoViewProps> = ({ 
  state, 
  audioFile, 
  isPlaying, 
  isRecording,
  audioUrl,
  progress,
  onControlChange, 
  onAnalyze, 
  onUpload, 
  onTogglePlay,
  onToggleRecord,
  onDownload
}) => {
  const { analysis, isAnalyzing, isProcessing } = state;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      
      {/* Input Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
        <div className="flex items-center gap-3">
          <button 
            onClick={onUpload}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest transition-all flex items-center gap-2 group/upload ${
              audioFile 
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20' 
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {audioFile ? 'CHANGE FILE' : 'UPLOAD VOCAL'}
          </button>

          <button 
            onClick={onToggleRecord}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest transition-all flex items-center gap-2 group/record ${
              isRecording 
                ? 'bg-red-500/20 border border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
            }`}
          >
            <div className={`w-2 h-2 rounded-full bg-red-500 ${isRecording ? 'animate-pulse' : ''}`} />
            {isRecording ? 'STOP RECORDING' : 'RECORD LIVE'}
          </button>
        </div>

        {audioFile && (
          <div className="flex items-center gap-3 animate-in slide-in-from-right-2 duration-300">
            <button 
              onClick={onDownload}
              disabled={isProcessing}
              className="px-4 py-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {isProcessing ? 'SAVING...' : 'SAVE MIX'}
            </button>
            <div className="flex flex-col items-end border-l border-white/10 pl-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Source Material</span>
              <span className="text-xs text-white truncate max-w-[150px] font-mono">{audioFile.name}</span>
            </div>
          </div>
        )}
      </div>

      {/* Waveform Area */}
      <div className="relative group">
        <Visualizer 
          active={isPlaying || isProcessing || isAnalyzing || isRecording} 
          audioUrl={audioUrl}
          progress={progress}
        />
        
        {analysis && (
          <div className="absolute top-2 right-4 flex gap-4 text-[11px] font-mono">
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-white/10 backdrop-blur-sm">
              <span className="text-slate-500">GENRE:</span>
              <span className="text-cyan-400">{analysis.genre.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-white/10 backdrop-blur-sm">
              <span className="text-slate-500">KEY:</span>
              <span className="text-amber-400">{analysis.key}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Action Bar */}
      <div className="flex items-center justify-center gap-6">
        {(audioFile || isRecording) && (
          <button 
            onClick={onTogglePlay}
            disabled={isRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all border-2 shadow-2xl ${
              isRecording ? 'opacity-30 cursor-not-allowed border-slate-700 bg-slate-800' :
              isPlaying 
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-400 hover:bg-amber-600/30' 
                : 'bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 active:scale-95'
            }`}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 translate-x-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}

        <button 
          onClick={onAnalyze}
          disabled={isAnalyzing || (!audioFile && !isRecording)}
          className={`px-10 py-4 rounded-full font-black text-sm uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-3 min-w-[260px] ${
            isAnalyzing || (!audioFile && !isRecording)
              ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50 shadow-none' 
              : 'bg-cyan-600 border-cyan-400 text-white hover:bg-cyan-500 hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(8,145,178,0.4)]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              AI SCANNING...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {analysis ? 'AUTO MIX RE-SCAN' : 'INITIAL AI MIX'}
            </>
          )}
        </button>
      </div>

      {/* Macro Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center py-6">
        <Knob 
          label="Intensity" 
          value={analysis?.suggestedParameters.intensity || 50} 
          onChange={(v) => onControlChange('intensity', v)} 
        />
        <Knob 
          label="Auto-Tune" 
          value={analysis?.suggestedParameters.tuneAmount || 85} 
          color="#f59e0b"
          onChange={(v) => onControlChange('tune', v)} 
        />
        <Knob 
          label="Dynamics" 
          value={analysis?.suggestedParameters.compression || 70} 
          color="#10b981"
          onChange={(v) => onControlChange('comp', v)} 
        />
        <Knob 
          label="Ambience" 
          value={analysis?.suggestedParameters.reverb || 30} 
          color="#8b5cf6"
          onChange={(v) => onControlChange('reverb', v)} 
        />
      </div>
    </div>
  );
};
