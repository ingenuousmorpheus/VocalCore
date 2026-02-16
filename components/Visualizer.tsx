
import React, { useMemo, useEffect, useState, useRef } from 'react';

interface VisualizerProps {
  active: boolean;
  audioUrl?: string | null;
  progress?: number; // 0 to 1
}

export const Visualizer: React.FC<VisualizerProps> = ({ active, audioUrl, progress = 0 }) => {
  const [peaks, setPeaks] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Decode audio data to generate waveform peaks
  useEffect(() => {
    if (!audioUrl) {
      setPeaks([]);
      return;
    }

    const loadAndDecode = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const channelData = audioBuffer.getChannelData(0);
        const step = Math.ceil(channelData.length / 120); // Number of samples per bar
        const newPeaks = [];
        
        for (let i = 0; i < 120; i++) {
          let max = 0;
          for (let j = 0; j < step; j++) {
            const datum = Math.abs(channelData[i * step + j]);
            if (datum > max) max = datum;
          }
          newPeaks.push(max);
        }
        setPeaks(newPeaks);
        await audioContext.close();
      } catch (err) {
        console.error("Failed to decode waveform:", err);
      }
    };

    loadAndDecode();
  }, [audioUrl]);

  // Animated bars for active playback
  const animatedBars = useMemo(() => {
    return Array.from({ length: 80 }).map((_, i) => ({
      delay: i * 0.01,
      heightMultiplier: 0.5 + Math.random() * 0.5
    }));
  }, []);

  return (
    <div className="w-full h-44 bg-black/80 rounded-[2rem] border border-white/5 relative overflow-hidden flex flex-col items-center justify-center p-4 shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/10 via-transparent to-transparent pointer-events-none" />
      
      {/* Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none opacity-10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-t border-white/20 w-full" />
        ))}
      </div>

      {/* Real Waveform or Standby */}
      <div className="w-full h-full flex items-center justify-center gap-[2px] relative">
        {peaks.length > 0 ? (
          <div className="w-full h-full flex items-center justify-center gap-[2px]">
            {peaks.map((peak, i) => {
              const isPlayed = (i / peaks.length) < progress;
              return (
                <div
                  key={i}
                  className={`w-[4px] rounded-full transition-all duration-300 ${
                    isPlayed ? 'bg-cyan-400' : 'bg-slate-700'
                  }`}
                  style={{ 
                    height: `${Math.max(4, peak * 100)}%`,
                    boxShadow: isPlayed ? '0 0 10px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                />
              );
            })}
            
            {/* Scrubber Line */}
            <div 
              className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_15px_white] z-20 transition-all duration-100 ease-linear pointer-events-none"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-1.5">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1.5 h-8 bg-slate-800 rounded-full animate-pulse" 
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-slate-600 tracking-[0.5em] uppercase">No Signal Detected</span>
          </div>
        )}

        {/* Playback Animation Overlay (Bars) */}
        {active && (
          <div className="absolute inset-0 flex items-end justify-center gap-[1px] opacity-40 pointer-events-none">
            {animatedBars.map((bar, i) => (
              <div
                key={i}
                className="w-1 bg-cyan-400/50 rounded-t-sm animate-bounce"
                style={{ 
                  height: `${20 + Math.random() * 40}%`,
                  animationDelay: `${bar.delay}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Frequency Labels */}
      <div className="absolute bottom-2 left-0 right-0 px-8 flex justify-between text-[8px] font-mono text-slate-700 pointer-events-none uppercase tracking-tighter">
        <span>-inf dB</span>
        <span>Studio Ready Signal</span>
        <span>0.0 dB</span>
      </div>
    </div>
  );
};
