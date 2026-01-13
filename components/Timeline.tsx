import React, { useEffect, useRef, useState } from 'react';
import { AudioSegment } from '../types';

interface TimelineProps {
  segments: AudioSegment[];
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
  segments, 
  duration, 
  currentTime, 
  trimStart, 
  trimEnd, 
  onSeek,
  onTrimChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<'start' | 'end' | 'seek' | null>(null);

  // Helper to convert x to time
  const getX = (time: number, width: number) => (time / duration) * width;
  const getTime = (x: number, width: number) => (x / width) * duration;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      canvas.width = container.clientWidth;
      canvas.height = 48; // Increased height for handles
      draw();
    };

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const trackHeight = 32;
      const topOffset = 8;

      // Clear
      ctx.clearRect(0, 0, width, height);

      // Background Track
      ctx.fillStyle = '#27272a'; // zinc-800
      ctx.fillRect(0, topOffset, width, trackHeight);

      if (duration === 0) return;

      // Draw segments
      segments.forEach(seg => {
        const x = getX(seg.start, width);
        const w = getX(seg.end - seg.start, width);

        if (seg.isSilent) {
            ctx.fillStyle = '#ef444440'; // Red tint
            ctx.fillRect(x, topOffset, w, trackHeight);
            
            // Hatching
            ctx.beginPath();
            ctx.strokeStyle = '#ef444460';
            ctx.lineWidth = 1;
            for (let i = x; i < x + w; i += 6) {
                ctx.moveTo(i, topOffset);
                ctx.lineTo(i - 6, topOffset + trackHeight);
            }
            ctx.stroke();
        } else {
             ctx.fillStyle = '#06b6d4'; // Cyan
             ctx.fillRect(x, topOffset, w, trackHeight);
        }
      });

      // Draw Trim Dimming (Dim areas outside trim range)
      const trimStartX = getX(trimStart, width);
      const trimEndX = getX(trimEnd, width);

      ctx.fillStyle = 'rgba(9, 9, 11, 0.75)'; // Darker dim
      // Left dim
      ctx.fillRect(0, topOffset, trimStartX, trackHeight);
      // Right dim
      ctx.fillRect(trimEndX, topOffset, width - trimEndX, trackHeight);

      // Trim Handles
      const handleWidth = 10;
      
      // Start Handle
      ctx.fillStyle = '#fbbf24'; // Amber-400
      ctx.beginPath();
      ctx.roundRect(trimStartX - handleWidth, topOffset - 4, handleWidth, trackHeight + 8, [4, 0, 0, 4]);
      ctx.fill();
      // Icon lines
      ctx.fillStyle = '#78350f';
      ctx.fillRect(trimStartX - 6, topOffset + 10, 2, 12);

      // End Handle
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.roundRect(trimEndX, topOffset - 4, handleWidth, trackHeight + 8, [0, 4, 4, 0]);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(trimEndX + 4, topOffset + 10, 2, 12);

      // Trim Lines
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(trimStartX, topOffset, 2, trackHeight);
      ctx.fillRect(trimEndX - 2, topOffset, 2, trackHeight);

      // Playhead
      const playheadX = getX(currentTime, width);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillRect(playheadX - 1, topOffset - 2, 2, trackHeight + 4);
      ctx.shadowBlur = 0;
      
      // Time label
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${currentTime.toFixed(1)}s`, playheadX + 5, height - 2);
    };

    // Initial draw
    updateSize();

    // Resize observer
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [segments, duration, currentTime, trimStart, trimEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || duration === 0) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    const trimStartX = getX(trimStart, width);
    const trimEndX = getX(trimEnd, width);
    const handleWidth = 15; // Hit area

    // Check Handles
    if (Math.abs(x - trimStartX) < handleWidth) {
        setDragMode('start');
    } else if (Math.abs(x - trimEndX) < handleWidth) {
        setDragMode('end');
    } else {
        setDragMode('seek');
        const newTime = getTime(x, width);
        onSeek(Math.max(0, Math.min(newTime, duration)));
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragMode || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newTime = getTime(x, rect.width);

    if (dragMode === 'start') {
        const maxStart = trimEnd - 0.5; // Min 0.5s duration
        onTrimChange(Math.min(Math.max(0, newTime), maxStart), trimEnd);
    } else if (dragMode === 'end') {
        const minEnd = trimStart + 0.5;
        onTrimChange(trimStart, Math.max(Math.min(duration, newTime), minEnd));
    } else if (dragMode === 'seek') {
        onSeek(newTime);
    }
  };

  const handleMouseUp = () => {
    setDragMode(null);
  };

  useEffect(() => {
    if (dragMode) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode, trimStart, trimEnd, duration]); // Deps important for closures

  // Cursor style
  const getCursor = (e: React.MouseEvent) => {
      if (!canvasRef.current) return 'default';
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const trimStartX = getX(trimStart, width);
      const trimEndX = getX(trimEnd, width);
      const handleWidth = 10;
      
      if (Math.abs(x - trimStartX) < handleWidth || Math.abs(x - trimEndX) < handleWidth) {
          return 'ew-resize';
      }
      return 'crosshair';
  };

  return (
    <div className="w-full select-none" ref={containerRef}>
      <canvas 
        ref={canvasRef} 
        className="w-full h-12 rounded cursor-pointer touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
             if(canvasRef.current) canvasRef.current.style.cursor = getCursor(e);
        }}
      />
      <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
        <span>00:00</span>
        <span>Original Duration: {duration.toFixed(1)}s</span>
      </div>
    </div>
  );
};

export default Timeline;