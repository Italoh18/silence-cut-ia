export interface AudioSegment {
  start: number;
  end: number;
  isSilent: boolean;
}

export interface ProcessingStats {
  originalDuration: number;
  finalDuration: number;
  segmentsRemoved: number;
  silenceThresholdDb: number;
}

export interface AiAnalysisResult {
  title: string;
  summary: string;
  tags: string[];
  viralScore: number;
}

export enum ProcessingState {
  IDLE,
  ANALYZING_AUDIO,
  ANALYZING_AI,
  READY,
  ERROR
}

export type ExportFormat = 'mp4' | 'mov' | 'avi' | 'mp3' | 'wav' | 'aac';

export interface ExportConfig {
  format: ExportFormat;
  trimStart: number;
  trimEnd: number;
  bgMusicFile: File | null;
}
