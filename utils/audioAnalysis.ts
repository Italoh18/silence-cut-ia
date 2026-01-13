import { AudioSegment, ExportFormat } from '../types';

export const extractAudioFromVideo = async (file: File): Promise<AudioBuffer> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
};

export const detectSilence = (
  audioBuffer: AudioBuffer,
  thresholdDb: number = -40,
  minSilenceDuration: number = 0.5 // seconds
): AudioSegment[] => {
  const rawData = audioBuffer.getChannelData(0); // Analyze first channel
  const samples = rawData.length;
  const sampleRate = audioBuffer.sampleRate;
  const segments: AudioSegment[] = [];
  
  // Convert dB to amplitude
  const threshold = Math.pow(10, thresholdDb / 20);
  
  let isCurrentlySilent = false;
  let segmentStart = 0;
  
  // Use a window to smooth out momentary peaks
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms window
  
  for (let i = 0; i < samples; i += windowSize) {
    // Calculate RMS of the window
    let sum = 0;
    const end = Math.min(i + windowSize, samples);
    for (let j = i; j < end; j++) {
      sum += rawData[j] * rawData[j];
    }
    const rms = Math.sqrt(sum / (end - i));
    
    const isSilentFrame = rms < threshold;
    const currentTime = i / sampleRate;

    if (i === 0) {
      isCurrentlySilent = isSilentFrame;
      segmentStart = 0;
    }

    if (isSilentFrame !== isCurrentlySilent) {
      // State change
      segments.push({
        start: segmentStart,
        end: currentTime,
        isSilent: isCurrentlySilent
      });
      isCurrentlySilent = isSilentFrame;
      segmentStart = currentTime;
    }
  }

  // Push final segment
  segments.push({
    start: segmentStart,
    end: samples / sampleRate,
    isSilent: isCurrentlySilent
  });

  // Filter out short silences (noise gating basically)
  const mergedSegments: AudioSegment[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    if (seg.isSilent && (seg.end - seg.start) < minSilenceDuration) {
      seg.isSilent = false;
    }
    
    if (mergedSegments.length > 0 && mergedSegments[mergedSegments.length - 1].isSilent === seg.isSilent) {
      mergedSegments[mergedSegments.length - 1].end = seg.end;
    } else {
      mergedSegments.push(seg);
    }
  }

  return mergedSegments;
};

// Helper to escape filenames for shell scripts
const escapeName = (name: string, platform: 'win' | 'unix') => {
    if (platform === 'unix') {
        // Escape quotes and backslashes
        return name.replace(/(["\\$`])/g, '\\$1');
    } else {
        // Windows batch is tricky, mostly just quotes around the whole thing works, 
        // but if filename has quotes, we replace them? 
        // Best effort:
        return name;
    }
};

export const generateFfmpegScript = (
  segments: AudioSegment[], 
  filename: string,
  platform: 'win' | 'unix',
  config: {
    format: ExportFormat,
    trimStart: number,
    trimEnd: number,
    bgMusicName?: string
  }
): string => {
  // Filter segments based on trim range and silence
  const activeSegments = segments.filter(s => {
    // Is it silent?
    if (s.isSilent) return false;
    // Is it completely outside trim range?
    if (s.end < config.trimStart || s.start > config.trimEnd) return false;
    return true;
  }).map(s => {
    // Clamp to trim range
    return {
      start: Math.max(s.start, config.trimStart),
      end: Math.min(s.end, config.trimEnd),
      isSilent: false
    };
  });

  const safeName = filename.replace(/\s+/g, '_').replace(/\.[^/.]+$/, "");
  const inputFilename = platform === 'unix' ? escapeName(filename, 'unix') : filename;
  const bgMusicFilename = config.bgMusicName ? (platform === 'unix' ? escapeName(config.bgMusicName, 'unix') : config.bgMusicName) : '';

  const ext = config.format;
  const isAudioOnly = ['mp3', 'wav', 'aac'].includes(ext);
  const outputName = `${safeName}_edited.${ext}`;
  
  // Codec selection
  let videoCodec = "libx264"; 
  let audioCodec = "aac";
  
  if (isAudioOnly) {
    videoCodec = "null"; // Not used
    if (ext === 'mp3') audioCodec = 'libmp3lame';
    if (ext === 'wav') audioCodec = 'pcm_s16le';
  } else {
      if (ext === 'avi') videoCodec = 'mpeg4';
      if (ext === 'mov') videoCodec = 'libx264'; // ensure mov uses x264 usually
  }

  // Common commands
  const concatFile = platform === 'win' ? 'segments\\list.txt' : 'segments/list.txt';
  const segmentDir = platform === 'win' ? 'segments\\' : 'segments/';

  let script = "";
  
  if (platform === 'unix') {
    script += `#!/bin/bash\n\n`;
    script += `# Process ${filename} to ${outputName}\n`;
    script += `mkdir -p segments\n`;
    script += `echo "Extracting valid segments..."\n\n`;
    
    let fileList = "";
    
    activeSegments.forEach((seg, index) => {
      const duration = (seg.end - seg.start).toFixed(4);
      const start = seg.start.toFixed(4);
      const segName = `part_${String(index).padStart(4, '0')}.${isAudioOnly ? ext : 'mp4'}`;
      
      const cmdVideo = isAudioOnly ? '-vn' : `-c:v ${videoCodec} -preset ultrafast`;
      
      script += `ffmpeg -y -i "${inputFilename}" -ss ${start} -t ${duration} ${cmdVideo} -c:a ${audioCodec} "${segmentDir}${segName}"\n`;
      fileList += `file '${segName}'\n`;
    });

    script += `\necho "${fileList}" > ${concatFile}\n\n`;
    script += `echo "Concatenating..."\n`;
    
    // Concatenate
    if (config.bgMusicName) {
       // With BG Music
       // Using intermediate temp file for concat
       script += `ffmpeg -y -f concat -safe 0 -i ${concatFile} -c copy "segments/temp_concat.${ext}"\n`;
       script += `echo "Adding background music (Main 100%, BG 20%)..."\n`;
       if (!isAudioOnly) {
           script += `ffmpeg -y -i "segments/temp_concat.${ext}" -i "${bgMusicFilename}" -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.2[a]" -map 0:v -map "[a]" -c:v copy -c:a ${audioCodec} "${outputName}"\n`;
       } else {
           script += `ffmpeg -y -i "segments/temp_concat.${ext}" -i "${bgMusicFilename}" -filter_complex "amix=inputs=2:duration=first:weights=1 0.2" -c:a ${audioCodec} "${outputName}"\n`;
       }
       script += `rm "segments/temp_concat.${ext}"\n`;
    } else {
       // Simple Concat
       script += `ffmpeg -y -f concat -safe 0 -i ${concatFile} -c copy "${outputName}"\n`;
    }
    
    script += `\necho "Done! Saved to ${outputName}"\n`;
    script += `rm -rf segments\n`;

  } else {
    // Windows Batch
    script += `@echo off\n`;
    script += `REM Process ${filename} to ${outputName}\n`;
    script += `mkdir segments\n`;
    script += `echo Extracting valid segments...\n\n`;
    
    let fileList = "";
    
    activeSegments.forEach((seg, index) => {
      const duration = (seg.end - seg.start).toFixed(4);
      const start = seg.start.toFixed(4);
      const segName = `part_${String(index).padStart(4, '0')}.${isAudioOnly ? ext : 'mp4'}`;
      
      const cmdVideo = isAudioOnly ? '-vn' : `-c:v ${videoCodec} -preset ultrafast`;
      
      // Note: Windows batch variable substitution might be an issue with special chars, 
      // but quoting usually handles standard spaces.
      script += `ffmpeg -y -i "${filename}" -ss ${start} -t ${duration} ${cmdVideo} -c:a ${audioCodec} "${segmentDir}${segName}"\n`;
      fileList += `file 'part_${String(index).padStart(4, '0')}.mp4'\n`;
    });

    script += `\n( \n`;
    fileList.split('\n').forEach(line => {
      if(line) script += `echo ${line}\n`;
    });
    script += `) > ${concatFile}\n\n`;
    
    script += `echo Concatenating...\n`;
    
    if (config.bgMusicName) {
         script += `ffmpeg -y -f concat -safe 0 -i ${concatFile} -c copy "segments\\temp_concat.${ext}"\n`;
         script += `echo Adding background music (Main 100%%, BG 20%%)...\n`;
         if (!isAudioOnly) {
             script += `ffmpeg -y -i "segments\\temp_concat.${ext}" -i "${config.bgMusicName}" -filter_complex "[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.2[a]" -map 0:v -map "[a]" -c:v copy -c:a ${audioCodec} "${outputName}"\n`;
         } else {
             script += `ffmpeg -y -i "segments\\temp_concat.${ext}" -i "${config.bgMusicName}" -filter_complex "amix=inputs=2:duration=first:weights=1 0.2" -c:a ${audioCodec} "${outputName}"\n`;
         }
         script += `del "segments\\temp_concat.${ext}"\n`;
    } else {
         script += `ffmpeg -y -f concat -safe 0 -i ${concatFile} -c copy "${outputName}"\n`;
    }

    script += `echo Done! Saved to ${outputName}\n`;
    script += `rmdir /s /q segments\n`;
    script += `pause\n`;
  }

  return script;
};