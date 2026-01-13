import React, { useRef, useEffect, useState } from 'react';
import { AudioSegment, ExportConfig } from '../types';
import Timeline from './Timeline';
import { Play, Pause, Volume2, VolumeX, Scissors, Music, Music2 } from 'lucide-react';

interface VideoPreviewProps {
  file: File | null;
  segments: AudioSegment[];
  autoSkip: boolean;
  onAutoSkipToggle: (enabled: boolean) => void;
  exportConfig: ExportConfig;
  onUpdateConfig: (config: Partial<ExportConfig>) => void;
  duration: number;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ 
    file, 
    segments, 
    autoSkip, 
    onAutoSkipToggle,
    exportConfig,
    onUpdateConfig,
    duration
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [src, setSrc] = useState<string>('');
  const [bgMusicSrc, setBgMusicSrc] = useState<string>('');
  const [isAudioOnly, setIsAudioOnly] = useState(false);

  // Handle Video Source
  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setSrc(objectUrl);
      setIsAudioOnly(file.type.startsWith('audio/'));
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [file]);

  // Handle Background Music Source
  useEffect(() => {
    if (exportConfig.bgMusicFile) {
        const objectUrl = URL.createObjectURL(exportConfig.bgMusicFile);
        setBgMusicSrc(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    } else {
        setBgMusicSrc('');
    }
  }, [exportConfig.bgMusicFile]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        bgAudioRef.current?.pause();
      } else {
        // Enforce trim boundaries on start
        if (videoRef.current.currentTime < exportConfig.trimStart) {
            videoRef.current.currentTime = exportConfig.trimStart;
        } else if (videoRef.current.currentTime > exportConfig.trimEnd) {
             videoRef.current.currentTime = exportConfig.trimStart;
        }
        videoRef.current.play();
        bgAudioRef.current?.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const calculateVirtualTime = (realTime: number): number => {
    // Calculates how much "active" time has passed up to realTime
    // This maps the skipped video time to the continuous background music time
    let virtual = 0;
    
    // Start counting from trimStart (bg music starts at trimStart)
    if (realTime < exportConfig.trimStart) return 0;

    for (const seg of segments) {
        if (seg.end < exportConfig.trimStart) continue; // Before trim
        if (seg.start > realTime) break; // Future segment
        if (seg.start > exportConfig.trimEnd) break; // After trim

        // Determine effective segment part within current playback pos
        const effectiveStart = Math.max(seg.start, exportConfig.trimStart);
        const effectiveEnd = Math.min(seg.end, realTime, exportConfig.trimEnd);

        if (!seg.isSilent && effectiveEnd > effectiveStart) {
            virtual += (effectiveEnd - effectiveStart);
        }
    }
    return virtual;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    let time = videoRef.current.currentTime;

    // 1. Enforce Trim Range
    if (time < exportConfig.trimStart) {
        time = exportConfig.trimStart;
        videoRef.current.currentTime = time;
    }
    if (time >= exportConfig.trimEnd) {
        videoRef.current.pause();
        bgAudioRef.current?.pause();
        setIsPlaying(false);
        time = exportConfig.trimEnd;
    }

    setCurrentTime(time);

    // 2. Handle Auto Skip
    if (autoSkip && segments.length > 0 && isPlaying) {
      const currentSegment = segments.find(s => time >= s.start && time < s.end);
      if (currentSegment && currentSegment.isSilent) {
        const nextActive = segments.find(s => s.start >= currentSegment.end && !s.isSilent);
        if (nextActive && nextActive.start < exportConfig.trimEnd) {
           videoRef.current.currentTime = nextActive.start;
           // We jumped, update time var for bg sync
           time = nextActive.start;
        }
      }
    }

    // 3. Sync Background Audio
    if (bgAudioRef.current && bgMusicSrc) {
        const vTime = calculateVirtualTime(time);
        // Sync if drift is > 0.1s
        if (Math.abs(bgAudioRef.current.currentTime - vTime) > 0.2) {
            bgAudioRef.current.currentTime = vTime;
        }
        if (isPlaying && bgAudioRef.current.paused) {
             bgAudioRef.current.play();
        }
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
        // Clamp seek
        const clamped = Math.max(exportConfig.trimStart, Math.min(time, exportConfig.trimEnd));
        videoRef.current.currentTime = clamped;
        setCurrentTime(clamped);
        
        // Update bg music immediately
        if (bgAudioRef.current) {
            bgAudioRef.current.currentTime = calculateVirtualTime(clamped);
        }
    }
  };

  const handleTrimChange = (start: number, end: number) => {
      onUpdateConfig({ trimStart: start, trimEnd: end });
      // If playhead is outside, move it
      if (videoRef.current) {
          if (videoRef.current.currentTime < start) {
              videoRef.current.currentTime = start;
              setCurrentTime(start);
          } else if (videoRef.current.currentTime > end) {
              videoRef.current.currentTime = start; // Reset to start
              setCurrentTime(start);
          }
      }
  };

  if (!file) return null;

  return (
    <div className="space-y-4">
        {/* Main Player */}
        <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-xl relative group">
        <div className="relative aspect-video bg-black flex items-center justify-center">
            {isAudioOnly ? (
                <div className="flex flex-col items-center justify-center text-zinc-700 animate-pulse">
                     <Music2 className="w-24 h-24 mb-4 opacity-50" />
                     <p className="font-mono text-sm tracking-widest uppercase">Audio Preview Mode</p>
                </div>
            ) : null}
            
            <video
                ref={videoRef}
                src={src}
                className={`w-full h-full object-contain ${isAudioOnly ? 'hidden' : ''}`}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                muted={isMuted}
            />
            {/* Hidden audio element for background music */}
            {bgMusicSrc && (
                <audio ref={bgAudioRef} src={bgMusicSrc} loop={false} volume={0.5} />
            )}
            
            {/* Overlay Controls */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer backdrop-blur-[2px]" onClick={togglePlay}>
                    <div className="p-5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl hover:scale-110 transition-transform">
                        <Play className="w-10 h-10 text-white fill-current" />
                    </div>
                </div>
            )}
            
            {/* Hover overlay for pause */}
            {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors cursor-pointer" onClick={togglePlay}>
                     <div className="opacity-0 hover:opacity-100 p-5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 transition-opacity">
                         <Pause className="w-10 h-10 text-white fill-current" />
                     </div>
                </div>
            )}
        </div>

        <div className="p-4 space-y-4 bg-zinc-900">
            <Timeline 
                segments={segments} 
                duration={duration} 
                currentTime={currentTime} 
                trimStart={exportConfig.trimStart}
                trimEnd={exportConfig.trimEnd}
                onSeek={handleSeek}
                onTrimChange={handleTrimChange}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
                <button 
                    onClick={togglePlay}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-200 transition-colors"
                >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                
                <button 
                    onClick={() => {
                        if (videoRef.current) videoRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                    }}
                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <span className="text-sm font-mono text-zinc-400">
                    {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={() => onAutoSkipToggle(!autoSkip)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        autoSkip 
                        ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                >
                    <Scissors className="w-4 h-4" />
                    <span>Magic Skip: {autoSkip ? 'ON' : 'OFF'}</span>
                </button>
            </div>
            </div>
        </div>
        </div>

        {/* Trim & Audio Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Trim Controls (Manual inputs + Drag hint) */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Scissors className="w-4 h-4" /> Trim Range (sec)
                    </h4>
                    <span className="text-[10px] text-zinc-600">Drag handles on timeline</span>
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="flex-1">
                         <label className="text-xs text-zinc-500 mb-1 block">Start</label>
                         <input 
                            type="number" 
                            value={exportConfig.trimStart.toFixed(2)}
                            step="0.1"
                            min="0"
                            max={exportConfig.trimEnd}
                            onChange={(e) => handleTrimChange(Number(e.target.value), exportConfig.trimEnd)}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                         />
                     </div>
                     <div className="flex-1">
                         <label className="text-xs text-zinc-500 mb-1 block">End</label>
                         <input 
                            type="number" 
                            value={exportConfig.trimEnd.toFixed(2)}
                            step="0.1"
                            min={exportConfig.trimStart}
                            max={duration}
                            onChange={(e) => handleTrimChange(exportConfig.trimStart, Number(e.target.value))}
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                         />
                     </div>
                 </div>
            </div>

            {/* Audio Upload */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                 <h4 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Music className="w-4 h-4" /> Background Audio
                 </h4>
                 {exportConfig.bgMusicFile ? (
                     <div className="flex items-center justify-between bg-zinc-800 p-2 rounded-lg">
                         <div className="flex items-center gap-2 overflow-hidden">
                             <Music className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                             <span className="text-sm truncate text-zinc-300">{exportConfig.bgMusicFile.name}</span>
                         </div>
                         <button 
                            onClick={() => onUpdateConfig({ bgMusicFile: null })}
                            className="text-xs text-red-400 hover:text-red-300 ml-2"
                         >
                             Remove
                         </button>
                     </div>
                 ) : (
                    <div className="relative group">
                        <input 
                            type="file" 
                            accept="audio/*"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    onUpdateConfig({ bgMusicFile: e.target.files[0] });
                                }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="border border-dashed border-zinc-700 rounded-lg p-3 text-center transition-colors group-hover:border-cyan-500 group-hover:bg-zinc-800/50">
                            <span className="text-xs text-zinc-500 group-hover:text-cyan-400">Click to add Background Music (MP3/WAV)</span>
                        </div>
                    </div>
                 )}
            </div>
        </div>
    </div>
  );
};

export default VideoPreview;