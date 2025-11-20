'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Play, Search, ThumbsUp, Loader2, Check, X, Image as ImageIcon, ArrowLeft, Plus, BarChart2, TrendingUp, Activity, Eye, Heart, Users, Calendar, Clock, Settings2, ListPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  analysis?: {
      score: number;
      feedback: string;
      improvementSuggestion: string;
  };
}

interface HookGeneratorProps {
  onStartResearch?: (data: { title: string, hook: string, image?: string }) => void;
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

export function HookGenerator({ onStartResearch }: HookGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'outliers' | 'studio'>('trends');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const [previewVideo, setPreviewVideo] = useState<TrendingVideo | null>(null); 
  const [generatedHooks, setGeneratedHooks] = useState<HookIdea[]>([]);
  const [savedHooks, setSavedHooks] = useState<HookIdea[]>([]); // Saved Hooks
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('');
  const [recency, setRecency] = useState<string>('');
  
  // Outlier Graph Config
  const [xAxis, setXAxis] = useState<string>('outlierScore');
  const [yAxis, setYAxis] = useState<string>('viewCount');

  // Select Mode
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<TrendingVideo[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);

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
      if (videos.length > 0 || searchQuery) {
          fetchTrends(null, true);
      }
  }, [recency]);

  const generateHooks = async (video?: TrendingVideo, useLiked = false, batchVideos?: TrendingVideo[]) => {
    setIsLoading(true);
    
    // Batch Mode
    if (batchVideos) {
        if (batchVideos.length > 0) {
             setSelectedVideo(batchVideos[0]); // Focus on first
        }
    } else if (video && !useLiked) {
        setSelectedVideo(video);
    }

    setPreviewVideo(null);
    
    const targetVideo = video || (batchVideos ? batchVideos[0] : selectedVideo);
    if (!targetVideo) { setIsLoading(false); return; }

    const likedHooks = useLiked ? generatedHooks.filter(h => h.liked) : [];
    
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'generate_hooks', 
          video: targetVideo, 
          likedHooks 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.hooks) {
        if (useLiked) {
            setGeneratedHooks(prev => [...prev.filter(h => h.liked), ...data.hooks]);
        } else {
            setGeneratedHooks(data.hooks);
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
      // Find if it's in generated or saved list to update loading state
      const updateHook = (id: string, updates: Partial<HookIdea>) => {
          setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
          setGeneratedHooks(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
      };
      
      // Add loading state if I had one for analysis... using isGeneratingImage for now or ignore
      
      try {
          const res = await fetch('/api/hooks', {
            method: 'POST',
            body: JSON.stringify({ action: 'analyze_hook', title: hook.title, hook: hook.hook }),
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          updateHook(hook.id, { analysis: data });
      } catch (e) {
          console.error(e);
      }
  };

  const generateThumbnailImage = async (id: string, concept: string) => {
      // Update both lists just in case
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
            const update = { generatedImages: data.images, selectedImageIndex: 0, isGeneratingImage: false };
            setGeneratedHooks(prev => prev.map(h => h.id === id ? { ...h, ...update } : h));
            setSavedHooks(prev => prev.map(h => h.id === id ? { ...h, ...update } : h));
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

  const clearSelection = () => {
      setSelectedVideo(null);
      setGeneratedHooks([]);
  };

  const toggleSelectVideo = (video: TrendingVideo) => {
      if (selectedVideos.find(v => v.id === video.id)) {
          setSelectedVideos(prev => prev.filter(v => v.id !== video.id));
      } else {
          setSelectedVideos(prev => [...prev, video]);
      }
  };

  const getViralityScore = (video: TrendingVideo) => {
      if (!video.viewCount || !video.subscriberCount) return null;
      const views = parseInt(video.viewCount);
      const subs = parseInt(video.subscriberCount);
      if (subs === 0) return null;
      return (views / subs).toFixed(1) + 'x';
  };

  // --- Outlier Graph Logic ---
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

  // Derived maxViews for bubble sizing specifically (using viewCount regardless of axis)
  const maxViews = Math.max(...videos.map(v => parseInt(v.viewCount) || 0), 1);

  return (
    <div className="h-full flex flex-col bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-stone-200 bg-white space-y-4 z-20 relative shadow-sm">
        {/* ... header code ... */}
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-stone-900 mb-1">Hook & Trend Generator</h1>
                <p className="text-stone-600">Discover trending formats and generate viral hooks using AI.</p>
            </div>
            {!selectedVideo && (
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsSelectMode(!isSelectMode)}
                        className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all border", isSelectMode ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50")}
                    >
                        <ListPlus className="inline-block mr-2 w-4 h-4" /> Select Mode
                    </button>
                    <div className="flex bg-stone-100 p-1 rounded-lg">
                        <button 
                            onClick={() => { setActiveTab('trends'); setVideos([]); fetchTrends(null, true); }}
                            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'trends' ? "bg-white shadow text-stone-900" : "text-stone-500 hover:text-stone-900")}
                        >
                            <TrendingUp className="inline-block mr-2 w-4 h-4" /> Feed
                        </button>
                        <button 
                            onClick={() => { setActiveTab('outliers'); setVideos([]); fetchTrends(null, true); }}
                            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'outliers' ? "bg-white shadow text-stone-900" : "text-stone-500 hover:text-stone-900")}
                        >
                            <Activity className="inline-block mr-2 w-4 h-4" /> Outlier Analysis
                        </button>
                        <button 
                            onClick={() => { setActiveTab('studio'); setSelectedVideo(null); }}
                            className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === 'studio' ? "bg-white shadow text-stone-900" : "text-stone-500 hover:text-stone-900")}
                        >
                            <Sparkles className="inline-block mr-2 w-4 h-4" /> Hook Studio
                        </button>
                    </div>
                </div>
            )}
        </div>
        
        {!selectedVideo && activeTab !== 'studio' && (
            <div className="space-y-3">
                {/* Search & Filters */}
                <div className="flex gap-2 max-w-xl">
                    <Input 
                        placeholder={activeTab === 'outliers' ? "Enter niche to analyze outliers..." : "Search topic (optional)..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchTrends(null, true)}
                        className="text-stone-900 placeholder-stone-500 font-medium"
                    />
                    <Button onClick={() => fetchTrends(null, true)} disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" size={18} />}
                        {activeTab === 'outliers' ? 'Analyze' : 'Find Trends'}
                    </Button>
                </div>
                
                {/* Axis Config (Outliers Only) */}
                {activeTab === 'outliers' && (
                    <div className="flex items-center gap-4 p-3 bg-stone-50 rounded-lg border border-stone-200">
                        <div className="flex items-center gap-2">
                            <Settings2 size={14} className="text-stone-400" />
                            <span className="text-xs font-bold text-stone-500 uppercase">X-Axis:</span>
                            <select 
                                value={xAxis}
                                onChange={(e) => setXAxis(e.target.value)}
                                className="bg-white border border-stone-200 text-xs rounded px-2 py-1 text-stone-700 focus:outline-none"
                            >
                                {AXIS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-500 uppercase">Y-Axis:</span>
                            <select 
                                value={yAxis}
                                onChange={(e) => setYAxis(e.target.value)}
                                className="bg-white border border-stone-200 text-xs rounded px-2 py-1 text-stone-700 focus:outline-none"
                            >
                                {AXIS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Other Filters */}
                <div className="flex flex-wrap items-center gap-4">
                     <div className="flex gap-2">
                         <Button 
                            variant={filter === '' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            onClick={() => { setFilter(''); fetchTrends(null, true); }}
                        >
                            All Types
                         </Button>
                         <Button 
                            variant={filter === 'no face' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            onClick={() => { setFilter('no face'); fetchTrends(null, true); }}
                        >
                            No Face / Faceless
                         </Button>
                         <Button 
                            variant={filter === 'infographic' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            onClick={() => { setFilter('infographic'); fetchTrends(null, true); }}
                        >
                            Data / Infographic
                         </Button>
                     </div>
                     <div className="h-6 w-px bg-stone-200 mx-2" />
                     <div className="flex gap-2">
                         {RECENCY_OPTIONS.map((opt) => (
                             <Button
                                key={opt.value}
                                variant={recency === opt.value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setRecency(opt.value)}
                                className={cn(recency === opt.value && "bg-stone-200")}
                             >
                                {recency === opt.value && <Calendar size={14} className="mr-1.5" />}
                                {opt.label}
                             </Button>
                         ))}
                     </div>
                </div>
            </div>
        )}
         {selectedVideo && (
            <Button variant="outline" onClick={clearSelection}>
                <ArrowLeft className="mr-2" size={16} /> Back to {activeTab === 'outliers' ? 'Analysis' : 'Trends'}
            </Button>
        )}
      </div>


      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 relative" ref={containerRef}>
        {activeTab === 'studio' ? (
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-stone-900">Hook Studio</h2>
                    <span className="text-stone-500">{savedHooks.length} Saved Hooks</span>
                </div>

                {savedHooks.length === 0 ? (
                    <div className="text-center py-20 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                        <Sparkles className="mx-auto mb-4 opacity-50" size={48} />
                        <p>Save generated hooks to refine them here</p>
                        <Button variant="link" onClick={() => setActiveTab('trends')}>Find Trends</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {savedHooks.map((hook) => (
                            <div key={hook.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 flex flex-col md:flex-row gap-6">
                                {/* Visuals Column */}
                                <div className="w-full md:w-1/3 space-y-4">
                                     {hook.generatedImages && hook.generatedImages.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-100 border border-stone-200 relative">
                                               <img 
                                                   src={hook.generatedImages[hook.selectedImageIndex || 0]} 
                                                   alt="Generated thumbnail" 
                                                   className="w-full h-full object-cover" 
                                               />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {hook.generatedImages.map((img, idx) => (
                                                    <button 
                                                       key={idx}
                                                       onClick={() => selectImage(hook.id, idx)}
                                                       className={cn(
                                                           "w-16 h-9 rounded overflow-hidden flex-shrink-0 border-2 transition-all",
                                                           (hook.selectedImageIndex || 0) === idx ? "border-purple-500 ring-1 ring-purple-500" : "border-transparent opacity-70 hover:opacity-100"
                                                       )}
                                                    >
                                                        <img src={img} className="w-full h-full object-cover" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                   ) : (
                                       <div className="aspect-video w-full rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 border border-stone-200 border-dashed">
                                           <ImageIcon size={24} />
                                       </div>
                                   )}
                                   
                                   <Button 
                                       variant="outline" 
                                       size="sm" 
                                       className="w-full"
                                       onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept)}
                                       disabled={hook.isGeneratingImage}
                                   >
                                       {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={14} /> : <RefreshCw className="mr-2" size={14} />}
                                       {hook.generatedImages ? 'Regenerate Visuals' : 'Generate Visuals'}
                                   </Button>
                                </div>

                                {/* Content Column */}
                                <div className="flex-1 space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500">Title</label>
                                        <Input 
                                            value={hook.title} 
                                            onChange={(e) => updateSavedHookTitle(hook.id, e.target.value)}
                                            className="text-lg font-bold text-stone-900 h-auto py-2"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-stone-500">Hook Concept</label>
                                        <p className="text-stone-700 text-sm leading-relaxed p-3 bg-stone-50 rounded-md border border-stone-100">
                                            {hook.hook}
                                        </p>
                                    </div>

                                    {/* Analysis Section */}
                                    {hook.analysis ? (
                                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                                                    <Sparkles size={16} className="text-indigo-500" /> AI Analysis
                                                </h4>
                                                <span className="bg-indigo-200 text-indigo-800 font-bold px-2 py-0.5 rounded text-sm">
                                                    {hook.analysis.score}/10
                                                </span>
                                            </div>
                                            <p className="text-sm text-indigo-800">{hook.analysis.feedback}</p>
                                            <div className="text-xs text-indigo-600 font-medium mt-2">
                                                💡 Tip: {hook.analysis.improvementSuggestion}
                                            </div>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => analyzeHook(hook)} className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                            <Activity size={14} className="mr-2" /> Get AI Analysis
                                        </Button>
                                    )}

                                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                                        <Button variant="outline" onClick={() => deleteSavedHook(hook.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100">
                                            <Trash2 size={16} className="mr-2" /> Remove
                                        </Button>
                                        <Button onClick={() => handleStartResearchClick(hook)}>
                                            Start Research <ArrowLeft className="ml-2 rotate-180" size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ) : !selectedVideo ? (
          <>
            {activeTab === 'trends' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((video) => {
                            const virality = getViralityScore(video);
                            const isSelected = selectedVideos.some(v => v.id === video.id);
                            return (
                            <Card 
                                key={video.id} 
                                className={cn(
                                    "overflow-hidden hover:shadow-lg transition-all cursor-pointer group flex flex-col border-2",
                                    isSelected ? "border-stone-900 ring-2 ring-stone-900 ring-offset-2" : "border-transparent"
                                )}
                                onClick={() => isSelectMode ? toggleSelectVideo(video) : setPreviewVideo(video)}
                            >
                                <div className="relative aspect-video bg-stone-200">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                
                                {isSelectMode ? (
                                     <div className={cn("absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors", isSelected ? "bg-stone-900 border-stone-900 text-white" : "bg-black/50 border-white text-transparent")}>
                                         <Check size={14} />
                                     </div>
                                ) : (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <Button variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Eye className="mr-2" size={16} /> Preview
                                        </Button>
                                    </div>
                                )}
                                {virality && (
                                    <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm flex items-center">
                                        <BarChart2 size={12} className="mr-1" /> {virality} Viral
                                    </div>
                                )}
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-semibold line-clamp-2 mb-1">{video.title}</h3>
                                <div className="flex items-center justify-between text-sm text-stone-500 mt-auto">
                                    <span className="truncate pr-2">{video.channelTitle}</span>
                                    <span className="whitespace-nowrap">{parseInt(video.viewCount).toLocaleString()} views</span>
                                </div>
                                </div>
                            </Card>
                            );
                        })}
                    </div>
                    
                    {videos.length > 0 && nextPageToken && (
                        <div className="flex justify-center pt-4">
                            <Button variant="outline" onClick={() => fetchTrends(nextPageToken)} disabled={isLoading}>
                                {isLoading && <Loader2 className="animate-spin mr-2" size={16} />}
                                Load More Videos
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'outliers' && (
                <div className="min-h-[600px] w-full bg-stone-50 rounded-xl border border-stone-200 relative overflow-hidden p-8">
                    {videos.length === 0 && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                            <p>Enter a niche to analyze outliers</p>
                        </div>
                    )}
                    
                    {videos.length > 0 && (
                        <>
                            {/* Graph Axes */}
                            <div className="absolute left-12 bottom-12 right-8 top-8 border-l border-b border-stone-300">
                                {/* Y Label */}
                                <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-bold text-stone-500 tracking-wider">
                                    {AXIS_OPTIONS.find(o => o.value === yAxis)?.label || yAxis} (Log)
                                </div>
                                {/* X Label */}
                                <div className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-xs font-bold text-stone-500 tracking-wider">
                                    {AXIS_OPTIONS.find(o => o.value === xAxis)?.label || xAxis} (Log)
                                </div>

                                {/* Grid Lines */}
                                <div className="absolute left-0 top-1/4 w-full h-px bg-stone-100" />
                                <div className="absolute left-0 top-2/4 w-full h-px bg-stone-100" />
                                <div className="absolute left-0 top-3/4 w-full h-px bg-stone-100" />
                                
                                {/* Bubbles */}
                                <AnimatePresence>
                                    {videos.map((video) => {
                                        const isSelected = selectedVideos.some(v => v.id === video.id);
                                        const rawXVal = getValue(video, xAxis);
                                        const rawYVal = getValue(video, yAxis);

                                        // Log Scale
                                        const xRaw = getLogPos(rawXVal, minX, maxX);
                                        const yRaw = getLogPos(rawYVal, minY, maxY);
                                        
                                        // Clamp strictly within visible area (5% - 95%)
                                        const x = Math.min(Math.max(xRaw, 5), 95);
                                        const y = Math.min(Math.max(yRaw, 5), 95);
                                        
                                        const size = 40 + Math.min((parseInt(video.viewCount) / maxViews) * 60, 60);

                                        return (
                                            <motion.div
                                                key={video.id}
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ 
                                                    opacity: 1, 
                                                    scale: 1, 
                                                    x: `${x}%`, 
                                                    y: `${100 - y}%`,
                                                    borderWidth: isSelected ? 4 : 0,
                                                    borderColor: isSelected ? '#1c1917' : 'transparent'
                                                }}
                                                className={cn(
                                                    "absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-50 rounded-full transition-colors",
                                                    isSelected && "z-40"
                                                )}
                                                style={{ 
                                                    left: `${x}%`, 
                                                    top: `${100 - y}%`,
                                                    width: size,
                                                    height: size
                                                }}
                                                onClick={() => isSelectMode ? toggleSelectVideo(video) : setPreviewVideo(video)}
                                                whileHover={{ scale: 1.2, zIndex: 100 }}
                                            >
                                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white shadow-lg relative bg-stone-200">
                                                    <img src={video.thumbnail} className="w-full h-full object-cover" alt={video.title} />
                                                    {isSelectMode && isSelected && (
                                                        <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center">
                                                            <Check className="text-white" size={20} />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Tooltip - Reversed Vertical Logic & Clamped Horizontal */}
                                                <div className={cn(
                                                    "absolute left-1/2 -translate-x-1/2 w-64 bg-stone-900/95 backdrop-blur-sm text-white text-xs p-3 rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 flex flex-col gap-1",
                                                    y < 40 ? "bottom-full mb-3" : "top-full mt-3", // Reversed: if Y is small (bottom), show tooltip ABOVE. If Y is large (top), show BELOW.
                                                    x < 20 ? "left-0 translate-x-0" : "", 
                                                    x > 80 ? "right-0 left-auto translate-x-0" : ""
                                                )}>
                                                    <p className="font-bold line-clamp-2 text-sm">{video.title}</p>
                                                    <div className="flex justify-between text-stone-300 mt-1 border-t border-white/10 pt-2">
                                                        <span>{parseInt(video.viewCount).toLocaleString()} views</span>
                                                        <span className="text-green-400 font-bold">{video.outlierScore?.toFixed(1)}x Outlier</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Selected List (Vertical) */}
            {isSelectMode && selectedVideos.length > 0 && (
                <div className="mt-8 border-t border-stone-200 pt-6 pb-20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-stone-900">Selected Videos ({selectedVideos.length})</h3>
                        <Button size="sm" onClick={() => generateHooks(undefined, false, selectedVideos)}>
                            <Sparkles size={14} className="mr-2" /> Generate Batch Hooks
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {selectedVideos.map(v => (
                            <div key={v.id} className="flex gap-4 items-center bg-white p-3 rounded-lg border border-stone-200 shadow-sm">
                                <img src={v.thumbnail} className="w-32 h-20 object-cover rounded-md" alt={v.title} />
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm line-clamp-1 text-stone-900">{v.title}</h4>
                                    <p className="text-xs text-stone-500 mt-1">{v.channelTitle} • {parseInt(v.viewCount).toLocaleString()} views</p>
                                    {v.outlierScore && (
                                        <span className="inline-block mt-2 bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded font-bold">
                                            {v.outlierScore}x Outlier
                                        </span>
                                    )}
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => toggleSelectVideo(v)}>
                                    <Trash2 size={16} className="text-stone-400 hover:text-red-500" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </>
        ) : (
          // ... rest of component ...
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Selected Video Info */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                 <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                     <h2 className="font-bold text-stone-900">Source Content ({(selectedVideos.length > 0 && isSelectMode) ? selectedVideos.length : 1} Videos)</h2>
                     <Button onClick={() => generateHooks(selectedVideo, true)} disabled={isLoading} size="sm" variant="outline">
                        <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} size={14} />
                        Regenerate
                    </Button>
                </div>
                <div className="p-6 overflow-x-auto">
                    <div className="flex gap-6 pb-2">
                        {((selectedVideos.length > 0 && isSelectMode) ? selectedVideos : [selectedVideo]).map((video) => (
                            <div key={video.id} className="w-72 flex-shrink-0 flex flex-col gap-3">
                                <div className="relative aspect-video">
                                    <img src={video.thumbnail} alt={video.title} className="w-full h-full rounded-lg shadow-md object-cover" />
                                    {video.outlierScore && (
                                        <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                                            {video.outlierScore}x
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm line-clamp-2 text-stone-900 leading-tight">{video.title}</h3>
                                    <p className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                                        {video.channelTitle} <span className="text-stone-300">•</span> {parseInt(video.viewCount).toLocaleString()} views
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hooks Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-stone-900">Generated Concepts</h3>
                    {isLoading && <Loader2 className="animate-spin text-stone-400" size={20} />}
                  </div>
                  <span className="text-sm text-stone-500 font-medium">{generatedHooks.length} ideas found</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {generatedHooks.map((hook) => (
                  <Card key={hook.id} className={cn(
                      "p-6 relative transition-all border-2 flex flex-col",
                      hook.liked ? "border-green-500 bg-green-50/30" : "border-stone-200"
                  )}>
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <button 
                            onClick={() => saveHook(hook)}
                            className={cn(
                                "p-1.5 rounded-full transition-colors border", 
                                savedHooks.find(h => h.id === hook.id) ? "bg-purple-100 text-purple-600 border-purple-200" : "bg-white text-stone-400 border-stone-200 hover:border-purple-200 hover:text-purple-600"
                            )}
                            title="Save to Studio"
                        >
                            {savedHooks.find(h => h.id === hook.id) ? <Check size={16} /> : <ListPlus size={16} />}
                        </button>
                        <button 
                            onClick={() => handleLike(hook.id)}
                            className={cn(
                                "p-1.5 rounded-full transition-colors border", 
                                hook.liked ? "bg-green-100 text-green-600 border-green-200" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                            )}
                            title="Like this idea"
                        >
                            <ThumbsUp size={16} />
                        </button>
                        <button 
                            onClick={() => handleDiscard(hook.id)}
                            className="p-1.5 rounded-full bg-white text-stone-400 border border-stone-200 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Discard"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-4 mt-2 flex-1">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Title</span>
                        <p className="text-lg font-bold leading-tight mt-1 text-stone-900">{hook.title}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Hook</span>
                        <p className="text-stone-700 mt-1 text-sm leading-relaxed font-medium">{hook.hook}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-2">Thumbnail Concept</span>
                        <p className="text-xs text-stone-600 italic mb-3">{hook.thumbnailConcept}</p>
                        
                        {hook.generatedImages && hook.generatedImages.length > 0 ? (
                             <div className="space-y-2">
                                 <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-100 border border-stone-200 relative group">
                                    <img 
                                        src={hook.generatedImages[hook.selectedImageIndex || 0]} 
                                        alt="Generated thumbnail" 
                                        className="w-full h-full object-cover" 
                                    />
                                    {/* Overlay for Research Action */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                        <Button size="sm" onClick={() => handleStartResearchClick(hook)}>
                                            <Plus className="mr-2" size={16} /> Start Research
                                        </Button>
                                    </div>
                                 </div>
                                 {/* Thumbnail Selector */}
                                 <div className="flex gap-2 overflow-x-auto pb-2">
                                     {hook.generatedImages.map((img, idx) => (
                                         <button 
                                            key={idx}
                                            onClick={() => selectImage(hook.id, idx)}
                                            className={cn(
                                                "w-16 h-9 rounded overflow-hidden flex-shrink-0 border-2 transition-all",
                                                (hook.selectedImageIndex || 0) === idx ? "border-purple-500 ring-1 ring-purple-500" : "border-transparent opacity-70 hover:opacity-100"
                                            )}
                                         >
                                             <img src={img} className="w-full h-full object-cover" />
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        ) : (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => generateThumbnailImage(hook.id, hook.thumbnailConcept)}
                                disabled={hook.isGeneratingImage}
                            >
                                {hook.isGeneratingImage ? <Loader2 className="animate-spin mr-2" size={14} /> : <ImageIcon className="mr-2" size={14} />}
                                Generate 4 Visuals
                            </Button>
                        )}
                      </div>
                    </div>
                    
                    {hook.generatedImages && (
                        <div className="pt-4 mt-4 border-t border-stone-100">
                            <Button 
                                className="w-full" 
                                variant={hook.liked ? "default" : "outline"}
                                onClick={() => handleStartResearchClick(hook)}
                            >
                                Start Research with this Concept
                            </Button>
                        </div>
                    )}
                  </Card>
                ))}
              </div>

              {/* Load More / Generate More Button */}
              {generatedHooks.length > 0 && generatedHooks.some(h => h.liked) && (
                  <div className="flex justify-center py-8">
                      <Button 
                        size="lg" 
                        className="bg-stone-900 text-white hover:bg-stone-800 shadow-xl"
                        onClick={() => generateHooks(undefined, true, (selectedVideos.length > 0 && isSelectMode) ? selectedVideos : undefined)}
                        disabled={isLoading}
                      >
                          {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                          Generate More Creative Variations
                      </Button>
                  </div>
              )}
            </div>
          </div>
        )}
        
        {!isLoading && videos.length === 0 && !selectedVideo && activeTab === 'trends' && (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <Play size={48} className="mb-4 opacity-50" />
            <p>Search or click "Find Trends" to get started</p>
          </div>
        )}

        {/* Video Preview Modal */}
        <AnimatePresence>
            {previewVideo && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setPreviewVideo(null)}
                >
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", duration: 0.3 }}
                        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative aspect-video bg-black">
                             <iframe 
                                width="100%" 
                                height="100%" 
                                src={`https://www.youtube.com/embed/${previewVideo.id}?autoplay=1`} 
                                title={previewVideo.title} 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="w-full h-full"
                            />
                            <button 
                                onClick={() => setPreviewVideo(null)}
                                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-32 flex-shrink-0">
                                    <img src={previewVideo.thumbnail} alt="Thumbnail" className="w-full rounded-md shadow-sm" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-stone-900 mb-2">{previewVideo.title}</h2>
                                    <div className="flex flex-wrap gap-4 text-sm text-stone-600">
                                        <span className="flex items-center gap-1 font-medium text-stone-900">
                                            <Users size={16} /> {previewVideo.channelTitle}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Eye size={16} /> {parseInt(previewVideo.viewCount).toLocaleString()} views
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm text-stone-600 mb-4">
                                {previewVideo.likeCount && (
                                    <span className="flex items-center gap-1">
                                        <Heart size={16} /> {parseInt(previewVideo.likeCount).toLocaleString()} likes
                                    </span>
                                )}
                                {previewVideo.outlierScore && (
                                     <span className="flex items-center gap-1 text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
                                        <Activity size={16} /> {previewVideo.outlierScore}x Outlier
                                    </span>
                                )}
                                <span className="flex items-center gap-1 text-stone-500">
                                    <Calendar size={16} /> {new Date(previewVideo.publishedAt).toLocaleDateString()}
                                </span>
                            </div>
                            
                            <div className="bg-stone-50 p-4 rounded-lg mb-6 border border-stone-100">
                                <h3 className="text-xs font-bold uppercase text-stone-500 mb-2">Description</h3>
                                <p className="text-sm text-stone-700 whitespace-pre-wrap font-medium leading-relaxed">{previewVideo.description?.slice(0, 500)}...</p>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setPreviewVideo(null)}>
                                    Close
                                </Button>
                                <Button 
                                    variant="secondary"
                                    onClick={() => {
                                        toggleSelectVideo(previewVideo);
                                        setPreviewVideo(null);
                                    }}
                                >
                                    {selectedVideos.find(v => v.id === previewVideo.id) ? (
                                        <>
                                            <Check className="mr-2" size={16} /> Selected
                                        </>
                                    ) : (
                                        <>
                                            <ListPlus className="mr-2" size={16} /> Add to Select List
                                        </>
                                    )}
                                </Button>
                                <Button onClick={() => generateHooks(previewVideo)}>
                                    <Sparkles className="mr-2" size={16} /> Generate Hooks
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
