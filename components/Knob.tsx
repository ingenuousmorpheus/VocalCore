
import React, { useState, useRef, useEffect } from 'react';
import { ControlProps } from '../types';

export const Knob: React.FC<ControlProps> = ({ 
  label, 
  value, 
  min = 0, 
  max = 100, 
  unit = '%', 
  onChange, 
  color = '#06b6d4' 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const delta = (startY.current - e.clientY) * 0.5;
      const newVal = Math.min(max, Math.max(min, startVal.current + delta));
      onChange(Math.round(newVal));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, max, min, onChange]);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-2 select-none group">
      <div 
        className="relative w-16 h-16 rounded-full knob-gradient border-2 border-slate-700 shadow-xl cursor-ns-resize flex items-center justify-center transition-transform active:scale-95"
        onMouseDown={handleMouseDown}
      >
        {/* Indicator Line */}
        <div 
          className="absolute w-1 h-5 rounded-full"
          style={{ 
            backgroundColor: color,
            transform: `rotate(${rotation}deg) translateY(-14px)`,
            boxShadow: `0 0 10px ${color}`
          }}
        />
        <div className="text-[10px] font-mono text-slate-400 mt-1">
          {value}{unit}
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{label}</span>
    </div>
  );
};
