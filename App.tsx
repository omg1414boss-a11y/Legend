import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { generateVideoScript } from './services/geminiService';
import { AssetItem, AssetType, TimelineSegment, VideoConfig, AnimationType, TransitionType } from './types';

// Icons
const Icons = {
  Upload: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  Play: () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  Pause: () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  Download: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Save: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Wand: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  Music: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
  X: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
};

const DefaultConfig: VideoConfig = {
  aspectRatio: '16:9',
  style: 'Professional',
  captionStyle: 'Classic'
};

export default function App() {
  // --- State ---
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [images, setImages] = useState<AssetItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineSegment[]>([]);
  const [config, setConfig] = useState<VideoConfig>(DefaultConfig);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Rendering State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  
  // Audio Context Refs to prevent recreation errors
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // --- Helpers ---
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newAssets: AssetItem[] = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        type: AssetType.IMAGE,
        previewUrl: URL.createObjectURL(file)
      }));
      setImages(prev => [...prev, ...newAssets]);
      
      // Preload images into DOM objects for canvas
      newAssets.forEach(asset => {
        const img = new Image();
        img.src = asset.previewUrl;
        imageCache.current.set(asset.id, img);
      });
    }
  };

  const audioUrl = useMemo(() => {
    return audioFile ? URL.createObjectURL(audioFile) : null;
  }, [audioFile]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const generateVideo = async () => {
    if (!audioFile || images.length === 0) return;
    setIsGenerating(true);
    try {
      const script = await generateVideoScript(audioFile, images, config);
      setTimeline(script);
    } catch (err) {
      console.error(err);
      alert("Error generating video script. Check console and API Key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadProject = () => {
    const data = JSON.stringify({ 
      config, 
      timeline, 
      images: images.map(i => ({ id: i.id, type: i.type, name: i.file.name })) // Don't serialize File objects
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Canvas Rendering Logic ---
  const drawFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Find current segment
    const segment = timeline.find(s => time >= s.startTime && time <= s.endTime);
    
    if (segment) {
      const img = imageCache.current.get(segment.assetId);
      if (img) {
        // Animation Calculations
        const segmentDuration = segment.endTime - segment.startTime;
        const progress = Math.max(0, Math.min(1, (time - segment.startTime) / segmentDuration));
        
        ctx.save();
        
        // --- Apply Animations ---
        let scale = 1;
        let translateX = 0;
        let translateY = 0;

        if (segment.animation === AnimationType.ZOOM_IN) {
          scale = 1 + (progress * 0.15); // Zoom from 1.0 to 1.15
        } else if (segment.animation === AnimationType.PAN_ZOOM) {
          scale = 1.1;
          translateX = (progress - 0.5) * 40; // Slight pan
        } else if (segment.animation === AnimationType.SLIDE_LEFT) {
          translateX = -50 * progress;
        }

        // --- Apply Transitions (Simple Fade In) ---
        if (segment.transition === TransitionType.FADE) {
          const fadeDuration = 0.5;
          if (time - segment.startTime < fadeDuration) {
            ctx.globalAlpha = (time - segment.startTime) / fadeDuration;
          }
        }

        // Draw Image (Cover fit)
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let drawW, drawH, offsetX, offsetY;

        if (imgAspect > canvasAspect) {
          drawH = height;
          drawW = height * imgAspect;
          offsetY = 0;
          offsetX = (width - drawW) / 2;
        } else {
          drawW = width;
          drawH = width / imgAspect;
          offsetX = 0;
          offsetY = (height - drawH) / 2;
        }

        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-width / 2 + translateX, -height / 2 + translateY);
        
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        ctx.restore();

        // --- Draw Caption ---
        if (segment.caption) {
          ctx.save();
          ctx.font = config.captionStyle === 'Bold' 
            ? 'bold 32px Inter, sans-serif' 
            : config.captionStyle === 'Karaoke' 
              ? 'italic 32px Inter, sans-serif' 
              : '28px Inter, sans-serif';
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = '#ffffff';

          const words = segment.caption.split(' ');
          let line = '';
          const lines = [];
          const maxWidth = width * 0.8;
          
          for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
              lines.push(line);
              line = words[n] + ' ';
            } else {
              line = testLine;
            }
          }
          lines.push(line);

          const lineHeight = 40;
          const startY = height - 50 - (lines.length * lineHeight);
          
          lines.forEach((l, i) => {
            const textWidth = ctx.measureText(l).width;
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect((width - textWidth)/2 - 10, startY + (i * lineHeight) - 30, textWidth + 20, 40);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(l, width / 2, startY + (i * lineHeight));
          });
          
          ctx.restore();
        }
      }
    }
  }, [timeline, config]);

  // --- Animation Loop ---
  const animate = useCallback(() => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      drawFrame(time);
      
      // Update render progress if rendering
      if (isRendering && duration > 0) {
        setRenderProgress(Math.min(100, (time / duration) * 100));
      }

      if (!audioRef.current.paused && !audioRef.current.ended) {
        requestRef.current = requestAnimationFrame(animate);
      } else if (audioRef.current.ended) {
        setIsPlaying(false);
        // If we were rendering, this loop stops, but logic handled in downloadVideo via onended
      }
    }
  }, [drawFrame, isRendering, duration]);

  useEffect(() => {
    if (isPlaying || isRendering) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isRendering, animate]);

  useEffect(() => {
    drawFrame(currentTime);
  }, [currentTime, drawFrame]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Play error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const getAudioSource = () => {
    const ctx = initAudioContext();
    if (!audioSourceRef.current && audioRef.current) {
      // Create source only once
      audioSourceRef.current = ctx.createMediaElementSource(audioRef.current);
    }
    return audioSourceRef.current;
  };

  const downloadVideo = () => {
    if (!canvasRef.current || !audioRef.current) return;
    
    setIsRendering(true);
    setRenderProgress(0);
    
    // Pause if playing
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
    
    // Audio Graph Setup
    const ctx = initAudioContext();
    const source = getAudioSource();
    const dest = ctx.createMediaStreamDestination();
    
    if (source) {
      // Connect to recorder
      source.connect(dest);
      // Also connect to speakers so user can hear process (optional, often better to hear it to know it's working)
      source.connect(ctx.destination);
    }

    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
    ]);

    const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' }); 
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-video.webm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        // Clean up UI state
        setIsRendering(false);
        setIsPlaying(false);
        
        // Reset audio connections if possible, but Audio API is tricky. 
        // We leave them connected or we'd have to tear down the graph.
        // For this app, leaving them connected is fine.
    };

    // Start
    recorder.start();
    audioRef.current.play().catch(e => console.error("Render Play error:", e));
    setIsPlaying(true); // Triggers animate loop

    // Stop when audio ends
    audioRef.current.onended = () => {
        recorder.stop();
        setIsPlaying(false);
    };
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans relative">
      
      {/* Rendering Modal Overlay */}
      {isRendering && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
           <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl text-center space-y-6">
              <div className="space-y-2">
                 <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Icons.Wand />
                 </div>
                 <h2 className="text-2xl font-bold text-white">Rendering Video</h2>
                 <p className="text-gray-400 text-sm">Please wait while we record the output. Do not close this tab.</p>
              </div>

              <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden border border-gray-700 relative">
                 <div 
                   className="h-full bg-gradient-to-r from-primary-600 to-purple-500 transition-all duration-300 ease-linear"
                   style={{ width: `${renderProgress}%` }}
                 />
              </div>
              <p className="text-primary-400 font-mono text-xl">{Math.round(renderProgress)}%</p>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Icons.Wand />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-400">
            AI Pro Video Creator
          </h1>
        </div>
        <button className="px-4 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700 transition">
          Reset Project
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* 1. Voice Upload */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">1. Voiceover</label>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 hover:border-primary-500 transition-colors cursor-pointer relative group bg-gray-800/50">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleAudioUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="p-3 bg-gray-800 rounded-full group-hover:bg-gray-700 transition">
                     <Icons.Upload />
                  </div>
                  <span className="text-sm text-gray-300">
                    {audioFile ? audioFile.name : "Drop mp3 or wav here"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Visuals Upload */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">2. Visual Assets</label>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 hover:border-primary-500 transition-colors cursor-pointer relative group bg-gray-800/50">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={handleImageUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                 <div className="flex flex-col items-center justify-center space-y-2 text-center">
                  <div className="p-3 bg-gray-800 rounded-full group-hover:bg-gray-700 transition">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <span className="text-sm text-gray-300">Upload Images/Clips</span>
                </div>
              </div>
              
              {/* Image Grid Preview */}
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {images.map(img => (
                    <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border border-gray-700 group">
                      <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Style Options */}
            <div className="space-y-4">
               <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">3. AI Style</label>
               
               <div className="space-y-2">
                 <span className="text-xs text-gray-500">Video Vibe</span>
                 <select 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={config.style}
                    onChange={e => setConfig({...config, style: e.target.value as any})}
                 >
                   <option>Professional</option>
                   <option>Modern</option>
                   <option>Minimal</option>
                 </select>
               </div>

               <div className="space-y-2">
                 <span className="text-xs text-gray-500">Caption Style</span>
                 <select 
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={config.captionStyle}
                    onChange={e => setConfig({...config, captionStyle: e.target.value as any})}
                 >
                   <option>Classic</option>
                   <option>Karaoke</option>
                   <option>Bold</option>
                 </select>
               </div>
            </div>

            {/* Generate Action */}
            <button 
              onClick={generateVideo}
              disabled={isGenerating || !audioFile || images.length === 0}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-95
                ${isGenerating 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 shadow-primary-500/25'
                }`}
            >
              {isGenerating ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing & Assembling...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Icons.Wand />
                  <span>Generate AI Video</span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 flex flex-col bg-gray-950 relative">
          {/* Canvas Wrapper */}
          <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-gray-950">
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-gray-800 bg-black aspect-video max-h-[80vh] w-full max-w-5xl">
              <canvas 
                ref={canvasRef} 
                width={1280} 
                height={720} 
                className="w-full h-full object-contain"
              />
              
              {/* Overlay Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center space-x-4 opacity-0 hover:opacity-100 transition-opacity">
                 <button onClick={togglePlay} className="p-2 rounded-full bg-white text-black hover:scale-110 transition">
                   {isPlaying ? <Icons.Pause /> : <Icons.Play />}
                 </button>
                 <input 
                    type="range" 
                    min={0} 
                    max={duration || 100} 
                    value={currentTime} 
                    onChange={(e) => {
                      const t = parseFloat(e.target.value);
                      if(audioRef.current) audioRef.current.currentTime = t;
                      setCurrentTime(t);
                    }}
                    className="flex-1 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500"
                 />
                 <span className="text-xs font-mono">{currentTime.toFixed(1)}s / {duration.toFixed(1)}s</span>
              </div>
            </div>
          </div>
          
          {/* Bottom Toolbar */}
          {timeline.length > 0 && (
            <div className="h-64 border-t border-gray-800 bg-gray-900 p-4 overflow-x-auto flex flex-col space-y-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-400">Timeline Assembly</h3>
                  <div className="flex items-center space-x-3">
                    <button 
                        onClick={downloadProject}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-800 border border-gray-700 hover:bg-gray-750 rounded-lg text-sm font-medium transition text-gray-300"
                        title="Instant Download of Project File"
                      >
                        <Icons.Save /> <span>Quick Save</span>
                    </button>
                    <button 
                      onClick={downloadVideo}
                      disabled={isRendering}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-sm font-bold text-white shadow-lg transition"
                    >
                      <Icons.Download /> 
                      <span>Render MP4</span>
                    </button>
                  </div>
                </div>
                
                {/* Visual Timeline Bar */}
                <div className="relative h-24 bg-gray-800 rounded-lg overflow-hidden flex whitespace-nowrap">
                   {timeline.map((seg, idx) => {
                     const segDuration = seg.endTime - seg.startTime;
                     const widthPercent = duration > 0 ? (segDuration / duration) * 100 : 0;
                     return (
                       <div 
                        key={idx} 
                        style={{ width: `${widthPercent}%` }}
                        className="h-full border-r border-gray-900 bg-gray-700 relative group overflow-hidden"
                       >
                         <img 
                          src={images.find(i => i.id === seg.assetId)?.previewUrl} 
                          className="absolute inset-0 w-full h-full object-cover opacity-50" 
                          alt=""
                         />
                         <div className="absolute inset-0 p-2 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent">
                            <span className="text-[10px] text-gray-300 truncate">{seg.caption}</span>
                            <div className="flex space-x-1 mt-1">
                               <span className="text-[9px] px-1 bg-primary-500/20 text-primary-300 rounded border border-primary-500/30">{seg.animation}</span>
                            </div>
                         </div>
                         {/* Hover info */}
                         <div className="absolute top-0 left-0 right-0 bg-black/60 p-1 text-[9px] opacity-0 group-hover:opacity-100 transition">
                           {seg.startTime.toFixed(1)}s - {seg.endTime.toFixed(1)}s
                         </div>
                       </div>
                     )
                   })}
                </div>
            </div>
          )}
        </main>
      </div>

      {/* Hidden Audio Element for playback */}
      {audioUrl && (
        <audio 
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}