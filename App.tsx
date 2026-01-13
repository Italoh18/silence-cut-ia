import React, { useState, useCallback, useEffect } from 'react';
import { 
  Wand2, 
  Download, 
  Settings2, 
  Terminal, 
  Film, 
  Sparkles,
  Loader2,
  MonitorPlay,
  FileAudio,
  FileVideo,
  Upload
} from 'lucide-react';
import FileUpload from './components/FileUpload';
import VideoPreview from './components/VideoPreview';
import ProcessingView from './components/ProcessingView';
import { AudioSegment, ProcessingState, AiAnalysisResult, ExportConfig, ExportFormat } from './types';
import { detectSilence, extractAudioFromVideo, generateFfmpegScript } from './utils/audioAnalysis';
import { analyzeContent } from './services/geminiService';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  
  // Detection Settings
  const [thresholdDb, setThresholdDb] = useState(-35);
  const [minSilenceDuration, setMinSilenceDuration] = useState(0.5);
  const [autoSkip, setAutoSkip] = useState(true);
  
  // Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  
  // Export & Edit Config
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
      format: 'mp4',
      trimStart: 0,
      trimEnd: 0,
      bgMusicFile: null
  });
  
  // Stats
  const [originalDuration, setOriginalDuration] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);

  // Initialize trim end when duration is known
  useEffect(() => {
    if (originalDuration > 0 && exportConfig.trimEnd === 0) {
        setExportConfig(prev => ({ ...prev, trimEnd: originalDuration }));
    }
  }, [originalDuration]);

  const processFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setState(ProcessingState.ANALYZING_AUDIO);
    
    // Reset configs
    setExportConfig(prev => ({
        ...prev,
        format: selectedFile.type.includes('audio') ? 'mp3' : 'mp4',
        trimStart: 0,
        trimEnd: 0, // Will be set after duration load
        bgMusicFile: null
    }));

    try {
      // 1. Audio Analysis (Local)
      const audioBuffer = await extractAudioFromVideo(selectedFile);
      const duration = audioBuffer.duration;
      setOriginalDuration(duration);
      setExportConfig(prev => ({ ...prev, trimEnd: duration }));
      
      const newSegments = detectSilence(audioBuffer, thresholdDb, minSilenceDuration);
      setSegments(newSegments);
      
      calculateFinalDuration(newSegments, 0, duration);
      
      setState(ProcessingState.READY);
    } catch (error) {
      console.error(error);
      setState(ProcessingState.ERROR);
    }
  }, [thresholdDb, minSilenceDuration]);

  const calculateFinalDuration = (segs: AudioSegment[], tStart: number, tEnd: number) => {
      // Calculate active duration respecting trim
      let dur = 0;
      segs.forEach(s => {
          if (s.isSilent) return;
          if (s.end < tStart || s.start > tEnd) return;
          
          const start = Math.max(s.start, tStart);
          const end = Math.min(s.end, tEnd);
          if (end > start) dur += (end - start);
      });
      setFinalDuration(dur);
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setThresholdDb(Number(e.target.value));
    if (file && state === ProcessingState.READY) {
       setState(ProcessingState.ANALYZING_AUDIO);
       extractAudioFromVideo(file).then(buffer => {
           const newSegments = detectSilence(buffer, Number(e.target.value), minSilenceDuration);
           setSegments(newSegments);
           calculateFinalDuration(newSegments, exportConfig.trimStart, exportConfig.trimEnd);
           setState(ProcessingState.READY);
       });
    }
  };

  // Update final duration when trim changes
  useEffect(() => {
      if (segments.length > 0) {
          calculateFinalDuration(segments, exportConfig.trimStart, exportConfig.trimEnd);
      }
  }, [exportConfig.trimStart, exportConfig.trimEnd, segments]);

  const handleAnalyzeAi = async () => {
    if (!file) return;
    setState(ProcessingState.ANALYZING_AI);
    const result = await analyzeContent(file.name);
    setAiAnalysis(result);
    setState(ProcessingState.READY);
  };

  const downloadScript = (platform: 'win' | 'unix') => {
    if (!file) return;
    const script = generateFfmpegScript(segments, file.name, platform, {
        format: exportConfig.format,
        trimStart: exportConfig.trimStart,
        trimEnd: exportConfig.trimEnd,
        bgMusicName: exportConfig.bgMusicFile?.name
    });
    
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = platform === 'win' ? 'process_media.bat' : 'process_media.sh';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLinkSubmit = async (link: string) => {
    setState(ProcessingState.ANALYZING_AI);
    const result = await analyzeContent("Linked Video", link);
    setAiAnalysis(result);
    // Don't reset file if it exists, but usually link analysis implies a new start. 
    // However, allowing link analysis + file upload is powerful.
    if (!file) {
      setSegments([]); 
    }
    setState(ProcessingState.READY);
  };

  const renderStats = () => {
    if (!originalDuration) return null;
    const saved = Math.max(0, (exportConfig.trimEnd - exportConfig.trimStart) - finalDuration);
    const percent = originalDuration > 0 ? Math.round((saved / originalDuration) * 100) : 0;
    
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
                <div className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Source Length</div>
                <div className="text-xl font-bold text-zinc-200">{originalDuration.toFixed(1)}s</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
                <div className="text-cyan-500 text-xs uppercase tracking-wider mb-1">Final Length</div>
                <div className="text-xl font-bold text-cyan-400">{finalDuration.toFixed(1)}s</div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-center">
                <div className="text-green-500 text-xs uppercase tracking-wider mb-1">Estimated Reduction</div>
                <div className="text-xl font-bold text-green-400">{percent}%</div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">
              SilentCut <span className="font-light text-zinc-600">AI Studio</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
             <div className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                Gemini 3 Flash Active
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        
        {/* Intro / Upload Section */}
        {!file && !aiAnalysis && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                 <div className="text-center max-w-2xl mx-auto mb-12">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                        Remove silence. <br />
                        <span className="text-cyan-400">Keep the magic.</span>
                    </h2>
                    <p className="text-zinc-400 text-lg">
                        Upload your raw footage. We'll use local audio processing to find the silence and Gemini AI to analyze the vibe.
                    </p>
                 </div>
                 <FileUpload 
                    onFileSelect={processFile} 
                    onLinkSubmit={handleLinkSubmit}
                    disabled={state === ProcessingState.ANALYZING_AUDIO} 
                 />
                 
                 {state === ProcessingState.ANALYZING_AUDIO && (
                     <div className="mt-8">
                         <ProcessingView />
                     </div>
                 )}
            </div>
        )}

        {/* Workspace Section */}
        {(file || aiAnalysis) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-500">
                
                {/* Left Column: Preview & Stats */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Mode: Analysis Only (No File) */}
                    {!file && aiAnalysis && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                                <Upload className="w-8 h-8 text-zinc-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-white mb-2">Upload File to Enable Editing</h3>
                                <p className="text-zinc-400 text-sm max-w-md mx-auto">
                                    You've analyzed the link, now upload the corresponding local video/audio file to remove silence and export.
                                </p>
                            </div>
                            <div className="pt-2">
                                <label className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium cursor-pointer transition-colors shadow-lg shadow-cyan-900/20">
                                    <Upload className="w-5 h-5" />
                                    <span>Select File</span>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="video/*,audio/*"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) processFile(e.target.files[0]);
                                        }}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {file && (
                        <>
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium flex items-center gap-2">
                                    <MonitorPlay className="w-5 h-5 text-zinc-500" />
                                    Smart Preview & Edit
                                </h3>
                                <button 
                                    onClick={() => { setFile(null); setAiAnalysis(null); setSegments([]); }} 
                                    className="text-sm text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                    Reset Project
                                </button>
                            </div>
                            
                            <VideoPreview 
                                file={file} 
                                segments={segments} 
                                autoSkip={autoSkip}
                                onAutoSkipToggle={setAutoSkip}
                                exportConfig={exportConfig}
                                onUpdateConfig={(cfg) => setExportConfig(prev => ({...prev, ...cfg}))}
                                duration={originalDuration}
                            />

                            {renderStats()}
                        </>
                    )}

                    {/* AI Analysis Result Card */}
                    {aiAnalysis && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                 <Sparkles className="w-32 h-32 text-cyan-500" />
                             </div>
                             <h3 className="text-cyan-400 font-bold mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> Gemini Analysis
                             </h3>
                             
                             <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-xs text-zinc-500 uppercase tracking-wider">Suggested Title</label>
                                    <p className="text-xl font-medium text-white">{aiAnalysis.title}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-500 uppercase tracking-wider">Summary</label>
                                    <p className="text-zinc-400 leading-relaxed">{aiAnalysis.summary}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {aiAnalysis.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs border border-zinc-700">#{tag}</span>
                                    ))}
                                </div>
                                <div>
                                     <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-zinc-500 uppercase tracking-wider">Viral Potential</span>
                                        <span className="text-cyan-400 font-bold">{aiAnalysis.viralScore}/100</span>
                                     </div>
                                     <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                         <div className="h-full bg-gradient-to-r from-cyan-600 to-blue-500" style={{ width: `${aiAnalysis.viralScore}%` }}></div>
                                     </div>
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Controls & Export */}
                <div className="space-y-6">
                    
                    {/* Detection Controls Panel */}
                    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6 ${!file ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-2 text-zinc-100 font-medium">
                            <Settings2 className="w-5 h-5 text-zinc-500" />
                            Detection Sensitivity
                        </div>
                        
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-zinc-400">Silence Threshold</span>
                                    <span className="text-cyan-400">{thresholdDb} dB</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="-60" 
                                    max="-10" 
                                    step="1"
                                    value={thresholdDb}
                                    onChange={handleThresholdChange}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                                />
                                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                    <span>Sensitive (-60dB)</span>
                                    <span>Strict (-10dB)</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-zinc-400">Min Silence Duration</span>
                                    <span className="text-cyan-400">{minSilenceDuration}s</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="2.0" 
                                    step="0.1"
                                    value={minSilenceDuration}
                                    onChange={(e) => {
                                        if (file) {
                                            setMinSilenceDuration(Number(e.target.value));
                                            setState(ProcessingState.ANALYZING_AUDIO);
                                            extractAudioFromVideo(file).then(buffer => {
                                                const newSegments = detectSilence(buffer, thresholdDb, Number(e.target.value));
                                                setSegments(newSegments);
                                                calculateFinalDuration(newSegments, exportConfig.trimStart, exportConfig.trimEnd);
                                                setState(ProcessingState.READY);
                                            });
                                        }
                                    }}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                                />
                            </div>

                            <div className="h-px bg-zinc-800"></div>

                            {!aiAnalysis ? (
                                <button 
                                    onClick={handleAnalyzeAi}
                                    disabled={state === ProcessingState.ANALYZING_AI || !file}
                                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    {state === ProcessingState.ANALYZING_AI ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    )}
                                    Analyze with Gemini
                                </button>
                            ) : (
                                <div className="text-center py-2 text-xs text-green-500 font-medium bg-green-500/10 rounded-lg border border-green-500/20">
                                    ✓ Content Analyzed
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Export Panel */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                         <div className="flex items-center gap-2 text-zinc-100 font-medium">
                            <Download className="w-5 h-5 text-zinc-500" />
                            Export Project
                        </div>
                        
                        {file ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Output Format</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['mp4', 'mov', 'avi'].map(fmt => (
                                        <button 
                                            key={fmt}
                                            onClick={() => setExportConfig(prev => ({...prev, format: fmt as ExportFormat}))}
                                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                                                exportConfig.format === fmt 
                                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' 
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                    {['mp3', 'wav', 'aac'].map(fmt => (
                                        <button 
                                            key={fmt}
                                            onClick={() => setExportConfig(prev => ({...prev, format: fmt as ExportFormat}))}
                                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                                                exportConfig.format === fmt 
                                                ? 'bg-purple-500/20 border-purple-500 text-purple-400' 
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                        >
                                            {fmt.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        
                            <p className="text-xs text-zinc-500 bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                                Download a processing script. Run this script in the folder containing your media file to generate the final high-quality output.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => downloadScript('win')}
                                    disabled={!file}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Terminal className="w-6 h-6 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-medium">Windows .bat</span>
                                </button>
                                <button 
                                    onClick={() => downloadScript('unix')}
                                    disabled={!file}
                                    className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Terminal className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                                    <span className="text-sm font-medium">Mac/Linux .sh</span>
                                </button>
                            </div>
                        </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-6 bg-zinc-800/20 border border-dashed border-zinc-800 rounded-xl text-center">
                                <FileVideo className="w-8 h-8 text-zinc-600 mb-2" />
                                <p className="text-sm text-zinc-400">
                                    File required for export.
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Upload the local video/audio file to generate the removal script.
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;