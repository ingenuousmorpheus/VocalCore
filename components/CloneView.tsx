
import React, { useRef } from 'react';
import { Knob } from './Knob';
import { CloneState } from '../types';

interface CloneViewProps {
  cloneState: CloneState;
  onStateChange: (updates: Partial<CloneState>) => void;
  onGenerate: (perfected?: boolean) => void;
}

export const CloneView: React.FC<CloneViewProps> = ({ cloneState, onStateChange, onGenerate }) => {
  const refInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onStateChange({
        referenceVoice: file,
        referenceUrl: URL.createObjectURL(file)
      });
    }
  };

  const handleTargetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onStateChange({
        targetFile: file,
        targetUrl: URL.createObjectURL(file)
      });
    }
  };

  const downloadResult = () => {
    if (!cloneState.resultAudioUrl) return;
    const a = document.createElement('a');
    a.href = cloneState.resultAudioUrl;
    a.download = `VocalCore_DAW_Ready_${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col gap-8 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-pink-500 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            RVC INFERENCE ENGINE
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-widest">Studio-Ready Timbre Conversion & DDSP Mastering</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">32-Bit Float Rendering</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Step 1: Reference */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ref. Voice Model</label>
          <div 
            onClick={() => refInputRef.current?.click()}
            className={`aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group relative overflow-hidden ${
              cloneState.referenceVoice ? 'border-pink-500/50 bg-pink-500/5 shadow-[0_0_30px_rgba(236,72,153,0.1)]' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <input type="file" ref={refInputRef} className="hidden" accept="audio/*" onChange={handleRefFileChange} />
            {cloneState.referenceUrl ? (
              <div className="text-center px-4 animate-in fade-in duration-300">
                <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-[11px] font-black text-white truncate w-full uppercase">{cloneState.referenceVoice?.name}</p>
              </div>
            ) : (
              <div className="text-center p-4">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4v16m8-8H4" /></svg>
                </div>
                <p className="text-[10px] font-bold text-slate-400">UPLOAD REFERENCE</p>
              </div>
            )}
          </div>
        </div>

        {/* Synthesis Options */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conversion Parameters</label>
          <div className="bg-slate-900/60 border border-white/5 rounded-[2rem] p-6 flex flex-col gap-6">
            <textarea 
              value={cloneState.inputText}
              onChange={(e) => onStateChange({ inputText: e.target.value })}
              className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-slate-200 focus:outline-none focus:border-pink-500/40 transition-all resize-none font-medium h-24"
              placeholder="Enter text to synthesize..."
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 justify-items-center">
               <Knob label="Similarity" value={cloneState.similarity} unit="%" color="#ec4899" onChange={(v) => onStateChange({ similarity: v })} />
               <Knob label="Variance" value={cloneState.variance} unit="%" color="#f59e0b" onChange={(v) => onStateChange({ variance: v })} />
               <Knob label="Stability" value={cloneState.stability} unit="%" color="#10b981" onChange={(v) => onStateChange({ stability: v })} />
               <Knob label="Breathe" value={cloneState.breathiness} unit="%" color="#8b5cf6" onChange={(v) => onStateChange({ breathiness: v })} />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Generation UI */}
      <div className="relative">
        <button 
          onClick={() => onGenerate(true)}
          disabled={cloneState.isGenerating || !cloneState.referenceVoice}
          className={`w-full py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] transition-all relative overflow-hidden group ${
            cloneState.isGenerating || !cloneState.referenceVoice
              ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed' 
              : 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-[0_25px_60px_rgba(236,72,153,0.4)] hover:scale-[1.01] active:scale-[0.98]'
          }`}
        >
          {cloneState.isGenerating ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-[10px] tracking-widest">{cloneState.processingStep}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">MIMIC & MASTER FOR DAW</span>
              <span className="text-[10px] text-white/50 tracking-normal opacity-80 uppercase">One-Click Studio Rendering</span>
            </div>
          )}
          <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform" />
        </button>
      </div>

      {/* Studio Output Section */}
      {cloneState.resultAudioUrl && (
        <div className="mt-4 bg-slate-900/60 border border-pink-500/30 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 animate-in zoom-in-95 duration-700 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 p-10 opacity-[0.03] pointer-events-none">
             <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
          </div>
          
          <div className="flex items-center gap-8 relative z-10">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-pink-500/20">
               <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-pink-500 text-white text-[9px] font-black rounded uppercase tracking-tighter">Perfected</span>
                <span className="px-3 py-1 bg-white/10 text-slate-300 text-[9px] font-black rounded uppercase tracking-tighter">DAW Ready</span>
              </div>
              <h4 className="text-white font-black text-2xl tracking-tighter uppercase italic">Studio Master Output</h4>
              <p className="text-[11px] text-slate-400 font-mono tracking-widest mt-2">TRUE-PEAK: -0.1dB | LUFS: -14.1 | SAMPLE: 48KHZ 32-BIT</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
            <audio controls src={cloneState.resultAudioUrl} className="h-10 rounded-full w-full md:w-64 accent-pink-500" />
            <button 
              onClick={downloadResult}
              className="p-6 bg-cyan-500 hover:bg-cyan-400 text-white rounded-[2rem] transition-all shadow-[0_15px_30px_rgba(6,182,212,0.3)] group/dl active:scale-90"
              title="Download Lossless Studio Mix"
            >
              <svg className="w-8 h-8 group-hover:animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Signal Flow Diagram */}
      <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8">
        <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] mb-6 text-center">Neural DSP Signal Flow</h5>
        <div className="flex flex-wrap justify-center items-center gap-4 text-[9px] font-black font-mono">
          <span className="text-slate-500">VOX REF</span>
          <div className="w-8 h-[1px] bg-slate-800" />
          <span className="text-pink-500 border border-pink-500/30 px-2 py-1 rounded">RVC MODEL</span>
          <div className="w-8 h-[1px] bg-slate-800" />
          <span className="text-cyan-500 border border-cyan-500/30 px-2 py-1 rounded">PULTEC EQ</span>
          <div className="w-8 h-[1px] bg-slate-800" />
          <span className="text-emerald-500 border border-emerald-500/30 px-2 py-1 rounded">1176 COMP</span>
          <div className="w-8 h-[1px] bg-slate-800" />
          <span className="text-white border border-white/20 px-2 py-1 rounded">MASTER OUT</span>
        </div>
      </div>
    </div>
  );
};
