'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SavedStoryboardSession, TimelineItem } from '@/types';
import { Play, Pause, Plus, Image as ImageIcon, Mic, Sparkles, Save, Download, Settings, Music, Video, FolderOpen, ChevronDown, Loader2, Wand2, Maximize2, FileCode, Wand, MoveHorizontal, X, Edit3 } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { generateFCPXML } from '@/utils/xmlGenerator';

interface PendingEdit {
    id: string;
    start: number;
    end: number;
    prompt?: string;
}

export function Editor() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [savedSessions, setSavedSessions] = useState<SavedStoryboardSession[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [addEffects, setAddEffects] = useState(false);
  
  // Interpretive Editor State
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [tempSelection, setTempSelection] = useState<{ start: number, end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Playback Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
        interval = setInterval(() => {
            setCurrentTime(prev => {
                const totalDuration = timeline.reduce((acc, item) => acc + item.duration, 0);
                if (prev >= totalDuration) {
                    setIsPlaying(false);
                    return 0;
                }
                return prev + 0.1; // Update every 100ms
            });
        }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeline]);

  // Load Saved Sessions
  useEffect(() => {
    const saved = localStorage.getItem('storyboard_sessions');
    if (saved) {
      try {
        setSavedSessions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved sessions', e);
      }
    }
  }, []);

  const totalDuration = timeline.reduce((acc, item) => acc + item.duration, 0);

  const getCurrentItem = () => {
      let elapsed = 0;
      for (const item of timeline) {
          if (currentTime >= elapsed && currentTime < elapsed + item.duration) {
              return { item, startTime: elapsed };
          }
          elapsed += item.duration;
      }
      return null;
  };

  const current = getCurrentItem();
  const activeItem = current?.item;

  // Audio Sync Effect
  useEffect(() => {
      if (!audioRef.current) return;
      
      if (isPlaying && activeItem?.audioUrl) {
          const expectedTime = currentTime - (current?.startTime || 0);
          
          // If source changed, load new
          if (!audioRef.current.src.includes(activeItem.audioUrl) && activeItem.audioUrl) {
              audioRef.current.src = activeItem.audioUrl;
              audioRef.current.currentTime = expectedTime;
              audioRef.current.play().catch(e => console.log("Audio play failed", e));
          } 
          // If paused but should be playing
          else if (audioRef.current.paused) {
              audioRef.current.play().catch(e => console.log("Audio resume failed", e));
          }
          
          // Sync if drift is too large (> 0.3s)
          if (Math.abs(audioRef.current.currentTime - expectedTime) > 0.3) {
              audioRef.current.currentTime = expectedTime;
          }
      } else {
          // Pause if not playing or no audio
          if (!audioRef.current.paused) {
             audioRef.current.pause();
          }
      }
  }, [activeItem, isPlaying, currentTime, current?.startTime]);


  // Format Time
  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 100);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
  };

  const importSession = (session: SavedStoryboardSession) => {
    const newItems: TimelineItem[] = session.storyboard.map(scene => ({
      ...scene,
      duration: 5, // Default 5 seconds per scene
      transition: 'cut',
    }));
    
    setTimeline(prev => [...prev, ...newItems]);
    setShowLoadMenu(false);
  };

  const fillInAssets = async () => {
    setIsGeneratingAssets(true);
    setGenerationStatus('Generating assets in parallel...');

    const initialTimeline = [...timeline];
    
    // Audio
    const audioPromises = initialTimeline.map(async (item, index) => {
        if (!item.audioUrl) {
            setTimeline(prev => {
                const newT = [...prev];
                if (newT[index]) newT[index] = { ...newT[index], isGeneratingAudio: true };
                return newT;
            });

            try {
                const response = await fetch('/api/elevenlabs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: item.text })
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const audioUrl = URL.createObjectURL(blob);

                    // Check duration
                    const audio = new Audio(audioUrl);
                    audio.onloadedmetadata = () => {
                         const duration = Math.max(5, Math.ceil(audio.duration)); // Min 5s or audio duration
                         setTimeline(prev => {
                            const newT = [...prev];
                            if (newT[index]) newT[index] = { 
                                ...newT[index], 
                                audioUrl, 
                                isGeneratingAudio: false,
                                duration: duration 
                            };
                            return newT;
                        });
                    };

                } else {
                     setTimeline(prev => {
                        const newT = [...prev];
                        if (newT[index]) newT[index] = { ...newT[index], isGeneratingAudio: false };
                        return newT;
                    });
                }
            } catch (e) {
                setTimeline(prev => {
                    const newT = [...prev];
                    if (newT[index]) newT[index] = { ...newT[index], isGeneratingAudio: false };
                    return newT;
                });
            }
        }
    });

    // Visual & Effects
    const visualPromises = initialTimeline.map(async (item, index) => {
        let needsUpdate = false;
        const updates: Partial<TimelineItem> = {};

        // Apply Effects if requested and missing
        if (addEffects && !item.effect) {
             const effects: TimelineItem['effect'][] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
             updates.effect = effects[Math.floor(Math.random() * effects.length)];
             needsUpdate = true;
        }

        if (!item.image) {
            setTimeline(prev => {
                const newT = [...prev];
                if (newT[index]) newT[index] = { ...newT[index], isGeneratingVisual: true };
                return newT;
            });

            try {
                const response = await fetch('/api/generate-visual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        prompt: `Cinematic shot: ${item.notes || item.text}. High quality, photorealistic, 4k.` 
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.image) {
                        updates.image = data.image;
                        updates.isGeneratingVisual = false;
                        needsUpdate = true;
                    }
                } else {
                     setTimeline(prev => {
                        const newT = [...prev];
                        if (newT[index]) newT[index] = { ...newT[index], isGeneratingVisual: false };
                        return newT;
                    });
                }
            } catch (e) {
                 setTimeline(prev => {
                    const newT = [...prev];
                    if (newT[index]) newT[index] = { ...newT[index], isGeneratingVisual: false };
                    return newT;
                 });
            }
        }
        
        if (needsUpdate) {
            setTimeline(prev => {
                const newT = [...prev];
                if (newT[index]) newT[index] = { ...newT[index], ...updates };
                return newT;
            });
        }
    });

    await Promise.all([...audioPromises, ...visualPromises]);

    setGenerationStatus('');
    setIsGeneratingAssets(false);
  };

  const handleExpandVideo = async () => {
      if (timeline.length === 0) return;
      setIsExpanding(true);
      setGenerationStatus('Expanding video narrative...');
      
      try {
          const response = await fetch('/api/editor-expand', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ timeline })
          });

          if (response.ok) {
              const data = await response.json();
              if (data.timeline) {
                  setTimeline(data.timeline);
                  setCurrentTime(0); // Reset playhead
              }
          }
      } catch (e) {
          console.error("Expand failed", e);
      } finally {
          setIsExpanding(false);
          setGenerationStatus('');
      }
  };

  const handleExportXML = () => {
      const xmlContent = generateFCPXML(timeline, "My AI Movie");
      const blob = new Blob([xmlContent], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyboard_export_${Date.now()}.fcpxml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handlePendingEditSubmit = async (edit: PendingEdit, promptValue: string) => {
      setGenerationStatus('Interpreting instructions...');
      setIsExpanding(true);

      try {
            const response = await fetch('/api/editor-interpret', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timeline, selection: { start: edit.start, end: edit.end }, prompt: promptValue })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.modifiedScenes) {
                    const relevantIndices: number[] = [];
                    let elapsed = 0;
                    timeline.forEach((item, idx) => {
                        const end = elapsed + item.duration;
                        if (elapsed < edit.end && end > edit.start) {
                            relevantIndices.push(idx);
                        }
                        elapsed += item.duration;
                    });
                    
                    if (relevantIndices.length > 0) {
                        const startIdx = relevantIndices[0];
                        const count = relevantIndices.length;
                        
                        const newTimeline = [...timeline];
                        newTimeline.splice(startIdx, count, ...data.modifiedScenes);
                        setTimeline(newTimeline);
                        
                        // Remove the pending edit
                        setPendingEdits(prev => prev.filter(e => e.id !== edit.id));
                        setActiveEditId(null);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsExpanding(false);
            setGenerationStatus('');
        }
  };

  const handleAiPrompt = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      
      // Check if there is an active pending edit to apply this to
      if (activeEditId) {
          const edit = pendingEdits.find(e => e.id === activeEditId);
          if (edit) {
              await handlePendingEditSubmit(edit, prompt);
              setPrompt('');
              return;
          }
      }

      // Fallback global command behavior
      alert(`Global AI Command: ${prompt}`);
      setPrompt('');
  };


  // Interpretive Editor Mouse Handlers
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
      if (!timelineRef.current || timeline.length === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * totalDuration;
      
      setIsSelecting(true);
      setTempSelection({ start: time, end: time });
      setActiveEditId(null); // Deselect existing
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
      if (!isSelecting || !timelineRef.current || !tempSelection) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * totalDuration;
      
      setTempSelection({ ...tempSelection, end: time });
  };

  const handleTimelineMouseUp = () => {
      if (isSelecting && tempSelection) {
          const start = Math.min(tempSelection.start, tempSelection.end);
          const end = Math.max(tempSelection.start, tempSelection.end);
          
          if (end - start > 0.5) {
              // Create new pending edit
              const newEdit: PendingEdit = {
                  id: Math.random().toString(36).substring(7),
                  start,
                  end
              };
              setPendingEdits(prev => [...prev, newEdit]);
              setActiveEditId(newEdit.id); // Auto-select
          }
      }
      setIsSelecting(false);
      setTempSelection(null);
  };

  const effectVariants = {
    'zoom-in': { scale: [1, 1.2] },
    'zoom-out': { scale: [1.2, 1] },
    'pan-left': { x: ['0%', '-10%'], scale: 1.1 },
    'pan-right': { x: ['-10%', '0%'], scale: 1.1 },
    'static': { scale: 1 }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 text-white overflow-hidden" onMouseUp={handleTimelineMouseUp}>
      <audio ref={audioRef} className="hidden" />
      
      {/* Header / Toolbar */}
      <div className="h-14 border-b border-stone-800 flex items-center justify-between px-4 bg-stone-900/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
            <h2 className="font-bold text-lg tracking-tight">Timeline Editor</h2>
            
            <div className="relative">
                <button 
                    onClick={() => setShowLoadMenu(!showLoadMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 rounded-lg text-xs hover:bg-stone-700 transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    Import Storyboard
                    <ChevronDown className="w-3 h-3" />
                </button>
                
                {showLoadMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-stone-800 rounded-lg shadow-xl border border-stone-700 py-2 max-h-64 overflow-y-auto z-20">
                        {savedSessions.length === 0 ? (
                            <div className="px-4 py-2 text-sm text-stone-500">No saved sessions</div>
                        ) : (
                            savedSessions.map(session => (
                                <button
                                    key={session.id}
                                    onClick={() => importSession(session)}
                                    className="w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 flex items-center justify-between group"
                                >
                                    <span className="truncate max-w-[140px]">{session.name}</span>
                                    <span className="text-xs text-stone-500">
                                        {new Date(session.timestamp).toLocaleDateString()}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            <button 
                onClick={handleExpandVideo}
                disabled={timeline.length === 0 || isExpanding}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 rounded-lg text-xs hover:bg-stone-700 transition-colors disabled:opacity-50"
                title="Expand Narrative"
            >
                {isExpanding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Maximize2 className="w-3 h-3" />}
                Expand Video
            </button>
        </div>
        
        <div className="flex items-center gap-2">
            {(isGeneratingAssets || isExpanding) && (
                <span className="text-xs text-purple-400 animate-pulse mr-2">{generationStatus}</span>
            )}

            {/* Effects Toggle */}
            <div 
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${addEffects ? 'bg-stone-700 text-purple-300' : 'hover:bg-stone-800 text-stone-400'}`}
                onClick={() => setAddEffects(!addEffects)}
                title="Add pan/zoom effects to generated visuals"
            >
                <Wand className="w-3 h-3" />
                <span className="text-xs">Effects</span>
                <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${addEffects ? 'border-purple-500 bg-purple-500' : 'border-stone-600'}`}>
                    {addEffects && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                </div>
            </div>

            <button 
                onClick={fillInAssets}
                disabled={timeline.length === 0 || isGeneratingAssets}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-all"
            >
                {isGeneratingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Fill Missing Assets
            </button>
            <button 
                onClick={handleExportXML}
                disabled={timeline.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                title="Export to FCPXML"
            >
                <FileCode className="w-4 h-4" />
                Export XML
            </button>
        </div>
      </div>

      {/* Main Content Area (Preview + Properties) */}
      <div className="flex-1 flex overflow-hidden">
          {/* Preview Monitor */}
          <div className="flex-1 bg-black flex items-center justify-center relative p-4">
             {timeline.length > 0 ? (
                 <div className="aspect-video bg-stone-900 w-full max-w-4xl relative overflow-hidden shadow-2xl border border-stone-800 rounded-lg">
                    <AnimatePresence mode='wait'>
                    {activeItem ? (
                        <motion.div
                            key={activeItem.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="relative w-full h-full overflow-hidden"
                        >
                           {activeItem.image ? (
                               <motion.img 
                                    src={activeItem.image} 
                                    alt="Preview"
                                    variants={effectVariants}
                                    animate={isPlaying ? (activeItem.effect || 'static') : 'static'} // Only play effect when playing
                                    transition={{ duration: activeItem.duration, ease: "linear" }}
                                    className="w-full h-full object-cover origin-center"
                               />
                           ) : (
                               <div className="w-full h-full flex items-center justify-center text-stone-600">
                                   <div className="text-center">
                                       <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                       <span className="text-sm uppercase tracking-widest opacity-50">Generating Visual...</span>
                                   </div>
                               </div>
                           )}
                           
                           <div className="absolute bottom-8 left-0 right-0 text-center px-8">
                               <motion.p 
                                 key={`text-${activeItem.id}`}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 className="text-white text-lg font-medium text-shadow-lg bg-black/40 inline-block px-6 py-3 rounded-xl backdrop-blur-md border border-white/10"
                               >
                                   {activeItem.text}
                               </motion.p>
                           </div>
                        </motion.div>
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-stone-500">
                             <p>End of timeline</p>
                         </div>
                    )}
                    </AnimatePresence>
                    
                    {/* Play/Pause Overlay on Hover or Stop */}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer z-10" onClick={() => setIsPlaying(true)}>
                            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-full border border-white/20 hover:scale-110 transition-transform">
                                <Play className="w-8 h-8 fill-white text-white" />
                            </div>
                        </div>
                    )}
                 </div>
             ) : (
                 <div className="text-stone-600 flex flex-col items-center">
                     <Video className="w-16 h-16 mb-4 opacity-20" />
                     <p>Import a storyboard to begin editing</p>
                 </div>
             )}
          </div>
      </div>

      {/* Timeline Panel */}
      <div className="h-[40%] bg-stone-900 border-t border-stone-800 flex flex-col">
        {/* Timeline Controls */}
        <div className="h-12 border-b border-stone-800 flex items-center px-4 gap-4 bg-stone-900 shrink-0">
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 hover:bg-stone-800 rounded-full transition-colors text-white"
            >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <div className="text-xs font-mono text-stone-400 bg-stone-950 px-2 py-1 rounded border border-stone-800">
                {formatTime(currentTime)} <span className="text-stone-600">/</span> {formatTime(totalDuration)}
            </div>
            <div className="flex-1 relative h-6 flex items-center group">
                {/* Scrubber Track */}
                <div className="absolute inset-x-0 h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-purple-900/30" 
                        style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                    />
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max={totalDuration || 100} 
                    step="0.1"
                    value={currentTime}
                    onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                    className="w-full h-6 opacity-0 cursor-pointer z-10 relative" 
                />
                {/* Visible Scrubber Thumb */}
                <div 
                    className="absolute h-3 w-1 bg-purple-500 rounded-full pointer-events-none transition-all"
                    style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                />
            </div>
        </div>

        {/* Tracks Container */}
        <div className="flex-1 overflow-hidden flex flex-col">
            {/* Scrollable Tracks Area */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4 relative flex flex-col gap-4">
                
                {/* Main Video Track */}
                <div className="flex gap-1 min-w-full shrink-0">
                    <Reorder.Group axis="x" values={timeline} onReorder={setTimeline} className="flex gap-1">
                        {timeline.map((item, idx) => (
                            <Reorder.Item key={item.id || idx} value={item}>
                                <motion.div 
                                    layout
                                    onClick={() => {
                                        // Jump to start of this clip
                                        let start = 0;
                                        for (let i = 0; i < idx; i++) start += timeline[i].duration;
                                        setCurrentTime(start);
                                    }}
                                    className={`w-48 h-32 rounded-lg border relative group overflow-hidden cursor-pointer transition-all shrink-0 ${
                                        activeItem?.id === item.id ? 'border-purple-500 ring-1 ring-purple-500/50' : 'border-stone-700 hover:border-stone-500'
                                    }`}
                                >
                                    {/* Visual Track Preview */}
                                    <div className="h-20 bg-stone-850 w-full relative overflow-hidden">
                                        {item.isGeneratingVisual ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-stone-800/50 backdrop-blur-sm">
                                                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                            </div>
                                        ) : item.image ? (
                                            <img src={item.image} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-800">
                                                <ImageIcon className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div className="absolute top-1 left-1 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-white">
                                            {idx + 1}
                                        </div>
                                        {item.transition && item.transition !== 'cut' && (
                                            <div className="absolute bottom-1 right-1 bg-purple-900/80 text-[8px] px-1 py-0.5 rounded text-purple-200 uppercase font-bold">
                                                {item.transition}
                                            </div>
                                        )}
                                        {item.effect && (
                                            <div className="absolute top-1 right-1 bg-stone-900/80 text-[8px] px-1 py-0.5 rounded text-stone-300 uppercase border border-stone-700">
                                                {item.effect}
                                            </div>
                                        )}
                                    </div>

                                    {/* Audio/Text Track Indicator */}
                                    <div className="h-12 p-2 flex flex-col justify-between bg-stone-800 border-t border-stone-700">
                                        <div className="flex items-center gap-2 text-[10px] text-stone-400">
                                            <Music className={`w-3 h-3 ${item.audioUrl ? 'text-green-400' : 'text-stone-600'}`} />
                                            {item.isGeneratingAudio ? (
                                                <Loader2 className="w-3 h-3 animate-spin text-green-500" />
                                            ) : (
                                                <span className="truncate">{item.audioUrl ? 'Voiceover Ready' : 'No Audio'}</span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-stone-500 truncate">{item.text}</p>
                                    </div>
                                    
                                    {/* Is New Indicator */}
                                    {(item as any).isNew && (
                                        <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl-lg" title="New Scene" />
                                    )}
                                </motion.div>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                    
                    {/* Add Placeholder */}
                    <div className="w-48 h-32 border-2 border-dashed border-stone-800 rounded-lg flex items-center justify-center text-stone-700 hover:text-stone-500 hover:border-stone-700 transition-colors cursor-pointer shrink-0 opacity-50 hover:opacity-100">
                        <Plus className="w-6 h-6" />
                    </div>
                </div>

                {/* Interpretive Editor Track */}
                <div className="h-24 relative w-full shrink-0">
                    <div 
                        ref={timelineRef}
                        className="w-full h-full bg-stone-900 rounded-lg cursor-crosshair relative overflow-hidden border border-stone-800 hover:border-stone-700 transition-colors"
                        onMouseDown={handleTimelineMouseDown}
                        onMouseMove={handleTimelineMouseMove}
                        title="Drag to select a range for Interpretive Editing"
                    >
                        {/* Grid lines or markers could go here */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                            <MoveHorizontal className="w-4 h-4" />
                            <span className="text-xs font-medium ml-2 tracking-wide">Interpretive Editor Track</span>
                        </div>

                        {/* Existing Pending Edits */}
                        {pendingEdits.map(edit => (
                            <div
                                key={edit.id}
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent triggering mouse down for new selection
                                    setActiveEditId(edit.id);
                                }}
                                className={`absolute top-3 bottom-3 rounded-xl border-2 cursor-pointer backdrop-blur-sm transition-all flex items-center justify-center group z-10 ${
                                    activeEditId === edit.id 
                                        ? 'bg-purple-500/20 border-purple-400 z-20 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                                        : 'bg-stone-800/60 border-stone-600 hover:bg-stone-700/60 hover:border-stone-500'
                                }`}
                                style={{
                                    left: `${(Math.min(edit.start, edit.end) / totalDuration) * 100}%`,
                                    width: `${(Math.abs(edit.end - edit.start) / totalDuration) * 100}%`
                                }}
                            >
                                {activeEditId === edit.id ? (
                                    <Edit3 className="w-4 h-4 text-white" />
                                ) : (
                                    <Sparkles className="w-4 h-4 text-purple-400 opacity-50 group-hover:opacity-100" />
                                )}
                                
                                {/* Remove Button */}
                                {activeEditId === edit.id && (
                                    <div 
                                        className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 cursor-pointer hover:bg-red-600 shadow-sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPendingEdits(prev => prev.filter(p => p.id !== edit.id));
                                            setActiveEditId(null);
                                        }}
                                    >
                                        <X className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Temporary Selection Visualization */}
                        {tempSelection && totalDuration > 0 && (
                            <div 
                                className="absolute top-3 bottom-3 bg-stone-500/20 border-2 border-stone-400/50 rounded-xl backdrop-blur-[1px] pointer-events-none"
                                style={{
                                    left: `${(Math.min(tempSelection.start, tempSelection.end) / totalDuration) * 100}%`,
                                    width: `${(Math.abs(tempSelection.end - tempSelection.start) / totalDuration) * 100}%`
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* AI Command Bar (Fixed at Bottom) */}
            <div className={`h-16 border-t border-stone-800 p-3 flex items-center justify-center transition-colors shrink-0 z-20 ${activeEditId ? 'bg-purple-900/10' : 'bg-stone-950'}`}>
                 <form onSubmit={handleAiPrompt} className="w-full max-w-2xl relative">
                    <Sparkles className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${activeEditId ? 'text-white animate-pulse' : 'text-purple-500'}`} />
                    <input 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={activeEditId ? `Describe changes for selected region...` : "Ask AI to edit the video (e.g. 'Make the cuts faster')..."}
                        className={`w-full bg-stone-900 border rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 text-stone-300 placeholder-stone-600 transition-all ${
                            activeEditId 
                                ? 'border-purple-500/50 focus:border-purple-500 focus:ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                                : 'border-stone-800 focus:border-purple-500/50 focus:ring-purple-500/50'
                        }`}
                    />
                    {activeEditId && (
                        <button 
                            type="button" 
                            onClick={() => setActiveEditId(null)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-300"
                        >
                            Deselect
                        </button>
                    )}
                 </form>
            </div>
        </div>
      </div>
    </div>
  );
}
