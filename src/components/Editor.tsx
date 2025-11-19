'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SavedStoryboardSession, TimelineItem } from '@/types';
import { Play, Pause, Plus, Image as ImageIcon, Mic, Sparkles, Save, Download, Settings, Music, Video, FolderOpen, ChevronDown, Loader2, Wand2, Maximize2, FileCode } from 'lucide-react';
import { motion, Reorder } from 'framer-motion';
import { generateFCPXML } from '@/utils/xmlGenerator';

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
                    setTimeline(prev => {
                        const newT = [...prev];
                        if (newT[index]) newT[index] = { ...newT[index], audioUrl, isGeneratingAudio: false };
                        return newT;
                    });
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

    // Visual
    const visualPromises = initialTimeline.map(async (item, index) => {
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
                        setTimeline(prev => {
                            const newT = [...prev];
                            if (newT[index]) newT[index] = { ...newT[index], image: data.image, isGeneratingVisual: false };
                            return newT;
                        });
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

  const handleAiPrompt = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      alert(`AI Command Received: ${prompt}\n(Timeline manipulation logic would go here)`);
      setPrompt('');
  };

  return (
    <div className="flex flex-col h-full bg-stone-900 text-white overflow-hidden">
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
                    {activeItem ? (
                        <>
                           {activeItem.image ? (
                               <img src={activeItem.image} className="w-full h-full object-cover" alt="Preview" />
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
                                 key={activeItem.id}
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 className="text-white text-lg font-medium text-shadow-lg bg-black/40 inline-block px-6 py-3 rounded-xl backdrop-blur-md border border-white/10"
                               >
                                   {activeItem.text}
                               </motion.p>
                           </div>
                           
                           {/* Simple transition overlay could go here */}
                           {activeItem.transition && activeItem.transition !== 'cut' && (
                               <div className="absolute inset-0 bg-black/0 pointer-events-none" />
                           )}
                        </>
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-stone-500">
                             <p>End of timeline</p>
                         </div>
                    )}
                    
                    {/* Play/Pause Overlay on Hover or Stop */}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer" onClick={() => setIsPlaying(true)}>
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
      <div className="h-1/3 bg-stone-900 border-t border-stone-800 flex flex-col">
        {/* Timeline Controls */}
        <div className="h-12 border-b border-stone-800 flex items-center px-4 gap-4 bg-stone-900">
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

        {/* Tracks */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 relative">
            <div className="flex gap-1 min-w-full pb-4">
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
        </div>

        {/* AI Command Bar */}
        <div className="h-14 bg-stone-950 border-t border-stone-800 p-2 flex items-center justify-center">
             <form onSubmit={handleAiPrompt} className="w-full max-w-2xl relative">
                <Sparkles className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-purple-500" />
                <input 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask AI to edit the video (e.g. 'Make the cuts faster', 'Add fade transitions')..."
                    className="w-full bg-stone-900 border border-stone-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 text-stone-300 placeholder-stone-600"
                />
             </form>
        </div>
      </div>
    </div>
  );
}
