import React, { useCallback, useState } from 'react';
import { Upload, FileVideo, Link as LinkIcon, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onLinkSubmit: (link: string) => void;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onLinkSubmit, disabled }) => {
  const [dragActive, setDragActive] = useState(false);
  const [linkInput, setLinkInput] = useState('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        onFileSelect(file);
      }
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkInput.trim()) {
      onLinkSubmit(linkInput);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      
      {/* Drop Zone */}
      <div
        className={`relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out
          ${dragActive 
            ? 'border-cyan-500 bg-cyan-500/10 scale-[1.02]' 
            : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50'
          } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleChange}
          accept="video/*,audio/*"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className={`p-4 rounded-full bg-zinc-800 transition-transform duration-300 group-hover:scale-110 ${dragActive ? 'bg-cyan-500/20' : ''}`}>
            <Upload className={`w-8 h-8 ${dragActive ? 'text-cyan-400' : 'text-zinc-400'}`} />
          </div>
          <div>
            <p className="text-lg font-medium text-zinc-200">
              Drag & Drop or Select from your Computer
            </p>
            <p className="text-sm text-zinc-500 mt-1">
              Supports MP4, MOV, MKV, MP3, WAV from any directory
            </p>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">
            Browse Files
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="h-px flex-1 bg-zinc-800"></div>
        <span className="text-xs text-zinc-600 font-uppercase tracking-wider">OR USE A LINK</span>
        <div className="h-px flex-1 bg-zinc-800"></div>
      </div>

      {/* Link Input */}
      <form onSubmit={handleLinkSubmit} className={`relative flex items-center ${disabled ? 'opacity-50' : ''}`}>
        <div className="absolute left-3 text-zinc-500">
            <LinkIcon className="w-5 h-5" />
        </div>
        <input 
            type="url" 
            placeholder="Paste YouTube or generic video link..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            disabled={disabled}
            className="w-full bg-zinc-900/50 border border-zinc-700 text-zinc-200 pl-10 pr-24 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all placeholder-zinc-600"
        />
        <button 
            type="submit"
            disabled={!linkInput || disabled}
            className="absolute right-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            Analyze
        </button>
      </form>
      
      {/* Link Disclaimer */}
      <div className="flex items-start gap-2 text-xs text-amber-500/80 bg-amber-950/20 p-3 rounded-lg border border-amber-900/30">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
            <strong>Note on Links:</strong> Due to browser security restrictions, we cannot download YouTube videos directly for processing. 
            However, we can analyze the link's metadata with AI. To remove silence, please download the video and upload it here.
        </p>
      </div>

    </div>
  );
};

export default FileUpload;