'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, RefreshCw, Play, Search, ThumbsUp, Loader2, Check, X, Image as ImageIcon, ArrowLeft, Plus, BarChart2, TrendingUp, Activity, Eye, Heart, Users, Calendar, Clock, Settings2, ListPlus, Trash2, Save, FolderOpen, PanelRightOpen, PanelRightClose, Minus, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChannelBreakdown } from './ChannelBreakdown';

interface TrendingVideo {
  id: string;
  title: string;
  thumbnail: string;
  viewCount: string;
  likeCount?: string;
  subscriberCount?: string;
  channelTitle: string;
  publishedAt: string;
  description?: string;
  outlierScore?: number;
}

interface HookIdea {
  id: string;
  title: string;
  thumbnailConcept: string;
  hook: string;
  liked?: boolean;
  generatedImages?: string[];
  selectedImageIndex?: number;
  isGeneratingImage?: boolean;
  isAnalyzing?: boolean;
  analysis?: {
      score: number;
      feedback: string;
      improvementSuggestion: string;
  };
}

interface ContextStack {
    id: string;
    name: string;
    videos: TrendingVideo[];
    date: string;
}

interface HookGeneratorProps {
  onStartResearch?: (data: { title: string, hook: string, image?: string }) => void;
  showTutorial?: boolean;
  onNextTutorial?: () => void;
  onCloseTutorial?: () => void;
}

// Recency options
const RECENCY_OPTIONS = [
    { label: 'All Time', value: '' },
    { label: 'Last 6 Months', value: '6m' },
    { label: 'Last Month', value: '1m' },
    { label: 'Last Week', value: '1w' },
];

// Axis Options
const AXIS_OPTIONS = [
    { label: 'Outlier Score', value: 'outlierScore' },
    { label: 'Views', value: 'viewCount' },
    { label: 'Likes', value: 'likeCount' },
    { label: 'Subscribers', value: 'subscriberCount' },
];

// Helper for IndexedDB
const DB_NAME = 'HookGenDB';
const STORE_NAME = 'savedHooks';
const STACK_STORE_NAME = 'savedStacks';
const DB_VERSION = 2;

const openDB = () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STACK_STORE_NAME)) {
                db.createObjectStore(STACK_STORE_NAME, { keyPath: 'id' });
            }
        };
        
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
    });
};

const saveToDB = async (storeName: string, items: any[]) => {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Simple approach: Clear and rewrite or put individually. 
    // Since we maintain full state in React, clear/rewrite is safer for sync.
    // But for efficiency we should probably use put.
    // For now, to prevent accumulating deleted items, we'll clear first if it's a full sync.
    // But actually, `items` passed here IS the full state.
    
    await new Promise<void>((resolve, reject) => {
         const clearReq = store.clear();
         clearReq.onsuccess = () => {
             let count = 0;
             if (items.length === 0) resolve();
             items.forEach(item => {
                 const req = store.put(item);
                 req.onsuccess = () => {
                     count++;
                     if (count === items.length) resolve();
                 };
                 req.onerror = () => reject(req.error);
             });
         };
         clearReq.onerror = () => reject(clearReq.error);
    });
};

const loadFromDB = async (storeName: string) => {
    const db = await openDB();
    return new Promise<any[]>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};


export function HookGenerator({ onStartResearch, showTutorial, onNextTutorial, onCloseTutorial }: HookGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'outliers' | 'studio' | 'breakdown'>('outliers');
  const [studioTab, setStudioTab] = useState<'generate' | 'saved'>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const [previewVideo, setPreviewVideo] = useState<TrendingVideo | null>(null); 
  const [generatedHooks, setGeneratedHooks] = useState<HookIdea[]>([]);
  const [savedHooks, setSavedHooks] = useState<HookIdea[]>([]); 
  const [searchQuery, setSearchQuery] = useState('AI Automation');
  const [filter, setFilter] = useState<string>('');
  const [recency, setRecency] = useState<string>('');
  
  // Outlier Graph Config
  const [xAxis, setXAxis] = useState<string>('outlierScore');
  const [yAxis, setYAxis] = useState<string>('viewCount');

  // Context Stack (Sidebar)
  const [contextStack, setContextStack] = useState<TrendingVideo[]>([]);
  const [savedContextStacks, setSavedContextStacks] = useState<ContextStack[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [stackName, setStackName] = useState('');
  const [isStackNameEditing, setIsStackNameEditing] = useState(false);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [showSavedStacks, setShowSavedStacks] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const loadState = async () => {
        try {
            const loadedHooks = await loadFromDB(STORE_NAME);
            if (loadedHooks) setSavedHooks(loadedHooks);
            
            const loadedStacks = await loadFromDB(STACK_STORE_NAME);
            if (loadedStacks) setSavedContextStacks(loadedStacks);

            const currentStackData = localStorage.getItem('currentContextStack');
            if (currentStackData) {
                setContextStack(JSON.parse(currentStackData));
            }
        } catch (e) {
            console.error("Failed to load from DB", e);
        } finally {
            setIsInitialized(true);
        }
    };
    loadState();
  }, []);

  // Save to IndexedDB whenever state changes
  useEffect(() => {
      if (!isInitialized) return;
      if (savedHooks.length > 0) {
          saveToDB(STORE_NAME, savedHooks).catch(console.error);
      } else {
           // If empty, clear DB? saveToDB handles clear if passed empty array.
           // Just calling it is fine.
           saveToDB(STORE_NAME, []);
      }
  }, [savedHooks, isInitialized]);

  useEffect(() => {
      if (!isInitialized) return;
      if (savedContextStacks.length > 0) {
          saveToDB(STACK_STORE_NAME, savedContextStacks).catch(console.error);
      } else {
          saveToDB(STACK_STORE_NAME, []);
      }
  }, [savedContextStacks, isInitialized]);

  // Keep current context stack in localStorage (usually small)
  useEffect(() => {
      if (!isInitialized) return;
      localStorage.setItem('currentContextStack', JSON.stringify(contextStack));
  }, [contextStack, isInitialized]);

  // Auto-generate stack name
  useEffect(() => {
      if (contextStack.length > 0 && !stackName) {
          generateStackName(contextStack);
      }
  }, [contextStack.length]);

  const generateStackName = async (videos: TrendingVideo[]) => {
      setIsGeneratingName(true);
      try {
          const res = await fetch('/api/hooks', {
              method: 'POST',
              body: JSON.stringify({ 
                  action: 'generate_stack_name', 
                  videoTitles: videos.slice(0, 5).map(v => v.title) 
              }),
              headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.name) setStackName(data.name);
      } catch (e) {
          console.error("Failed to generate stack name", e);
      } finally {
          setIsGeneratingName(false);
      }
  };

  const getPublishedAfterDate = (period: string) => {
      if (!period) return undefined;
      const date = new Date();
      if (period === '1w') date.setDate(date.getDate() - 7);
      if (period === '1m') date.setMonth(date.getMonth() - 1);
      if (period === '6m') date.setMonth(date.getMonth() - 6);
      return date.toISOString();
  };

  const fetchTrends = async (token?: string | null, reset = false) => {
    setIsLoading(true);
    try {
      const publishedAfter = getPublishedAfterDate(recency);
      
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'fetch_trends', 
            query: searchQuery, 
            pageToken: token,
            semanticFilter: filter,
            isOutlierMode: activeTab === 'outliers',
            publishedAfter
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.videos) {
        setVideos(prev => reset ? data.videos : [...prev, ...data.videos]);
        setNextPageToken(data.nextPageToken);
      }
    } catch (error) {
      console.error('Failed to fetch trends:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
      if ((videos.length > 0 || searchQuery) && activeTab !== 'studio') {
          fetchTrends(null, true);
      }
  }, [recency, activeTab]); 

  const generateHooks = async (video?: TrendingVideo, useLiked = false, batchVideos?: TrendingVideo[]) => {
    setIsLoading(true);
    
    const targetVideos = batchVideos || (video ? [video] : (selectedVideo ? [selectedVideo] : contextStack));
    
    if (targetVideos.length === 0) {
        setIsLoading(false);
        return;
    }

    setActiveTab('studio');
    setStudioTab('generate');
    
    if (!useLiked) {
        setGeneratedHooks([]);
    }

    const targetVideo = targetVideos[0];
    setSelectedVideo(targetVideo);

    const likedHooks = useLiked ? generatedHooks.filter(h => h.liked) : [];
    
    try {
      const response = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'generate_hooks', 
          video: targetVideo, 
          likedHooks 
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  try {
                      const data = JSON.parse(line.slice(6));
                      if (data.type === 'hook') {
                          setGeneratedHooks(prev => [...prev, data.hook]);
                      } else if (data.type === 'done') {
                          setIsLoading(false);
                      }
                  } catch (e) {
                      console.error("Error parsing stream data", e);
                  }
              }
          }
      }

    } catch (error) {
      console.error('Failed to generate hooks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = (id: string) => {
      setGeneratedHooks(prev => prev.map(h => 
          h.id === id ? { ...h, liked: !h.liked } : h
      ));
  };

  const handleDiscard = (id: string) => {
      setGeneratedHooks(prev => prev.filter(h => h.id !== id));
  };

  const saveHook = (hook: HookIdea) => {
      if (!savedHooks.find(h => h.id === hook.id)) {
          setSavedHooks(prev => [...prev, hook]);
      }
  };

  const deleteSavedHook = (id: string) => {
      setSavedHooks(prev => prev.filter(h => h.id !== id));
  };

  const updateSavedHookTitle = (id: string, newTitle: string) => {
      setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, title: newTitle } : h));
  };

  const analyzeHook = async (hook: HookIdea) => {
      // Optimistic update or local loading state for specific hook could be added here
      // For now we use a loading text placeholder
      const updateHook = (id: string, updates: Partial<HookIdea>) => {
          setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
          setGeneratedHooks(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
      };
      
      updateHook(hook.id, { isAnalyzing: true });
      
      try {
          const res = await fetch('/api/hooks', {
            method: 'POST',
            body: JSON.stringify({ action: 'analyze_hook', title: hook.title, hook: hook.hook }),
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = '';

          while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              fullText += chunk;
              // If we want to stream raw text we could, but we are parsing JSON at the end
              // For true streaming text we'd need to handle partial JSON or just stream text.
              // The prompt asks for JSON, but maybe better to just stream text for immediate feedback?
              // Let's try to parse partially or just show "Analyzing..."
          }
          
          // Attempt to find JSON in the text
          try {
              // Simple extraction if model returns markdown code block
              const jsonMatch = fullText.match(/\{[\s\S]*\}/);
              const jsonStr = jsonMatch ? jsonMatch[0] : fullText;
              const analysis = JSON.parse(jsonStr);
              updateHook(hook.id, { analysis, isAnalyzing: false });
          } catch (e) {
              // Fallback if not valid JSON yet (maybe raw text response)
             updateHook(hook.id, { isAnalyzing: false }); 
          }

      } catch (e) {
          console.error(e);
          updateHook(hook.id, { isAnalyzing: false });
      }
  };

  const generateThumbnailImage = async (id: string, concept: string, append: boolean = false) => {
      const setGenerating = (isGen: boolean) => {
        setGeneratedHooks(prev => prev.map(h => h.id === id ? { ...h, isGeneratingImage: isGen } : h));
        setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, isGeneratingImage: isGen } : h));
      };

      setGenerating(true);

      try {
          const res = await fetch('/api/hooks', {
            method: 'POST',
            body: JSON.stringify({ action: 'generate_thumbnail_image', concept }),
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.images) {
            const applyUpdate = (hook: HookIdea) => {
                const currentImages = hook.generatedImages || [];
                const newImages = append ? [...currentImages, ...data.images] : data.images;
                // If appending, select the first of the *new* images. If replacing, select 0.
                const newIndex = append ? currentImages.length : 0;
                return { 
                    ...hook, 
                    generatedImages: newImages, 
                    selectedImageIndex: newIndex, 
                    isGeneratingImage: false 
                };
            };

            setGeneratedHooks(prev => prev.map(h => h.id === id ? applyUpdate(h) : h));
            setSavedHooks(prev => prev.map(h => h.id === id ? applyUpdate(h) : h));
          }
      } catch (e) {
          console.error(e);
          setGenerating(false);
      }
  };

  const selectImage = (hookId: string, index: number) => {
      const update = { selectedImageIndex: index };
      setGeneratedHooks(prev => prev.map(h => h.id === hookId ? { ...h, ...update } : h));
      setSavedHooks(prev => prev.map(h => h.id === hookId ? { ...h, ...update } : h));
  };

  const handleStartResearchClick = (hook: HookIdea) => {
      if (onStartResearch) {
          onStartResearch({
              title: hook.title,
              hook: hook.hook,
              image: hook.generatedImages?.[hook.selectedImageIndex || 0]
          });
      }
  };

  const addToContextStack = (video: TrendingVideo) => {
      if (!contextStack.find(v => v.id === video.id)) {
          setContextStack(prev => [...prev, video]);
      }
      if (!isSidebarOpen) setIsSidebarOpen(true);
  };

  const removeFromContextStack = (videoId: string) => {
      setContextStack(prev => prev.filter(v => v.id !== videoId));
  };

  const saveContextStack = () => {
      if (!stackName.trim()) return;
      const newStack: ContextStack = {
          id: Date.now().toString(),
          name: stackName,
          videos: contextStack,
          date: new Date().toISOString()
      };
      setSavedContextStacks(prev => [...prev, newStack]);
      setShowSavedStacks(true);
  };

  const loadContextStack = (stack: ContextStack) => {
      setContextStack(stack.videos);
      setStackName(stack.name);
      setIsSidebarOpen(true);
  };

  const deleteSavedStack = (stackId: string) => {
      setSavedContextStacks(prev => prev.filter(s => s.id !== stackId));
  };


  const getViralityScore = (video: TrendingVideo) => {
      if (!video.viewCount || !video.subscriberCount) return null;
      const views = parseInt(video.viewCount);
      const subs = parseInt(video.subscriberCount);
      if (subs === 0) return null;
      return (views / subs).toFixed(1) + 'x';
  };

  const getValue = (video: TrendingVideo, key: string) => {
      if (key === 'outlierScore') return video.outlierScore || 0;
      // @ts-ignore
      return parseInt(video[key] || video.statistics?.[key] || '0');
  };

  const xValues = videos.map(v => getValue(v, xAxis));
  const yValues = videos.map(v => getValue(v, yAxis));
  
  const minX = Math.min(...xValues.filter(v => v > 0));
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues.filter(v => v > 0));
  const maxY = Math.max(...yValues);

  const getLogPos = (value: number, min: number, max: number) => {
      if (value <= 0) return 0;
      const logVal = Math.log(value);
      const logMin = Math.log(Math.max(min, 1));
      const logMax = Math.log(Math.max(max, 1));
      const range = logMax - logMin;
      if (range === 0) return 50;
      return ((logVal - logMin) / range) * 100;
  };

  const maxViews = Math.max(...videos.map(v => parseInt(v.viewCount) || 0), 1);

  return (
    <div className="h-full flex flex-col bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-200 bg-white space-y-4 z-20 relative shadow-sm flex-shrink-0">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-xl font-bold text-stone-900">Hook & Trend Generator</h1>
            </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-stone-100 p-1 rounded-lg">
                        <button 
                        onClick={() => { setActiveTab('outliers'); setSelectedVideo(null); }}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'outliers' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                        >
                            <Activity className="inline-block mr-2 w-4 h-4" /> Outlier Analysis
                        </button>
                        <button 
                        onClick={() => { setActiveTab('trends'); setSelectedVideo(null); }}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'trends' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                        >
                            <TrendingUp className="inline-block mr-2 w-4 h-4" /> Feed
                        </button>
                        <button 
                        onClick={() => setActiveTab('studio')}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'studio' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                        >
                            <Sparkles className="inline-block mr-2 w-4 h-4" /> Hook Studio
                        </button>
                        <button 
                        onClick={() => setActiveTab('breakdown')}
                        className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all", activeTab === 'breakdown' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                        >
                            <Search className="inline-block mr-2 w-4 h-4" /> Channel Analysis
                        </button>
                    </div>
                
                <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={cn("ml-2 text-stone-700", isSidebarOpen && "bg-stone-100")}
                >
                    {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                </Button>
                </div>
        </div>
        
        {/* Search & Filters - Only show in Feed/Outliers */}
        {activeTab !== 'studio' && (
            <div className="flex flex-wrap items-center justify-between gap-4 relative">
                {showTutorial && (
                    <TutorialOverlay
                        step={0}
                        totalSteps={4}
                        onNext={onNextTutorial!}
                        onClose={onCloseTutorial!}
                        content="Enter a topic here to find viral videos. We'll analyze their performance to help you spot outlier opportunities."
                        position="bottom"
                        className="top-12 left-0"
                    />
                )}
                <div className="flex gap-2 w-full max-w-lg">
                    <Input 
                        placeholder={activeTab === 'outliers' ? "Enter niche to analyze outliers..." : "Search topic..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchTrends(null, true)}
                        className="h-9 border-stone-300 text-stone-900 placeholder:text-stone-400"
                    />
                    <Button onClick={() => fetchTrends(null, true)} disabled={isLoading} size="sm" className="text-stone-50">
                        {isLoading ? <Loader2 className="animate-spin mr-2" size={14}/> : <Search className="mr-2" size={14} />}
                        {activeTab === 'outliers' ? 'Analyze' : 'Search'}
                    </Button>
                </div>
                
                        <div className="flex items-center gap-2">
                         {RECENCY_OPTIONS.map((opt) => (
                             <Button
                                key={opt.value}
                                variant={recency === opt.value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setRecency(opt.value)}
                            className={cn("h-8 text-xs text-stone-600", recency === opt.value && "bg-stone-200 text-stone-900")}
                             >
                                {opt.label}
                             </Button>
                         ))}
                </div>
            </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Center Content */}
      <div className="flex-1 overflow-y-auto p-6 relative" ref={containerRef}>
            
            {activeTab === 'trends' && (
                <div className="space-y-6">
                     {/* Filters */}
                     <div className="flex gap-2 mb-4">
                         <Button variant={filter === '' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilter(''); fetchTrends(null, true); }} className="text-stone-700">All</Button>
                         <Button variant={filter === 'no face' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilter('no face'); fetchTrends(null, true); }} className="text-stone-700">No Face</Button>
                         <Button variant={filter === 'infographic' ? 'secondary' : 'ghost'} size="sm" onClick={() => { setFilter('infographic'); fetchTrends(null, true); }} className="text-stone-700">Data</Button>
                     </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {videos.map((video) => {
                            const virality = getViralityScore(video);
                            const inStack = contextStack.find(v => v.id === video.id);
                            return (
                            <Card 
                                key={video.id} 
                                className={cn("overflow-hidden hover:shadow-lg transition-all cursor-pointer group flex flex-col border-transparent", inStack && "ring-2 ring-green-500")}
                                onClick={() => setPreviewVideo(video)}
                            >
                                <div className="relative aspect-video bg-stone-200">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                
                                <div className="absolute top-2 right-2 z-10">
                                    <Button 
                                        size="icon"
                                        className={cn("h-8 w-8 rounded-full", inStack ? "bg-green-500 hover:bg-green-600 text-white" : "bg-black/50 hover:bg-black/70 text-white")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (inStack) removeFromContextStack(video.id);
                                            else addToContextStack(video);
                                        }}
                                    >
                                        {inStack ? <Check size={14} /> : <Plus size={14} />}
                                        </Button>
                                    </div>

                                {virality && (
                                    <div className="absolute bottom-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                        {virality} Viral
                                    </div>
                                )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col">
                                <h3 className="font-semibold line-clamp-2 text-sm mb-1 leading-tight text-stone-900">{video.title}</h3>
                                <div className="flex items-center justify-between text-xs text-stone-600 mt-auto">
                                    <span className="truncate pr-2">{video.channelTitle}</span>
                                    <span>{parseInt(video.viewCount).toLocaleString()} views</span>
                                </div>
                                </div>
                            </Card>
                            );
                        })}
                    </div>
                    {nextPageToken && (
                        <div className="flex justify-center pt-4">
                            <Button variant="outline" onClick={() => fetchTrends(nextPageToken)} disabled={isLoading} className="text-stone-700">
                                Load More
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'outliers' && (
                <div className="h-full flex flex-col">
                     {/* Axis Controls */}
                    <div className="flex items-center gap-4 mb-4 p-2 bg-stone-100 rounded-lg w-fit">
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-600">X:</span>
                            <select value={xAxis} onChange={(e) => setXAxis(e.target.value)} className="bg-white text-stone-700 text-xs p-1 rounded border border-stone-300">
                                {AXIS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-600">Y:</span>
                            <select value={yAxis} onChange={(e) => setYAxis(e.target.value)} className="bg-white text-stone-700 text-xs p-1 rounded border border-stone-300">
                                {AXIS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                                </div>
                                </div>

                    <div className="flex-1 bg-white rounded-xl border border-stone-200 relative overflow-hidden">
                        {/* Graph Implementation */}
                        <div className="absolute inset-0 m-8 border-l border-b border-stone-300">
                                <AnimatePresence>
                                    {videos.map((video) => {
                                        const inStack = contextStack.find(v => v.id === video.id);
                                        const rawXVal = getValue(video, xAxis);
                                        const rawYVal = getValue(video, yAxis);
                                        const xRaw = getLogPos(rawXVal, minX, maxX);
                                        const yRaw = getLogPos(rawYVal, minY, maxY);
                                        const x = Math.min(Math.max(xRaw, 5), 95);
                                        const y = Math.min(Math.max(yRaw, 5), 95);
                                        const size = 30 + Math.min((parseInt(video.viewCount) / maxViews) * 50, 50);

                                        return (
                                            <motion.div
                                                key={video.id}
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ 
                                                    opacity: 1, scale: 1, x: `${x}%`, y: `${100 - y}%`,
                                                }}
                                                whileHover={{ scale: 1.2, zIndex: 50 }}
                                                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                                                style={{ left: `${x}%`, top: `${100 - y}%`, width: size, height: size }}
                                                onClick={() => setPreviewVideo(video)}
                                            >
                                                <div className={cn(
                                                    "w-full h-full rounded-full overflow-hidden border-2 shadow-lg relative bg-stone-200 transition-all",
                                                    inStack ? "border-green-500 ring-2 ring-green-500 ring-offset-1" : "border-white"
                                                )}>
                                                    <img src={video.thumbnail} className="w-full h-full object-cover" />
                                                </div>

                                                {/* Hover Overlay with Plus Button (Fixed Position Outside Container) */}
                                                <div className="absolute -top-3 -right-3 p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                    <Button 
                                                        size="icon" 
                                                        className={cn("rounded-full h-6 w-6 shadow-md border border-black/10", inStack ? "bg-red-500 hover:bg-red-600 text-white" : "bg-white text-black hover:bg-stone-100")}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (inStack) removeFromContextStack(video.id);
                                                            else addToContextStack(video);
                                                        }}
                                                    >
                                                        {inStack ? <Minus size={14} /> : <Plus size={14} />}
                                                    </Button>
                                                </div>
                                                
                                                {/* Tooltip */}
                                                <div className={cn(
                                                    "absolute w-48 bg-stone-900/95 backdrop-blur text-white text-xs p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex flex-col gap-1 z-50",
                                                    y < 50 ? "bottom-full mb-2" : "top-full mt-2", 
                                                    x < 20 ? "left-0" : x > 80 ? "right-0" : "left-1/2 -translate-x-1/2"
                                                )}>
                                                    <p className="font-bold line-clamp-2">{video.title}</p>
                                                    <div className="flex justify-between text-stone-300 pt-1 border-t border-white/10 mt-1">
                                                        <span>{parseInt(video.viewCount).toLocaleString()} views</span>
                                                        <span className="text-green-400 font-bold">{video.outlierScore}x</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                    </div>
                </div>
            )}

            {activeTab === 'studio' && (
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex gap-2 bg-stone-100 p-1 rounded-lg">
                            <button
                                onClick={() => setStudioTab('generate')}
                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", studioTab === 'generate' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                            >
                                Generated Concepts
                            </button>
                            <button
                                onClick={() => setStudioTab('saved')}
                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", studioTab === 'saved' ? "bg-white shadow text-stone-900" : "text-stone-600 hover:text-stone-900")}
                            >
                                Saved Collection ({savedHooks.length})
                            </button>
                </div>

                        <div className="flex gap-2">
                             {studioTab === 'generate' && generatedHooks.length > 0 && (
                                 <Button variant="outline" onClick={() => setGeneratedHooks([])}>Clear Generated</Button>
                             )}
                        </div>
                    </div>

                    {/* Generated Hooks Section */}
                    {studioTab === 'generate' && (
                        <div className="mb-12">
                             {(generatedHooks.length > 0 || isLoading) ? (
                                 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {generatedHooks.map(hook => (
                                        <Card key={hook.id} className="p-5 border-2 border-stone-200 hover:border-purple-200 transition-all">
                                             <div className="flex justify-between items-start mb-3">
                                                 <h4 className="font-bold text-lg leading-tight text-stone-900">{hook.title}</h4>
                                                 <div className="flex gap-1">
                                                     <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleLike(hook.id)}>
                                                         <ThumbsUp size={14} className={hook.liked ? "text-green-500 fill-green-500" : "text-stone-400"} />
                                                     </Button>
                                                     <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveHook(hook)}>
                                                         <Save size={14} className={savedHooks.find(h => h.id === hook.id) ? "text-purple-500 fill-purple-500" : "text-stone-400"} />
                        </Button>
                    </div>
                                </div>
                                             <p className="text-stone-700 text-sm mb-4 leading-relaxed">{hook.hook}</p>
                                             
                                             {hook.generatedImages && hook.generatedImages.length > 0 ? (
                                                 <div className="space-y-2">
                                                    <img src={hook.generatedImages[hook.selectedImageIndex || 0]} className="w-full aspect-video object-cover rounded-md shadow-sm" />
                                                    <div className="flex gap-1 overflow-x-auto pb-1">
                                                        {hook.generatedImages.map((img, idx) => (
                                                            <button key={idx} onClick={() => selectImage(hook.id, idx)} className={cn("w-10 h-6 rounded overflow-hidden border flex-shrink-0", (hook.selectedImageIndex || 0) === idx ? "border-purple-500" : "border-transparent")}>
                                                                <img src={img} className="w-full h-full object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <Button className="w-full mt-2" onClick={() => handleStartResearchClick(hook)}>Start Research</Button>
                                                 </div>
                                             ) : (
                                                 <div className="space-y-2">
                                                     <p className="text-xs text-stone-500 italic">{hook.thumbnailConcept}</p>
                                                     <Button variant="outline" className="w-full text-stone-700" onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept)} disabled={hook.isGeneratingImage}>
                                                         {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={14} /> : <ImageIcon className="mr-2" size={14} />}
                                                         Generate Visuals
                                </Button>
                            </div>
                                             )}
                                        </Card>
                                    ))}
                                    
                                    {/* Streaming Placeholder */}
                                    {isLoading && (
                                        <Card className="p-5 border-2 border-dashed border-stone-300 bg-stone-50 flex flex-col items-center justify-center text-stone-400 min-h-[300px]">
                                            <Loader2 className="animate-spin mb-2" size={32} />
                                            <p className="text-sm font-medium">Generating creative angle...</p>
                                        </Card>
                                    )}
                    </div>
                             ) : (
                                 <div className="text-center py-20 border-2 border-dashed border-stone-200 rounded-xl text-stone-500">
                                    <Sparkles className="mx-auto mb-4 opacity-30" size={48} />
                                    <p>Select videos from the feed or analysis to generate hooks.</p>
                </div>
            )}
                        </div>
                    )}

                    {/* Saved Hooks Section */}
                    {studioTab === 'saved' && (
                        <div>
                         {savedHooks.length === 0 ? (
                             <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-xl text-stone-500">
                                 No saved hooks yet. Generate and save ideas!
                             </div>
                         ) : (
                             <div className="space-y-4">
                                 {savedHooks.map(hook => (
                                     <div key={hook.id} className="bg-white p-4 rounded-xl border border-stone-200 flex gap-4 items-start shadow-sm">
                                         <div className="w-48 flex-shrink-0 space-y-2">
                                            {hook.generatedImages && hook.generatedImages.length > 0 ? (
                                                <div className="space-y-2">
                                                    <img src={hook.generatedImages[hook.selectedImageIndex || 0]} className="w-full aspect-video object-cover rounded-lg shadow-sm" />
                                                    
                                                    {hook.generatedImages.length > 1 && (
                                                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                                            {hook.generatedImages.map((img, idx) => (
                                                                <button 
                                                                    key={idx} 
                                                                    onClick={() => selectImage(hook.id, idx)} 
                                                                    className={cn(
                                                                        "w-12 h-8 rounded overflow-hidden border flex-shrink-0 transition-all", 
                                                                        (hook.selectedImageIndex || 0) === idx ? "border-purple-500 ring-2 ring-purple-200" : "border-transparent opacity-70 hover:opacity-100"
                                                                    )}
                                                                >
                                                                    <img src={img} className="w-full h-full object-cover" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="flex gap-1">
                                                        <Button variant="outline" size="sm" className="flex-1 text-stone-700 text-xs px-2" onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept)} disabled={hook.isGeneratingImage}>
                                                            {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={12}/> : <RefreshCw size={12} className="mr-2"/>}
                                                            Regenerate
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="flex-1 text-stone-700 text-xs px-2" onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept, true)} disabled={hook.isGeneratingImage}>
                                                            {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={12}/> : <Plus size={12} className="mr-2"/>}
                                                            Add More
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="w-full aspect-video bg-stone-100 rounded-lg flex items-center justify-center text-stone-400">
                                                        <ImageIcon size={20} />
                                                    </div>
                                                    <Button variant="outline" size="sm" className="w-full text-stone-700" onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept)} disabled={hook.isGeneratingImage}>
                                                        {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={12}/> : <RefreshCw size={12} className="mr-2"/>}
                                                        Generate
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                         <div className="flex-1 min-w-0">
                                             <div className="flex justify-between">
                                                 <Input 
                                                    value={hook.title} 
                                                    onChange={(e) => updateSavedHookTitle(hook.id, e.target.value)}
                                                    className="font-bold text-lg border-transparent hover:border-stone-200 px-0 h-auto mb-1 text-stone-900 focus:ring-0"
                                                 />
                                                 <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => deleteSavedHook(hook.id)}>
                                                     <Trash2 size={16} />
                                                 </Button>
                                             </div>
                                             <p className="text-stone-700 text-sm mb-3 leading-relaxed">{hook.hook}</p>
                                             
                                             {hook.analysis ? (
                                                 <div className="bg-indigo-50 p-3 rounded text-sm text-indigo-900 border border-indigo-100 relative group/analysis">
                                                     <div className="font-bold flex justify-between mb-1">
                                                         <span>AI Score: {hook.analysis.score}/10</span>
                                                         <Button 
                                                             variant="ghost" 
                                                             size="icon" 
                                                             className="h-5 w-5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100"
                                                             onClick={() => analyzeHook(hook)}
                                                             title="Regenerate Analysis"
                                                             disabled={hook.isAnalyzing}
                                                         >
                                                             {hook.isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                         </Button>
                                                     </div>
                                                     {hook.analysis.feedback}
                                                 </div>
                                             ) : (
                                                 <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50" onClick={() => analyzeHook(hook)} disabled={hook.isAnalyzing}>
                                                     {hook.isAnalyzing ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Activity size={14} className="mr-2" />}
                                                     {hook.isAnalyzing ? "Analyzing..." : "Analyze"}
                                                 </Button>
                                             )}
                                             
                                             <div className="mt-4 flex justify-end">
                                                 <Button onClick={() => handleStartResearchClick(hook)}>Start Research <ArrowLeft className="ml-2 rotate-180" size={16}/></Button>
                                </div>
                                </div>
                            </div>
                        ))}
                    </div>
                         )}
                </div>
                    )}
                </div>
            )}

            {activeTab === 'breakdown' && <ChannelBreakdown />}
            </div>

        {/* Right Sidebar (Context Stack) */}
        <AnimatePresence>
            {isSidebarOpen && (
                <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-white border-l border-stone-200 flex flex-col h-full shadow-xl z-30"
                >
                    <div className="p-4 border-b border-stone-200 flex flex-col gap-4 bg-stone-50">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-stone-900">Context Stack</h3>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500" onClick={() => setIsSidebarOpen(false)}><ChevronRight size={16}/></Button>
                        </div>
                        
                        {/* Saved Stacks Toggle */}
              <div className="flex items-center justify-between">
                           <span className="text-xs font-bold text-stone-600 uppercase">Saved Stacks</span>
                           <Button onClick={() => setShowSavedStacks(!showSavedStacks)} variant="ghost" size="sm" className="h-6 px-2">
                               <FolderOpen size={14} className={cn("transition-colors", showSavedStacks ? "text-purple-500" : "text-stone-400")} />
                           </Button>
              </div>
              
                        {showSavedStacks && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="bg-stone-100 p-2 rounded space-y-1 overflow-hidden"
                            >
                                {savedContextStacks.length === 0 ? (
                                    <p className="text-xs text-stone-500 italic text-center py-2">No saved stacks</p>
                                ) : (
                                    savedContextStacks.map(stack => (
                                        <div key={stack.id} className="flex justify-between items-center bg-white p-1.5 rounded border border-stone-200 text-xs group">
                                            <button onClick={() => { loadContextStack(stack); setShowSavedStacks(false); }} className="font-medium hover:underline text-left truncate flex-1 text-stone-800">
                                                {stack.name}
                        </button>
                                            <button onClick={() => deleteSavedStack(stack.id)} className="text-stone-300 hover:text-red-500 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={12} />
                        </button>
                                        </div>
                                    ))
                                )}
                            </motion.div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {contextStack.length === 0 ? (
                            <div className="text-center text-stone-500 text-sm py-8">
                                <ListPlus size={32} className="mx-auto mb-2 opacity-40" />
                                <p>Select videos from Feed or Analysis to build context</p>
                      </div>
                        ) : (
                            <>
                                <div className="flex gap-2 mb-4 items-center relative">
                                    {isGeneratingName && (
                                        <div className="absolute right-16 top-1/2 -translate-y-1/2 z-10">
                                            <Loader2 size={14} className="animate-spin text-stone-400" />
                                        </div>
                                    )}
                                    
                                    {isStackNameEditing ? (
                                        <Input 
                                            placeholder="Stack name..." 
                                            value={stackName} 
                                            onChange={(e) => setStackName(e.target.value)}
                                            onBlur={() => setIsStackNameEditing(false)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') setIsStackNameEditing(false);
                                            }}
                                            autoFocus
                                            className="h-8 text-sm text-stone-900 font-bold"
                                        />
                                    ) : (
                                        <div 
                                            onDoubleClick={() => setIsStackNameEditing(true)}
                                            className={cn(
                                                "h-8 text-sm flex items-center px-3 border border-transparent rounded flex-1 truncate cursor-text select-none font-semibold text-stone-900",
                                                !stackName && "text-stone-400 italic font-normal"
                                            )}
                                            title="Double click to edit"
                                        >
                                            {stackName || "Generating Name..."}
                                        </div>
                                    )}
                                    
                                    <Button size="sm" variant="outline" onClick={saveContextStack} disabled={!stackName} className="text-stone-700 flex-shrink-0">Save</Button>
                      </div>
                                
                                <div className="space-y-3">
                                    {contextStack.map((video) => (
                                        <div key={video.id} className="bg-white rounded-lg p-2 border border-stone-200 relative group shadow-sm">
                                            <div className="flex gap-3">
                                                <img src={video.thumbnail} className="w-20 h-12 object-cover rounded border border-stone-100" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold line-clamp-2 text-stone-900">{video.title}</p>
                                                    <p className="text-[10px] text-stone-500 mt-1 truncate">{video.channelTitle}</p>
                                    </div>
                                 </div>
                                         <button 
                                                onClick={() => removeFromContextStack(video.id)}
                                                className="absolute -top-2 -right-2 bg-white border border-stone-200 rounded-full p-1 text-stone-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                         </button>
                                        </div>
                                     ))}
                                 </div>
                            </>
                        )}
                    </div>
                    
                    <div className="p-4 border-t border-stone-200 bg-stone-50">
                            <Button 
                            className="w-full text-stone-50" 
                            disabled={contextStack.length === 0 || isLoading}
                            onClick={() => generateHooks(undefined, false, contextStack)}
                        >
                            {isLoading ? <Loader2 className="animate-spin mr-2"/> : <Sparkles className="mr-2"/>}
                            Generate Batch
                            </Button>
                        <p className="text-[10px] text-stone-500 text-center mt-2">
                            Generates ideas based on {contextStack.length} context videos
                        </p>
                        </div>
                </motion.div>
            )}
        </AnimatePresence>

                  </div>

      {/* Preview Modal */}
        <AnimatePresence>
            {previewVideo && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8" onClick={() => setPreviewVideo(null)}>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-xl overflow-hidden max-w-4xl w-full max-h-full flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="aspect-video bg-black">
                             <iframe 
                                src={`https://www.youtube.com/embed/${previewVideo.id}?autoplay=1`} 
                                className="w-full h-full"
                            allowFullScreen
                        />
                        </div>
                    <div className="p-6 bg-white flex justify-between items-start">
                                <div>
                            <h2 className="text-xl font-bold mb-2 text-stone-900">{previewVideo.title}</h2>
                            <p className="text-stone-600">{previewVideo.channelTitle} • {parseInt(previewVideo.viewCount).toLocaleString()} views</p>
                                    </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => {
                                if (contextStack.find(v => v.id === previewVideo.id)) removeFromContextStack(previewVideo.id);
                                else addToContextStack(previewVideo);
                            }} className="text-stone-700">
                                {contextStack.find(v => v.id === previewVideo.id) ? "Remove from Stack" : "Add to Stack"}
                                </Button>
                            <Button onClick={() => {
                                generateHooks(previewVideo);
                                        setPreviewVideo(null);
                            }} className="text-stone-50">
                                Generate Hooks
                                </Button>
                            </div>
                        </div>
                    </motion.div>
            </div>
            )}
        </AnimatePresence>
    </div>
  );
}
