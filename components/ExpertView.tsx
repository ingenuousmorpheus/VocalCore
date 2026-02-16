
import React from 'react';
import { Knob } from './Knob';
import { ProcessingState } from '../types';
import { Visualizer } from './Visualizer';

interface ExpertViewProps {
  state: ProcessingState;
  audioFile: File | null;
  isRecording: boolean;
  isPlaying: boolean;
  audioUrl?: string | null;
  progress?: number;
  onControlChange: (key: string, val: number) => void;
  onTogglePlay: () => void;
  onToggleRecord: () => void;
  onRender: () => void;
  onDownload: () => void;
  micProfile: 'Vintage Tube' | 'Modern Condenser';
  onMicProfileChange: (v: 'Vintage Tube' | 'Modern Condenser') => void;
  onUpload: () => void;
  onApplyTPain: () => void;
  onApplyDrake: () => void;
  tPainIntensity: number;
  onTPainIntensityChange: (val: number) => void;
  retuneSpeed: number;
  onRetuneSpeedChange: (val: number) => void;
  onKeyChange: (key: string) => void;
}

export const ExpertView: React.FC<ExpertViewProps> = ({ 
  state, 
  audioFile, 
  isRecording, 
  isPlaying, 
  audioUrl,
  progress,
  onControlChange,
  onTogglePlay,
  onToggleRecord,
  onRender,
  onDownload,
  micProfile,
  onMicProfileChange,
  onUpload,
  onApplyTPain,
  onApplyDrake
}) => {
  const params = state.analysis?.suggestedParameters;
  const isAnalyzing = state.isAnalyzing;
  const currentRetuneSpeed = params?.retuneSpeed ?? 20;
  const currentHumanize = params?.humanize ?? 40;

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Source Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner gap-4">
        <div className="flex items-center gap-4">
           <button 
             onClick={onUpload}
             className="px-6 py-2.5 bg-cyan-600/10 border border-cyan-500/30 rounded-xl text-xs font-black text-cyan-400 uppercase tracking-widest hover:bg-cyan-500/20 transition-all flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
             Expert Upload
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
            {isRecording ? 'STOP REC' : 'LIVE REC'}
          </button>

           {audioFile && (
             <span className="text-[10px] font-mono text-slate-500 uppercase truncate max-w-[120px]">{audioFile.name}</span>
           )}
        </div>

        <div className="flex items-center gap-2">
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-2">Mic Model:</span>
           {(['Vintage Tube', 'Modern Condenser'] as const).map(p => (
             <button 
               key={p} 
               onClick={() => onMicProfileChange(p)}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${micProfile === p ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
             >
               {p}
             </button>
           ))}
        </div>
      </div>

      {/* Top Monitor Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        <div className="md:col-span-3">
          <Visualizer 
            active={isPlaying || isRecording || state.isRenderingExpert} 
            audioUrl={audioUrl}
            progress={progress}
          />
        </div>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onTogglePlay}
            disabled={!audioFile || isRecording}
            className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all border-2 ${
              isPlaying 
                ? 'bg-amber-600/20 border-amber-500/50 text-amber-400' 
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
            } ${(!audioFile || isRecording) ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
            {isPlaying ? 'PAUSE TEST' : 'PLAY TEST'}
          </button>
          
          <button 
            onClick={onRender}
            disabled={!audioFile || state.isRenderingExpert || isAnalyzing}
            className={`w-full py-5 rounded-xl flex flex-col items-center justify-center transition-all border-2 relative overflow-hidden group ${
              state.isRenderingExpert 
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400 cursor-wait' 
                : 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500 hover:scale-[1.02] shadow-[0_0_20px_rgba(79,70,229,0.3)]'
            }`}
          >
            {state.isRenderingExpert ? (
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mb-1" />
                <span className="text-[8px] font-black tracking-widest uppercase">{state.renderStep}</span>
              </div>
            ) : (
              <>
                <span className="text-[10px] font-black tracking-widest uppercase italic">Neural Master Bounce</span>
                <span className="text-[8px] text-white/50 uppercase tracking-tighter mt-1">Enhance Signal & Tone</span>
              </>
            )}
          </button>

          {audioFile && (
            <button 
              onClick={onDownload}
              disabled={state.isProcessing}
              className="w-full py-3 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {state.isProcessing ? 'SAVING...' : 'SAVE MASTER'}
            </button>
          )}
        </div>
      </div>

      {/* EFX+ PITCH & PERFORMANCE RACK */}
      <div className="bg-slate-900/60 rounded-[2.5rem] border border-cyan-500/20 p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
              <div className="px-2 py-1 bg-cyan-500 text-white text-[10px] rounded italic">EFX+</div>
              PITCH & PERFORMANCE
            </h3>
            <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase">Antares-Inspired Neural Engine</p>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={onApplyTPain}
              className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all border-2 flex items-center justify-center gap-2 min-w-[200px] ${
                currentRetuneSpeed === 0 
                  ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-amber-500/50 hover:text-amber-400'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
              Auto-Tunned Pained
            </button>
            <button 
              onClick={onApplyDrake}
              className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all border-2 flex items-center justify-center gap-2 min-w-[200px] ${
                currentRetuneSpeed === 15 && currentHumanize === 80 
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' 
                  : 'bg-white/5 border-white/10 text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              A Drake Passion
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
           {/* Big Knobs Side-by-Side */}
           <div className="lg:col-span-2 flex justify-around items-center bg-black/40 rounded-[2rem] p-8 border border-white/5">
              <div className="flex flex-col items-center gap-4">
                 <Knob 
                    label="Retune Speed" 
                    value={currentRetuneSpeed} 
                    color="#06b6d4" 
                    onChange={(v) => onControlChange('retuneSpeed', v)}
                 />
                 <span className="text-[10px] text-cyan-400/50 font-mono">{currentRetuneSpeed}ms</span>
              </div>
              
              <div className="flex flex-col items-center justify-center">
                 <div className={`w-24 h-24 rounded-full border-4 transition-all flex items-center justify-center relative overflow-hidden group ${currentRetuneSpeed === 0 ? 'border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : (currentRetuneSpeed === 15 && currentHumanize === 80 ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'border-slate-800')}`}>
                    <div className={`absolute inset-0 ${currentRetuneSpeed === 0 ? 'bg-amber-500/10' : (currentRetuneSpeed === 15 && currentHumanize === 80 ? 'bg-indigo-500/10' : 'bg-cyan-500/5')} animate-pulse`} />
                    <span className={`text-2xl font-black italic transition-colors ${currentRetuneSpeed === 0 ? 'text-amber-400' : (currentRetuneSpeed === 15 && currentHumanize === 80 ? 'text-indigo-400' : 'text-cyan-400')}`}>
                      {currentRetuneSpeed === 0 ? 'ROBOT' : (currentRetuneSpeed === 15 && currentHumanize === 80 ? 'PASSION' : 'AUTO')}
                    </span>
                 </div>
                 <span className="text-[9px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Pitch Engine</span>
              </div>

              <div className="flex flex-col items-center gap-4">
                 <Knob 
                    label="Humanize" 
                    value={currentHumanize} 
                    color="#f59e0b" 
                    onChange={(v) => onControlChange('humanize', v)}
                 />
                 <span className="text-[10px] text-amber-400/50 font-mono">{currentHumanize}%</span>
              </div>
           </div>

           {/* Module Rack */}
           <div className="flex flex-col gap-4">
              <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex items-center justify-between group">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center">
                       <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                       <h4 className="text-[11px] font-black text-white uppercase tracking-tighter">Breathe Module</h4>
                       <p className="text-[8px] text-slate-500 uppercase font-mono">Texture injection</p>
                    </div>
                 </div>
                 <Knob label="" value={params?.breathe ?? 15} unit="" color="#ec4899" onChange={(v) => onControlChange('breathe', v)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button className={`py-2 border rounded-lg text-[9px] font-black uppercase transition-all ${currentRetuneSpeed === 15 && currentHumanize === 80 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>Passion</button>
                 <button className={`py-2 border rounded-lg text-[9px] font-black uppercase transition-all ${currentRetuneSpeed === 0 ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>Robot</button>
              </div>
           </div>
        </div>
      </div>

      {/* Expert Controls Grid (Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/40 rounded-2xl border border-white/5 p-6">
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            01. Tone & EQ
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <Knob label="De-Noise" value={params?.deNoise ?? 10} unit="%" onChange={(v) => onControlChange('deNoise', v)} />
            <Knob label="Auto EQ" value={params?.autoEq ?? 50} unit="%" color="#06b6d4" onChange={(v) => onControlChange('autoEq', v)} />
            <Knob label="De-Ess" value={params?.deEss ?? 30} unit="%" onChange={(v) => onControlChange('deEss', v)} />
          </div>
        </div>

        <div className="bg-slate-900/40 rounded-2xl border border-white/5 p-6">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            02. CLA Dynamics
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <Knob label="76 FET" value={params?.compression ?? 40} unit="%" color="#10b981" onChange={(v) => onControlChange('compression', v)} />
            <Knob label="Intensity" value={params?.intensity ?? 50} unit="%" color="#10b981" onChange={(v) => onControlChange('intensity', v)} />
            <Knob label="Brickwall" value={params?.limit ?? 95} unit="%" color="#10b981" onChange={(v) => onControlChange('limit', v)} />
          </div>
        </div>

        <div className="bg-slate-900/40 lg:col-span-2 rounded-2xl border border-white/5 p-6">
          <h3 className="text-sm font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            03. Spatial Processing
          </h3>
          <div className="grid grid-cols-4 gap-4">
            <Knob label="Reverb" value={params?.revMix ?? 20} unit="%" color="#a855f7" onChange={(v) => onControlChange('revMix', v)} />
            <Knob label="Rev Size" value={params?.revSize ?? 50} unit="%" color="#a855f7" onChange={(v) => onControlChange('revSize', v)} />
            <Knob label="Delay" value={params?.delay ?? 10} unit="%" color="#a855f7" onChange={(v) => onControlChange('delay', v)} />
            <Knob label="Saturate" value={params?.saturate ?? 10} unit="%" color="#f59e0b" onChange={(v) => onControlChange('saturate', v)} />
          </div>
        </div>
      </div>
    </div>
  );
};
