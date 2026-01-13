import React, { useEffect, useState } from 'react';
import { Activity, Scissors, FileAudio } from 'lucide-react';

const ProcessingView: React.FC = () => {
  const [progress, setProgress] = useState(0);
  
  // Simulation of progress with varying speed to look realistic
  useEffect(() => {
    let animationFrame: number;
    let currentProgress = 0;

    const animate = () => {
      // Fast start, slower end to simulate heavy computation at the end
      const increment = Math.max(0.05, (98 - currentProgress) / 60); 
      currentProgress += increment;
      
      if (currentProgress >= 99) currentProgress = 99;
      
      setProgress(currentProgress);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const getStatusText = (p: number) => {
      if (p < 25) return "Extracting audio stream...";
      if (p < 50) return "Decoding waveform data...";
      if (p < 75) return "Analyzing silence patterns...";
      return "Calculating optimal cut points...";
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in zoom-in-95 duration-500 w-full max-w-2xl mx-auto">
      
      {/* Central Visual */}
      <div className="relative mb-12">
        {/* Outer Glow Rings */}
        <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute -inset-4 bg-blue-600/10 rounded-full blur-2xl animate-pulse delay-75"></div>
        
        {/* Main Circle */}
        <div className="relative w-24 h-24 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center shadow-2xl z-10 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-blue-500/10 opacity-50"></div>
            
            {/* Spinning Border */}
            <div className="absolute inset-0 border-t-2 border-cyan-500 rounded-full animate-spin"></div>
            
            <Activity className="w-10 h-10 text-cyan-400 relative z-20" />
        </div>

        {/* Orbiting Icons */}
        <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 p-2 rounded-full border border-zinc-800 shadow-lg transform -rotate-[0deg]">
                <FileAudio className="w-4 h-4 text-zinc-400" />
            </div>
        </div>
        <div className="absolute inset-0 animate-[spin_4s_linear_infinite_reverse]">
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-zinc-900 p-2 rounded-full border border-zinc-800 shadow-lg transform rotate-[0deg]">
                <Scissors className="w-4 h-4 text-zinc-400" />
            </div>
        </div>
      </div>

      {/* Text & Progress */}
      <div className="w-full max-w-md text-center space-y-6 relative z-20">
        <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white tracking-tight">Processing Media</h3>
            <p className="text-cyan-400 font-mono text-sm h-6 transition-all duration-300">
                {`> ${getStatusText(progress)}`}
                <span className="animate-pulse">_</span>
            </p>
        </div>
        
        <div className="relative pt-2">
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] transition-all duration-100 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="flex justify-between text-[10px] text-zinc-600 font-mono mt-2 uppercase tracking-widest">
                <span>Initializing</span>
                <span>{Math.floor(progress)}%</span>
                <span>Finalizing</span>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ProcessingView;
