export enum AssetType {
  IMAGE = 'image',
  AUDIO = 'audio',
  MUSIC = 'music'
}

export interface AssetItem {
  id: string;
  file: File;
  type: AssetType;
  previewUrl: string;
}

export enum AnimationType {
  PAN_ZOOM = 'pan_zoom',
  ZOOM_IN = 'zoom_in',
  STATIC = 'static',
  SLIDE_LEFT = 'slide_left',
  SLIDE_RIGHT = 'slide_right'
}

export enum TransitionType {
  FADE = 'fade',
  CUT = 'cut',
  DISSOLVE = 'dissolve'
}

export interface TimelineSegment {
  startTime: number; // in seconds
  endTime: number; // in seconds
  assetId: string; // ID of the image to show
  caption: string;
  animation: AnimationType;
  transition: TransitionType;
}

export interface VideoConfig {
  aspectRatio: '16:9' | '9:16' | '1:1';
  style: 'Professional' | 'Modern' | 'Minimal';
  captionStyle: 'Classic' | 'Karaoke' | 'Bold';
}

export interface GenerationStatus {
  isGenerating: boolean;
  step: string; // 'uploading', 'analyzing', 'assembling'
  progress: number;
}