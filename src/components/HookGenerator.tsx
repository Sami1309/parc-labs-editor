'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Play, Search, ThumbsUp, Loader2, Check, X, Image as ImageIcon, ArrowLeft, Plus, BarChart2, TrendingUp, Activity, Eye, Heart, Users } from 'lucide-react';
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
}

interface HookGeneratorProps {
  onStartResearch?: (data: { title: string, hook: string, image?: string }) => void;
}

export function HookGenerator({ onStartResearch }: HookGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'outliers'>('trends');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const [previewVideo, setPreviewVideo] = useState<TrendingVideo | null>(null); // New state for modal
  const [generatedHooks, setGeneratedHooks] = useState<HookIdea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<string>('');
  
  // For graph scaling
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchTrends = async (token?: string | null, reset = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ 
            action: 'fetch_trends', 
            query: searchQuery, 
            pageToken: token,
            semanticFilter: filter,
            isOutlierMode: activeTab === 'outliers'
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

  const generateHooks = async (video: TrendingVideo, useLiked = false) => {
    setIsLoading(true);
    if (!useLiked) setSelectedVideo(video);
    // Close preview if expanding into full hook generation
    setPreviewVideo(null);
    
    const likedHooks = useLiked ? generatedHooks.filter(h => h.liked) : [];
    
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'generate_hooks', 
          video,
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

  const generateThumbnailImage = async (id: string, concept: string) => {
      setGeneratedHooks(prev => prev.map(h => 
          h.id === id ? { ...h, isGeneratingImage: true } : h
      ));

      try {
          const res = await fetch('/api/hooks', {
            method: 'POST',
            body: JSON.stringify({ action: 'generate_thumbnail_image', concept }),
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (data.images) {
            setGeneratedHooks(prev => prev.map(h => 
                h.id === id ? { ...h, generatedImages: data.images, selectedImageIndex: 0, isGeneratingImage: false } : h
            ));
          }
      } catch (e) {
          console.error(e);
          setGeneratedHooks(prev => prev.map(h => 
            h.id === id ? { ...h, isGeneratingImage: false } : h
        ));
      }
  };

  const selectImage = (hookId: string, index: number) => {
      setGeneratedHooks(prev => prev.map(h => 
        h.id === hookId ? { ...h, selectedImageIndex: index } : h
    ));
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

  const getViralityScore = (video: TrendingVideo) => {
      if (!video.viewCount || !video.subscriberCount) return null;
      const views = parseInt(video.viewCount);
      const subs = parseInt(video.subscriberCount);
      if (subs === 0) return null;
      return (views / subs).toFixed(1) + 'x';
  };

  // --- Outlier Graph Logic ---
  // Calculate exponential/logarithmic scales for visualization
  const maxViews = Math.max(...videos.map(v => parseInt(v.viewCount) || 0), 1);
  const maxOutlier = Math.max(...videos.map(v => v.outlierScore || 0), 1);
  const minViews = Math.min(...videos.map(v => parseInt(v.viewCount) || 0), maxViews);
  const minOutlier = Math.min(...videos.map(v => v.outlierScore || 0), maxOutlier);

  // Helper for log scale positioning (0-100%)
  const getLogPos = (value: number, min: number, max: number) => {
      if (value <= 0) return 0;
      const logVal = Math.log(value);
      const logMin = Math.log(Math.max(min, 1));
      const logMax = Math.log(Math.max(max, 1));
      const range = logMax - logMin;
      if (range === 0) return 50;
      return ((logVal - logMin) / range) * 100;
  };

  return (
    <div className="h-full flex flex-col bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-stone-200 bg-white space-y-4">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold text-stone-900 mb-1">Hook & Trend Generator</h1>
                <p className="text-stone-600">Discover trending formats and generate viral hooks using AI.</p>
            </div>
            {!selectedVideo && (
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
                </div>
            )}
        </div>
        
        {!selectedVideo && (
            <div className="space-y-3">
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
                <div className="flex gap-2">
                     <Button 
                        variant={filter === '' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => { setFilter(''); fetchTrends(null, true); }}
                    >
                        All
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
        {!selectedVideo ? (
          <>
            {activeTab === 'trends' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.map((video) => {
                            const virality = getViralityScore(video);
                            return (
                            <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group flex flex-col" onClick={() => setPreviewVideo(video)}>
                                <div className="relative aspect-video bg-stone-200">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <Button variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="mr-2" size={16} /> Preview
                                    </Button>
                                </div>
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
                <div className="h-full w-full bg-stone-50 rounded-xl border border-stone-200 relative overflow-hidden p-8">
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
                                    POPULARITY (Log Scale)
                                </div>
                                {/* X Label */}
                                <div className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 text-xs font-bold text-stone-500 tracking-wider">
                                    OUTLIER SCORE (Log Scale)
                                </div>

                                {/* Grid Lines */}
                                <div className="absolute left-0 top-1/4 w-full h-px bg-stone-100" />
                                <div className="absolute left-0 top-2/4 w-full h-px bg-stone-100" />
                                <div className="absolute left-0 top-3/4 w-full h-px bg-stone-100" />
                                
                                {/* Bubbles */}
                                <AnimatePresence>
                                    {videos.map((video) => {
                                        // Use Logarithmic scale for better distribution
                                        const xRaw = getLogPos(video.outlierScore || 1, minOutlier, maxOutlier);
                                        const yRaw = getLogPos(parseInt(video.viewCount), minViews, maxViews);
                                        
                                        // Clamp to ensure they stay within the visual box (adding padding)
                                        const x = Math.min(Math.max(xRaw, 2), 98);
                                        const y = Math.min(Math.max(yRaw, 2), 98);
                                        
                                        const size = 40 + Math.min((parseInt(video.viewCount) / maxViews) * 60, 60); // Size between 40px and 100px

                                        return (
                                            <motion.div
                                                key={video.id}
                                                initial={{ opacity: 0, scale: 0 }}
                                                animate={{ opacity: 1, scale: 1, x: `${x}%`, y: `${100 - y}%` }}
                                                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10 hover:z-50"
                                                style={{ 
                                                    left: `${x}%`, 
                                                    top: `${100 - y}%`,
                                                    width: size,
                                                    height: size
                                                }}
                                                onClick={() => setPreviewVideo(video)}
                                                whileHover={{ scale: 1.2, zIndex: 100 }}
                                            >
                                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white shadow-lg relative bg-stone-200">
                                                    <img src={video.thumbnail} className="w-full h-full object-cover" alt={video.title} />
                                                </div>
                                                
                                                {/* Tooltip - Smart Positioning */}
                                                <div className={cn(
                                                    "absolute left-1/2 -translate-x-1/2 w-56 bg-stone-900 text-white text-xs p-3 rounded-lg shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 flex flex-col gap-1",
                                                    y > 50 ? "bottom-full mb-2" : "top-full mt-2" // Flip based on vertical position
                                                )}>
                                                    <p className="font-bold line-clamp-2 text-sm">{video.title}</p>
                                                    <div className="flex justify-between text-stone-400 mt-1">
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
          </>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Selected Video Info */}
            <div className="flex flex-col md:flex-row gap-6 items-start p-6 bg-white rounded-xl border border-stone-200 shadow-sm">
              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-full md:w-64 rounded-lg shadow-md" />
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2 text-stone-900">{selectedVideo.title}</h2>
                <p className="text-stone-600 mb-4 flex items-center gap-2 text-sm font-medium">
                    {selectedVideo.channelTitle} 
                    <span className="text-stone-300">•</span> 
                    {parseInt(selectedVideo.viewCount).toLocaleString()} views
                    {selectedVideo.likeCount && (
                        <>
                            <span className="text-stone-300">•</span>
                            {parseInt(selectedVideo.likeCount).toLocaleString()} likes
                        </>
                    )}
                    {selectedVideo.outlierScore && (
                        <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm font-bold">
                            {selectedVideo.outlierScore}x Outlier
                        </span>
                    )}
                </p>
                <p className="text-sm text-stone-700 mb-6 line-clamp-3 max-w-2xl leading-relaxed">{selectedVideo.description}</p>
                
                <Button onClick={() => generateHooks(selectedVideo, true)} disabled={isLoading} className="font-medium">
                  <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                  Regenerate from Checked
                </Button>
              </div>
            </div>

            {/* Hooks Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-stone-900">Generated Concepts</h3>
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
                            onClick={() => handleLike(hook.id)}
                            className={cn(
                                "p-1.5 rounded-full transition-colors border", 
                                hook.liked ? "bg-green-100 text-green-600 border-green-200" : "bg-white text-stone-400 border-stone-200 hover:border-stone-300"
                            )}
                            title="Like this idea"
                        >
                            <Check size={16} />
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
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
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
                                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <h2 className="text-2xl font-bold text-stone-900 mb-2">{previewVideo.title}</h2>
                            <div className="flex flex-wrap gap-4 text-sm text-stone-600 mb-4">
                                <span className="flex items-center gap-1 font-medium text-stone-900">
                                    <Users size={16} /> {previewVideo.channelTitle}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Eye size={16} /> {parseInt(previewVideo.viewCount).toLocaleString()} views
                                </span>
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
                            </div>
                            
                            <div className="bg-stone-50 p-4 rounded-lg mb-6 border border-stone-100">
                                <h3 className="text-xs font-bold uppercase text-stone-500 mb-2">Description</h3>
                                <p className="text-sm text-stone-700 whitespace-pre-wrap font-medium leading-relaxed">{previewVideo.description?.slice(0, 500)}...</p>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setPreviewVideo(null)}>
                                    Close
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
