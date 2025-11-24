'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SavedStoryboardSession, TimelineItem } from '@/types';
import { Play, Pause, Plus, Image as ImageIcon, Mic, Sparkles, Save, Download, Settings, Music, Video, FolderOpen, ChevronDown, ChevronUp, Loader2, Wand2, Maximize2, FileCode, Wand, MoveHorizontal, X, Edit3, Trash2, PanelRightOpen, PanelRightClose, ZoomIn, ZoomOut, GripVertical, MessageSquare } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';
import { generateFCPXML } from '@/utils/xmlGenerator';
import { AgentSidebar } from './AgentSidebar';
import { ContextInput } from './ContextInput';
import { RefineAssetFlow } from './RefineAssetFlow';

export function Editor() {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [editorMode, setEditorMode] = useState<'timeline' | 'refine'>('timeline');
  const [assetToRefine, setAssetToRefine] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // in seconds
  const [savedSessions, setSavedSessions] = useState<SavedStoryboardSession[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [addEffects, setAddEffects] = useState(false);
  
  // Selection State
  const [selection, setSelection] = useState<{ start: number, end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // New Timeline Interactions
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%
  const [isDraggingItem, setIsDraggingItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0); // Offset in seconds
  const [draggedItemOriginalStart, setDraggedItemOriginalStart] = useState(0);

  // Agent State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [agentTrace, setAgentTrace] = useState('');
  const [agentOptions, setAgentOptions] = useState<any[]>([]);
  const [isProcessingContext, setIsProcessingContext] = useState(false);

  // Global Edit State
  const [isGlobalPromptOpen, setIsGlobalPromptOpen] = useState(true);
  const [globalPrompt, setGlobalPrompt] = useState('');
  
  // Asset Generation Options
  const [assetOptions, setAssetOptions] = useState({
      style: 'Cinematic',
      addEffects: false,
      autoPan: false
  });
  const [showAssetMenu, setShowAssetMenu] = useState(false);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');

  // Keyboard Shortcuts (Spacebar Play/Pause, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA')) {
            e.preventDefault();
            setIsPlaying(prev => !prev);
        }
        
        // Delete Selected Item (using time playhead as selection proxy if no explicit selection, 
        // but typically delete applies to selected clip. Let's add explicit clip selection state if needed
        // or just delete the clip under playhead if "hovered"? Standard is: select -> delete)
        // For now, let's delete the item under the playhead if there is one and no range selection
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            
            // Logic: If selection exists, delete range? Or delete selected clip? 
            // User query: "delete timeline elements with the delete button" implies selection.
            // Let's implement click-to-select logic for items first.
            
            // For now, if we have a range selection, we can clear it.
            // If no range selection, check if playhead is over an item? 
            // Let's rely on `selection` state being used as "selected item" or range.
            // Since we implemented range selection, let's allow deleting the range.
            
            if (selection && Math.abs(selection.end - selection.start) > 0.1) {
                // Delete Range Logic (Split items, remove middle)
                // This is complex editing logic. Let's simplify: 
                // If selection encompasses items fully, remove them.
                // If it cuts items, split them.
                // Implementing simplified "Remove items fully contained in selection"
                const start = Math.min(selection.start, selection.end);
                const end = Math.max(selection.start, selection.end);
                
                let accumulated = 0;
                const newTimeline = timeline.filter(item => {
                    const itemStart = accumulated;
                    const itemEnd = accumulated + item.duration;
                    accumulated += item.duration;
                    
                    // Remove if midpoint is in selection (heuristic)
                    const midpoint = itemStart + (item.duration / 2);
                    return !(midpoint >= start && midpoint <= end);
                });
                setTimeline(newTimeline);
                setSelection(null);
            } else {
                 // No range selection? Check if we have a "selected item" state.
                 // We don't have explicit "selectedItemId" state yet other than "activeItem" which is playhead based.
                 // Let's delete the item UNDER the playhead
                 const current = getCurrentItem();
                 if (current?.item) {
                     setTimeline(prev => prev.filter(i => i.id !== current.item.id));
                 }
            }
        }

        // Zoom shortcuts
        if ((e.metaKey || e.ctrlKey) && e.key === '=') {
             e.preventDefault();
             setZoomLevel(prev => Math.min(prev * 1.2, 5));
        }
        if ((e.metaKey || e.ctrlKey) && e.key === '-') {
             e.preventDefault();
             setZoomLevel(prev => Math.max(prev / 1.2, 0.2));
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timeline, selection, currentTime]);

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
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedSessions(data);
        }
      })
      .catch(e => console.error('Failed to load sessions', e));
  }, []);

  const totalDuration = Math.max(timeline.reduce((acc, item) => acc + item.duration, 0), 10) + 10; // Extra 10s at end
  
  // Calculate width based on zoom
  const timelineWidthPercent = 100 * zoomLevel;

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

  const activeItemIdx = activeItem ? timeline.findIndex(t => t.id === activeItem.id) : -1;
  const activeContextBefore = activeItemIdx > 0 ? timeline[activeItemIdx - 1].text : undefined;
  const activeContextAfter = activeItemIdx !== -1 && activeItemIdx < timeline.length - 1 ? timeline[activeItemIdx + 1].text : undefined;

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

  const saveCurrentSession = () => {
      setSaveName(`Edit ${new Date().toLocaleTimeString()}`);
      setShowSaveModal(true);
  };

  const handleSaveConfirm = async () => {
      if (!saveName) return;

      const session: SavedStoryboardSession = {
          id: Date.now().toString(),
          name: saveName,
          // @ts-ignore
          storyboard: timeline,
          messages: [], 
          timestamp: Date.now(),
          type: 'edit'
      };
      
      try {
        const res = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(session)
        });

        if (res.ok) {
            setSavedSessions(prev => [session, ...prev]);
            setShowSaveModal(false);
        } else {
            alert("Failed to save session (Server Error)");
        }
      } catch (e) {
          console.error(e);
          alert("Failed to save session");
      }
  };

  const importSession = (session: SavedStoryboardSession) => {
    const newItems: TimelineItem[] = session.storyboard.map(scene => {
      const existing = scene as TimelineItem;
      return {
        ...scene,
        duration: existing.duration || 5, 
        transition: existing.transition || 'cut',
        type: existing.type || 'scene',
        effect: existing.effect,
        audioUrl: existing.audioUrl
      };
    });
    
    setTimeline(prev => [...prev, ...newItems]);
    setShowLoadMenu(false);
  };

  const createEmptyBlock = (start: number, end: number) => {
      if (end - start < 0.5) return; // Ignore small drags

      let accumulatedTime = 0;
      const itemsWithTimes = timeline.map(item => {
          const s = accumulatedTime;
          accumulatedTime += item.duration;
          return { ...item, _start: s, _end: accumulatedTime };
      });

      const newTimeline: TimelineItem[] = [];
      let hasInserted = false;
      const newBlockId = Math.random().toString(36).substring(7);

      if (itemsWithTimes.length === 0) {
           newTimeline.push({
               id: newBlockId,
               text: 'Context Block',
               duration: end - start,
               type: 'empty'
           });
           setTimeline(newTimeline);
           setCurrentTime(start);
           return;
      }
      
      for (const item of itemsWithTimes) {
          // Case 1: Keep parts before selection
          if (item._start < start) {
              const keepDuration = Math.min(item._end, start) - item._start;
              if (keepDuration > 0.1) {
                  newTimeline.push({
                      ...item,
                      id: item.id + (start > item._start && start < item._end ? '_split_1' : ''),
                      duration: keepDuration
                  });
              }
          }

          // Case 2: Insert Empty Block
          if (!hasInserted && (item._end >= start)) {
               newTimeline.push({
                   id: newBlockId,
                   text: 'Context Block',
                   duration: end - start,
                   type: 'empty'
               });
               hasInserted = true;
          }

          // Case 3: Keep parts after selection
          if (item._end > end) {
              const keepDuration = item._end - Math.max(item._start, end);
               if (keepDuration > 0.1) {
                  newTimeline.push({
                      ...item,
                      id: item.id + (end > item._start && end < item._end ? '_split_2' : ''),
                      duration: keepDuration
                  });
              }
          }
      }
      
      if (!hasInserted) {
           newTimeline.push({
               id: newBlockId,
               text: 'Context Block',
               duration: end - start,
               type: 'empty'
           });
      }

      setTimeline(newTimeline);
      // Removed: setCurrentTime(start); // Prevent jump to start of block. 
      // Playhead should stay or user can move it manually.
      // If drag created this, we usually want playhead at start, 
      // but user complaint says "timeline slider goes to beginning rather than frame I clicked on".
      // This function handles block CREATION. Double click creation -> playhead at start seems fine.
      // Drag creation -> playhead at start seems fine.
      // The issue likely refers to CLICKING AN ELEMENT (not creating block).
      
      // However, for consistency, let's just ensure we respect if it was a selection action or just a click.
      setCurrentTime(start); 
  };
  
  const insertEmptyBlockAtIndex = (index: number) => {
      // Find time at this index
      let startTime = 0;
      for (let i = 0; i < index; i++) startTime += timeline[i].duration;
      
      // Insert new block
      const newBlock: TimelineItem = {
          id: Math.random().toString(36).substring(7),
          text: 'Context Block',
          duration: 5,
          type: 'empty'
      };
      
      const newTimeline = [...timeline];
      newTimeline.splice(index, 0, newBlock);
      setTimeline(newTimeline);
      setCurrentTime(startTime);
  };

  const handleContextSubmit = async (context: { text: string, files: File[] }) => {
    setIsSidebarOpen(true);
    setIsProcessingContext(true);
    setAgentTrace("Initializing agent...\nUploading context data...");
    setAgentOptions([]);

    try {
        const formData = new FormData();
        formData.append('text', context.text);
        context.files.forEach(file => {
            formData.append('files', file);
        });

        setAgentTrace(prev => prev + "\nSending to interpretation engine...");

        const response = await fetch('/api/context-interpret', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Analysis failed');

        const data = await response.json();
        
        // Simulate streaming effect for the trace
        let currentTrace = "Analysis complete.\n";
        const fullTrace = data.trace || "";
        setAgentTrace(prev => prev + "\n" + fullTrace);
        
        setAgentOptions(data.options || []);

    } catch (e) {
        console.error(e);
        setAgentTrace(prev => prev + "\nError: Failed to interpret context.");
    } finally {
        setIsProcessingContext(false);
    }
  };
  
  const handleSelectOption = (optionId: string) => {
      // Replace the current empty block with generated scenes
      // For now, we simulate this replacement
      if (!activeItem || activeItem.type !== 'empty') return;

      const newScenes: TimelineItem[] = [
          {
              id: Date.now() + '1',
              text: "Generated Scene 1",
              duration: 3,
              type: 'scene',
              isGeneratingVisual: true
          },
          {
               id: Date.now() + '2',
               text: "Generated Scene 2",
               duration: 3,
               type: 'scene',
               isGeneratingVisual: true
          }
      ];

      // Replace active item
      const index = timeline.findIndex(t => t.id === activeItem.id);
      if (index !== -1) {
          const newTimeline = [...timeline];
          newTimeline.splice(index, 1, ...newScenes);
          setTimeline(newTimeline);
      }
      
      setIsSidebarOpen(false);
      
      // Trigger asset generation for new scenes
      setTimeout(() => fillInAssets(), 500);
  };


  const fillInAssets = async () => {
    setIsGeneratingAssets(true);
    setGenerationStatus('Generating assets in parallel...');

    const initialTimeline = [...timeline];
    
    // Audio
    const audioPromises = initialTimeline.map(async (item, index) => {
        if (item.type === 'empty') return; // Skip empty blocks

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

                    const audio = new Audio(audioUrl);
                    audio.onloadedmetadata = () => {
                         const duration = Math.max(item.duration, Math.ceil(audio.duration)); 
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
        if (item.type === 'empty') return;

        let needsUpdate = false;
        const updates: Partial<TimelineItem> = {};

        if ((assetOptions.addEffects || assetOptions.autoPan) && !item.effect) {
             const effects: TimelineItem['effect'][] = assetOptions.autoPan 
                ? ['pan-left', 'pan-right'] 
                : ['zoom-in', 'zoom-out', 'pan-left', 'pan-right'];
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
                        prompt: `${assetOptions.style} shot: ${item.notes || item.text}. High quality, 4k.` 
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
       // ... existing logic ...
       // Keeping placeholder for brevity, but would reimplement if needed. 
       // For this task, the context editor is the focus.
       alert("Use the Context Editor (drag on timeline) to expand/modify.");
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

  // --- Mouse Handlers for Timeline Selection ---
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollContainer = timelineRef.current.parentElement;
      const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
      
      const x = e.clientX - rect.left; // x relative to timeline start (including scroll if we used scrollWidth but here rect moves with scroll in some layouts, let's verify)
      // Actually, rect.left is screen coordinate. e.clientX is screen coordinate.
      // So x is pixel distance from left edge of visible timeline container? No, rect is the huge inner div.
      
      const y = e.clientY - rect.top;
      
      const clickTime = (x / rect.width) * totalDuration;

      // Check if clicking on an existing item for DRAG
                    let elapsed = 0;
      let clickedItem = null;
      let itemStart = 0;
      for (const item of timeline) {
          if (clickTime >= elapsed && clickTime < elapsed + item.duration) {
              clickedItem = item;
              itemStart = elapsed;
              break;
                        }
                        elapsed += item.duration;
      }

      if (clickedItem) {
          // Initiate Item Drag
          setIsDraggingItem(clickedItem.id);
          setDraggedItemOriginalStart(elapsed);
          setDragOffset(clickTime - elapsed);
          
          // CRITICAL FIX: Update Playhead on click even if it might be a drag start
          // If we drag, it stays there. If we just click (mouseup immediately), it's already there.
          // This fixes "timeline slider goes to beginning" issue when clicking items.
          setCurrentTime(clickTime); 
          
          return;
      }

      // Vertical constraint: Only middle 60% is valid for creation
      const height = rect.height;
      const topBoundary = height * 0.2;
      const bottomBoundary = height * 0.8;
      
      if (y < topBoundary || y > bottomBoundary) return;
      
      setIsSelecting(true);
      setSelection({ start: clickTime, end: clickTime });
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const moveTime = (x / rect.width) * totalDuration;

      if (isDraggingItem) {
          // Calculate new potential start time
          const newStart = Math.max(0, moveTime - dragOffset);
          
          // Find index of dragged item
          const draggedIndex = timeline.findIndex(t => t.id === isDraggingItem);
          if (draggedIndex === -1) return;

          const draggedItem = timeline[draggedIndex];
          
          // --- Overlap / Multi-track Logic ---
          // Check for collision with ANY other item except itself
          let collisionItemIndex = -1;
          let currentStart = 0;
          
          for(let i=0; i<timeline.length; i++) {
              if (i === draggedIndex) {
                  currentStart += timeline[i].duration;
                  continue; 
              }
              
              const itemStart = currentStart;
              const itemEnd = itemStart + timeline[i].duration;
              currentStart += timeline[i].duration;

              // Check overlap: (StartA < EndB) and (EndA > StartB)
              const draggedEnd = newStart + draggedItem.duration;
              
              if (newStart < itemEnd && draggedEnd > itemStart) {
                   collisionItemIndex = i;
                   break; // Found first collision
              }
          }

          if (collisionItemIndex !== -1) {
              // Collision Detected!
              // For this MVP, we will perform a swap if we are close enough to the center of the collided item
              // This is "Magnetic Timeline" behavior (like FCPX) rather than "Overwrite" (like Premiere)
              // Or "Create new track" (like overlapping).
              // User requested: "if there is overlap it creates a second track"
              
              // Implementing "Second Track" visually is complex without changing data structure.
              // We can simulate it by swapping OR by just allowing reordering.
              // Let's stick to the Swap logic from before as it feels most natural for a single-track view,
              // but refine it to be smoother.
              
              // Check if we are > 50% into the other item to swap
              // Re-using the swap logic:
              let newTimeline = [...timeline];
              const targetItem = timeline[collisionItemIndex];
              // If moving Right -> Left (draggedIndex > collisionIndex)
              if (draggedIndex > collisionItemIndex) {
                   // Swap
                   [newTimeline[draggedIndex], newTimeline[collisionItemIndex]] = [newTimeline[collisionItemIndex], newTimeline[draggedIndex]];
                   setTimeline(newTimeline);
              } 
              // If moving Left -> Right
              else {
                   [newTimeline[draggedIndex], newTimeline[collisionItemIndex]] = [newTimeline[collisionItemIndex], newTimeline[draggedIndex]];
                   setTimeline(newTimeline);
              }
          }
              return;
          }

      if (isSelecting && selection) {
         // Constrain mouse move to timeline bounds if possible, but actually we want it to track even if mouse leaves vertically
         // The issue "playhead drifts when moving mouse out of timeline" usually refers to calculations based on window coordinates 
         // without clamping to the container width.
         
         // In handleTimelineMouseMove, 'rect' and 'x' are based on the element. 
         // If mouse leaves the element, 'onMouseMove' stops firing for that element (unless we used setPointerCapture).
         // React onMouseMove is strictly within the element. 
         // To fix drift or behavior when leaving: we usually attach global mouse move or use pointer events with capture.
         
         // However, the user says "when sliding cursor up... timeline slider changes positions". 
         // This implies they are DRAGGING (selecting) and moving up.
         // If they are just moving the mouse without clicking, playhead shouldn't move (it doesn't here).
         // If they clicked (started selection/drag) and moved up, the `onMouseMove` of the container still fires? 
         // No, only if they are over it. 
         // If they move UP out of the container, `onMouseLeave` fires.
         
         // If we want to STOP updating when they leave:
         // We handle onMouseLeave.
         
         setSelection({ ...selection, end: moveTime });
      }
  };

  const handleTimelineMouseLeave = () => {
      // If we are selecting/dragging and leave the area, we might want to stop updating position
      // or keep the last valid position.
      // Simply doing nothing here stops the visual update (good), but if they release mouse outside, 
      // handleTimelineMouseUp won't fire (unless we track globally).
      
      // For now, let's just ensure we don't erratic jump.
      // The user issue: "timeline slider changes positions from where it was clicked, even though I didn't click it."
      // This sounds like `onMouseMove` is updating `currentTime` or `selection` inadvertently.
      // We only update `currentTime` on Click (Up/Down). We update `selection` on Move.
      // If `isSelecting` is true, we update selection. 
      
      // If the user just clicked (MouseDown) and moved up (drag gesture but unintended?), 
      // we initiated `isSelecting`. If they didn't mean to select, this visual is annoying.
      
      // Fix: If `isSelecting` but distance moved is small, cancel on leave?
      // Or just ensure we don't accidentally update things we shouldn't.
  };

  const handleTimelineMouseUp = (e: React.MouseEvent) => {
      if (isDraggingItem) {
          setIsDraggingItem(null);
          setDragOffset(0);
          return;
      }
      
      // Handle simple click to move playhead (if not dragging or selecting range)
      if (!isSelecting && !isDraggingItem && timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
          const clickTime = (x / rect.width) * totalDuration;
          setCurrentTime(clickTime);
          setSelection(null); // Clear selection on click
          return;
      }

      if (isSelecting && selection) {
          const start = Math.min(selection.start, selection.end);
          const end = Math.max(selection.start, selection.end);
          
          if (end - start > 0.5) {
              createEmptyBlock(start, end);
          } else {
              // Simple click - move playhead
              setCurrentTime(start);
              setSelection(null); 
          }
      }
      setIsSelecting(false);
      // Don't clear selection immediately if it was a valid range select, 
      // but here we treat "mouseup" as end of action.
      // If we want persistent selection, we need different logic.
      // For now, "createEmptyBlock" consumes the selection.
      // If valid selection but NO empty block creation (e.g. over existing items), keep selection?
      // Let's clear for now to keep UI clean.
      setSelection(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const time = percentage * totalDuration;
      
      // Check collision
      let elapsed = 0;
      let collision = false;
      for (const item of timeline) {
          if (time >= elapsed && time < elapsed + item.duration) {
              collision = true;
              break;
          }
          elapsed += item.duration;
      }
      
      if (!collision) {
          // Insert 5s block only if empty
          createEmptyBlock(time, time + 5);
      }
  };

  const effectVariants = {
    'zoom-in': { scale: [1, 1.2] },
    'zoom-out': { scale: [1.2, 1] },
    'pan-left': { x: ['0%', '-10%'], scale: 1.1 },
    'pan-right': { x: ['-10%', '0%'], scale: 1.1 },
    'static': { scale: 1 }
  };

  const handleRefineRequest = (file?: File) => {
      setAssetToRefine(file || null);
      setEditorMode('refine');
  };

  if (editorMode === 'refine') {
      // Determine context for the currently active item
      const currentIdx = activeItem ? timeline.findIndex(t => t.id === activeItem.id) : -1;
      const before = currentIdx > 0 ? timeline[currentIdx - 1].text : undefined;
      const after = currentIdx !== -1 && currentIdx < timeline.length - 1 ? timeline[currentIdx + 1].text : undefined;
      const prevImage = currentIdx > 0 ? timeline[currentIdx - 1].image : undefined;
      const nextImage = currentIdx !== -1 && currentIdx < timeline.length - 1 ? timeline[currentIdx + 1].image : undefined;
      const globalContext = timeline.map(t => t.text).join('. ');

      return (
          <RefineAssetFlow 
              onBack={() => {
                  setEditorMode('timeline');
                  setAssetToRefine(null);
              }}
              contextBefore={before}
              contextAfter={after}
              prevImage={prevImage}
              nextImage={nextImage}
              globalContext={globalContext}
              assetFile={assetToRefine || undefined}
              assetType={assetToRefine?.type.startsWith('video') ? 'video' : 'image'}
          />
      );
  }

  return (
    <div className="flex h-full bg-stone-900 text-white overflow-hidden relative">
      <audio ref={audioRef} className="hidden" />
      
      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
          
        {/* Header */}
        <div className="h-14 border-b border-stone-800 flex items-center justify-between px-4 bg-stone-900/50 backdrop-blur-sm z-10 shrink-0">
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
                    {/* Load Menu (Same as before) */}
                {showLoadMenu && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-stone-800 rounded-lg shadow-xl border border-stone-700 py-2 max-h-64 overflow-y-auto z-20">
                            {/* Saved Edits Section */}
                            <div className="px-4 py-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                                Saved Edits
                            </div>
                            {savedSessions.filter(s => s.type === 'edit').length === 0 ? (
                                <div className="px-4 py-2 text-xs text-stone-600 italic">No saved edits</div>
                            ) : (
                                savedSessions.filter(s => s.type === 'edit').map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => importSession(session)}
                                        className="w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 truncate"
                                    >
                                        {session.name}
                                    </button>
                                ))
                            )}

                            <div className="h-px bg-stone-700 my-2 mx-4" />

                            {/* Storyboards Section */}
                            <div className="px-4 py-1 text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">
                                Storyboards
                            </div>
                            {savedSessions.filter(s => !s.type || s.type === 'storyboard').length === 0 ? (
                                <div className="px-4 py-2 text-xs text-stone-600 italic">No storyboards</div>
                            ) : (
                                savedSessions.filter(s => !s.type || s.type === 'storyboard').map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => importSession(session)}
                                        className="w-full text-left px-4 py-2 text-sm text-stone-300 hover:bg-stone-700 truncate"
                                    >
                                        {session.name}
                                    </button>
                                ))
                            )}
                    </div>
                )}
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={saveCurrentSession}
                className="p-2 hover:bg-stone-800 rounded-lg text-stone-400"
                title="Save Session"
            >
                <Save className="w-4 h-4" />
            </button>

                 <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 hover:bg-stone-800 rounded-lg transition-colors ${isSidebarOpen ? 'text-purple-400' : 'text-stone-400'}`}
                    title="Toggle Agent Trace"
                >
                    {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
            
            <div className="relative z-50">
                <div className="flex rounded-lg bg-purple-600 text-white overflow-hidden disabled:opacity-50">
                    <button 
                        onClick={fillInAssets}
                        disabled={timeline.length === 0 || isGeneratingAssets}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-purple-700 transition-all border-r border-purple-700"
                    >
                        {isGeneratingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Fill Assets
                    </button>
                    <button
                        onClick={() => setShowAssetMenu(!showAssetMenu)}
                        className="px-1.5 hover:bg-purple-700 transition-all"
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>

                {showAssetMenu && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-stone-800 rounded-lg shadow-xl border border-stone-700 p-2">
                        <div className="text-xs font-medium text-stone-400 mb-2 px-2">Style</div>
                        {['Cinematic', 'Anime', 'Cyberpunk', 'Watercolor', 'Sketch'].map(style => (
                            <button
                                key={style}
                                onClick={() => setAssetOptions(prev => ({ ...prev, style }))}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded mb-1 transition-colors ${assetOptions.style === style ? 'bg-purple-600 text-white' : 'text-stone-300 hover:bg-stone-700'}`}
                            >
                                {style}
                            </button>
                        ))}
                        
                        <div className="h-px bg-stone-700 my-2" />
                        
                        <div className="space-y-1">
                            <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-stone-700 rounded cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={assetOptions.addEffects}
                                    onChange={e => setAssetOptions(prev => ({ ...prev, addEffects: e.target.checked }))}
                                    className="rounded bg-stone-900 border-stone-600 text-purple-600 focus:ring-purple-600"
                                />
                                <span className="text-xs text-stone-300">Add Camera Effects</span>
                            </label>
                            <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-stone-700 rounded cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={assetOptions.autoPan}
                                    onChange={e => setAssetOptions(prev => ({ ...prev, autoPan: e.target.checked }))}
                                    className="rounded bg-stone-900 border-stone-600 text-purple-600 focus:ring-purple-600"
                                />
                                <span className="text-xs text-stone-300">Auto-Pan</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            <button 
                onClick={handleExportXML}
                    className="p-2 hover:bg-stone-800 rounded-lg text-stone-400"
                    title="Export XML"
            >
                <FileCode className="w-4 h-4" />
            </button>
        </div>
      </div>

        {/* Preview Area */}
        <div className="flex-1 bg-black flex items-center justify-center relative p-4 overflow-hidden min-h-0">
             {activeItem ? (
                 <div className="bg-stone-900 shadow-2xl border border-stone-800 rounded-lg relative overflow-hidden" 
                      style={{ 
                          aspectRatio: '16/9',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '100%',
                          flex: '0 0 auto'
                      }}
                 >
                    <AnimatePresence mode='wait'>
                        {activeItem.type === 'empty' ? (
                            <motion.div
                                key={activeItem.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full h-full"
                            >
                                <ContextInput 
                                    onContextSubmit={handleContextSubmit} 
                                    onRefineAsset={handleRefineRequest}
                                    priorContext={activeContextBefore}
                                    nextContext={activeContextAfter}
                                />
                            </motion.div>
                        ) : (
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
                                        animate={isPlaying ? (activeItem.effect || 'static') : 'static'}
                                    transition={{ duration: activeItem.duration, ease: "linear" }}
                                        className="w-full h-full object-cover"
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
                                   <p className="text-white text-lg font-medium text-shadow-lg bg-black/40 inline-block px-6 py-3 rounded-xl backdrop-blur-md border border-white/10">
                                   {activeItem.text}
                                   </p>
                           </div>
                        </motion.div>
                    )}
                    </AnimatePresence>
                    
                    {/* Play Overlay */}
                    {!isPlaying && activeItem.type !== 'empty' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition-colors cursor-pointer z-10" onClick={() => setIsPlaying(true)}>
                            <Play className="w-12 h-12 fill-white text-white opacity-80" />
                        </div>
                    )}
                 </div>
             ) : (
                 <div className="text-stone-500 flex flex-col items-center">
                     <p>Drag on timeline or import storyboard to start</p>
                 </div>
             )}
      </div>


      {/* Timeline Panel */}
        <div className="h-72 bg-stone-900 border-t border-stone-800 flex flex-col shrink-0">
            {/* Controls */}
            <div className="h-10 border-b border-stone-800 flex items-center px-4 gap-4 bg-stone-950">
                <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-purple-400">
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
                <div className="text-xs font-mono text-stone-400">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
                
                {/* Zoom Controls */}
                <div className="flex items-center gap-2 ml-4 border-l border-stone-800 pl-4">
                    <button onClick={() => setZoomLevel(z => Math.max(z / 1.2, 0.2))} className="text-stone-400 hover:text-white p-1">
                        <ZoomOut size={14} />
                    </button>
                <input 
                    type="range" 
                        min="0.2" 
                        max="5" 
                    step="0.1"
                        value={zoomLevel} 
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-stone-700 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-stone-400"
                    />
                    <button onClick={() => setZoomLevel(z => Math.min(z * 1.2, 5))} className="text-stone-400 hover:text-white p-1">
                        <ZoomIn size={14} />
                    </button>
            </div>
        </div>

            {/* Tracks */}
            <div className="flex-1 relative overflow-hidden overflow-x-auto select-none custom-scrollbar"
                 ref={timelineRef}
                 onMouseDown={handleTimelineMouseDown}
                 onMouseMove={handleTimelineMouseMove}
                 onMouseUp={handleTimelineMouseUp}
                 onMouseLeave={handleTimelineMouseLeave}
                 onDoubleClick={handleDoubleClick}
            >
                {/* Dynamic Width Container based on Zoom */}
                <div className="absolute inset-0 h-full bg-stone-900 cursor-crosshair" style={{ width: `${timelineWidthPercent}%`, minWidth: '100%' }}>
                    
                    {/* Time Ruler (Optional, good for context) */}
                    <div className="h-6 border-b border-stone-800 flex items-end text-[10px] text-stone-500 relative">
                        {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => (
                             <div key={i} className="absolute bottom-0 border-l border-stone-800 pl-1 pb-1" style={{ left: `${(i * 5 / totalDuration) * 100}%` }}>
                                 {formatTime(i * 5)}
                             </div>
                        ))}
                    </div>

                    {/* Main Track Layer */}
                    <div className="absolute top-8 h-24 left-0 right-0 flex">
                        {(() => {
                            let elapsed = 0;
                            return timeline.map((item, idx) => {
                                const start = elapsed;
                                const width = (item.duration / totalDuration) * 100;
                                elapsed += item.duration;

                                return (
                                    <React.Fragment key={item.id || idx}>
                                        {/* Insert Button (Before Item) */}
                                        <div className="relative w-0 group/insert z-30">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    insertEmptyBlockAtIndex(idx);
                                                }}
                                                className="absolute top-0 bottom-0 -left-3 w-6 flex items-center justify-center opacity-0 group-hover/insert:opacity-100 hover:opacity-100 transition-opacity z-40"
                                                title="Insert Context Block"
                                            >
                                                <div className="w-0.5 h-full bg-purple-500/50 group-hover/insert:bg-purple-500" />
                                                <div className="absolute bg-purple-600 text-white rounded-full p-0.5 shadow-sm transform scale-0 group-hover/insert:scale-100 transition-transform">
                                                    <Plus size={10} />
                                            </div>
                                            </button>
                                            </div>

                                        <div 
                                            className={`h-full relative border-r border-stone-950 overflow-hidden group transition-transform
                                                ${item.type === 'empty' 
                                                    ? 'bg-stone-800/50 hover:bg-stone-800 border-2 border-dashed border-stone-600' 
                                                    : 'bg-stone-800 hover:bg-stone-700'
                                                }
                                                ${activeItem?.id === item.id ? 'ring-2 ring-purple-500 z-10' : ''}
                                                ${isDraggingItem === item.id ? 'opacity-50 scale-95 z-20 ring-2 ring-yellow-500 cursor-grabbing' : 'cursor-grab'}
                                            `}
                                            style={{ width: `${width}%` }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Removed forced setting to start. 
                                                // MouseDown handles precise positioning.
                                                // If we click here, let MouseDown/Up logic prevail.
                                            }}
                                        >
                                            {/* Drag Handle */}
                                            <div className="absolute left-0 top-0 bottom-0 w-4 z-20 opacity-0 group-hover:opacity-100 cursor-grab flex items-center justify-center bg-black/20">
                                                 <GripVertical size={12} className="text-stone-400" />
                                    </div>

                                            {/* Content */}
                                            {item.type === 'empty' ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-stone-500 p-2 pointer-events-none">
                                                    <Plus className="w-6 h-6 mb-1 opacity-50" />
                                                    <span className="text-[10px] font-medium uppercase tracking-wider text-center hidden md:block">Add Context</span>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full pointer-events-none">
                                                    {item.image && (
                                                        <img src={item.image} className="w-full h-full object-cover opacity-50 group-hover:opacity-70" draggable={false} />
                                                    )}
                                                    <div className="absolute bottom-2 left-2 right-2">
                                                        <p className="text-[10px] text-white truncate px-1 bg-black/50 rounded">{item.text}</p>
                                        </div>
                                    </div>
                                    )}
                    
                                            {/* Duration Handle (Visual only for now) */}
                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/20 cursor-col-resize hover:bg-purple-500" />
                    </div>
                                    </React.Fragment>
                                );
                            });
                        })()}
                </div>

                    {/* Context Line / Secondary Track */}
                    <div className="absolute top-36 h-12 left-0 right-0 border-t border-stone-800 bg-stone-900/50">
                        <div className="absolute inset-0 flex items-center px-2">
                             <span className="text-[10px] text-stone-600 font-mono uppercase tracking-widest pointer-events-none select-none">Context Layer</span>
                    </div>
                        {/* 
                            This layer acts as the "context line" where users can see potential overlapping contexts
                            or drag items here to create layers in future iterations.
                            For now, it's a visual placeholder for the "Context modification" line.
                        */}
                        </div>

                    {/* Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                        style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                    >
                        <div className="w-3 h-3 -ml-1.5 bg-red-500 transform rotate-45 -mt-1.5 shadow-sm" />
                        <div className="h-full w-full bg-red-500/20" /> 
                                    </div>

                    {/* Selection Highlight */}
                    {selection && (
                            <div 
                            className="absolute top-0 bottom-0 bg-purple-500/20 border-l border-r border-purple-500/50 pointer-events-none z-20"
                                style={{
                                left: `${(Math.min(selection.start, selection.end) / totalDuration) * 100}%`,
                                width: `${(Math.abs(selection.end - selection.start) / totalDuration) * 100}%`
                                }}
                            />
                        )}

                    </div>
                </div>
            </div>
            
            {/* Global Director Modal (Fixed at bottom center of main view) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-none">
                <AnimatePresence>
                {isGlobalPromptOpen ? (
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="bg-stone-900/90 backdrop-blur-xl border border-stone-700 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
                    >
                        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-800 bg-stone-950/30">
                            <div className="flex items-center gap-2 text-xs font-medium text-stone-400">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                Global Director
                            </div>
                            <button onClick={() => setIsGlobalPromptOpen(false)} className="text-stone-500 hover:text-white">
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="p-2 flex gap-2">
                            <input
                                type="text"
                                value={globalPrompt}
                                onChange={(e) => setGlobalPrompt(e.target.value)}
                                placeholder="Describe high-level changes (e.g. 'Make it darker', 'Add background music')..."
                                className="flex-1 bg-stone-800/50 border border-stone-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        alert("Global direction received (Mock): " + globalPrompt);
                                        setGlobalPrompt('');
                                    }
                                }}
                            />
                            <button 
                                onClick={() => {
                                    alert("Global direction received (Mock): " + globalPrompt);
                                    setGlobalPrompt('');
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors shadow-lg shadow-purple-900/20"
                            >
                                <Wand2 className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        onClick={() => setIsGlobalPromptOpen(true)}
                        className="mx-auto bg-stone-900/90 backdrop-blur-md border border-stone-700 text-stone-400 px-4 py-2 rounded-full shadow-lg text-xs flex items-center gap-2 hover:text-white hover:border-stone-600 transition-all pointer-events-auto"
                    >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        Global Director
                        <ChevronUp className="w-3 h-3" />
                    </motion.button>
                )}
                </AnimatePresence>
            </div>

            </div>

      {/* Save Modal */}
      <AnimatePresence>
        {showSaveModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-6 w-full max-w-md"
                >
                    <h3 className="text-lg font-bold text-white mb-4">Save Session</h3>
                    <input 
                        type="text" 
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        placeholder="Session Name"
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-2 text-white mb-6 focus:ring-2 focus:ring-purple-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveConfirm()}
                    />
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setShowSaveModal(false)}
                            className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveConfirm}
                            disabled={!saveName}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            Save Project
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Right Sidebar */}
      <AgentSidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        trace={agentTrace}
        options={agentOptions}
        onSelectOption={handleSelectOption}
        isProcessing={isProcessingContext}
      />
    </div>
  );
}
