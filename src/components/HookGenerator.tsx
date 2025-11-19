'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Play, Search, ThumbsUp, Loader2, Check, X, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TrendingVideo {
  id: string;
  title: string;
  thumbnail: string;
  viewCount: string;
  channelTitle: string;
  publishedAt: string;
}

interface HookIdea {
  id: string;
  title: string;
  thumbnailConcept: string;
  hook: string;
  liked?: boolean;
  generatedImage?: string;
  isGeneratingImage?: boolean;
}

export function HookGenerator() {
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<TrendingVideo | null>(null);
  const [generatedHooks, setGeneratedHooks] = useState<HookIdea[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTrends = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ action: 'fetch_trends', query: searchQuery }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.videos) {
        setVideos(data.videos);
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
            // Keep liked ones, replace unliked ones with new suggestions
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
          h.id === id ? { ...h, liked: true } : h
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
          if (data.imageUrl) {
            setGeneratedHooks(prev => prev.map(h => 
                h.id === id ? { ...h, generatedImage: data.imageUrl, isGeneratingImage: false } : h
            ));
          }
      } catch (e) {
          console.error(e);
          setGeneratedHooks(prev => prev.map(h => 
            h.id === id ? { ...h, isGeneratingImage: false } : h
        ));
      }
  };

  const clearSelection = () => {
      setSelectedVideo(null);
      setGeneratedHooks([]);
  };

  return (
    <div className="h-full flex flex-col bg-stone-50 overflow-hidden">
      <div className="p-6 border-b border-stone-200 bg-white">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Hook & Trend Generator</h1>
        <p className="text-stone-600 mb-4">Discover trending formats and generate viral hooks using AI.</p>
        
        {!selectedVideo ? (
            <div className="flex gap-2 max-w-xl">
            <Input 
                placeholder="Search topic (optional)..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTrends()}
            />
            <Button onClick={fetchTrends} disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" size={18} />}
                Find Trends
            </Button>
            </div>
        ) : (
            <Button variant="outline" onClick={clearSelection}>
                <ArrowLeft className="mr-2" size={16} /> Back to Trends
            </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedVideo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group" onClick={() => generateHooks(video)}>
                <div className="relative aspect-video bg-stone-200">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Button variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Sparkles className="mr-2" size={16} /> Generate Hooks
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-1">{video.title}</h3>
                  <div className="flex items-center justify-between text-sm text-stone-500">
                    <span>{video.channelTitle}</span>
                    <span>{parseInt(video.viewCount).toLocaleString()} views</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex gap-6 items-start p-6 bg-white rounded-xl border border-stone-200">
              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-48 rounded-lg" />
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                <p className="text-stone-600 mb-4">{selectedVideo.channelTitle} • {parseInt(selectedVideo.viewCount).toLocaleString()} views</p>
                <Button onClick={() => generateHooks(selectedVideo, true)} disabled={isLoading}>
                  <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                  Regenerate from Checked
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Concepts</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {generatedHooks.map((hook) => (
                  <Card key={hook.id} className={cn(
                      "p-6 relative transition-all border-2",
                      hook.liked ? "border-green-500 bg-green-50/50" : "border-stone-200"
                  )}>
                    <div className="absolute top-2 right-2 flex gap-1">
                        <button 
                            onClick={() => handleLike(hook.id)}
                            className={cn("p-1.5 rounded-full hover:bg-green-100 transition-colors", hook.liked ? "text-green-600" : "text-stone-400")}
                        >
                            <Check size={18} />
                        </button>
                        <button 
                            onClick={() => handleDiscard(hook.id)}
                            className="p-1.5 rounded-full hover:bg-red-100 text-stone-400 hover:text-red-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-4 mt-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Title</span>
                        <p className="text-lg font-medium leading-tight">{hook.title}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Hook</span>
                        <p className="text-stone-700">{hook.hook}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Thumbnail Concept</span>
                        <p className="text-sm text-stone-600 italic mb-2">{hook.thumbnailConcept}</p>
                        
                        {hook.generatedImage ? (
                             <div className="aspect-video w-full rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                                <img src={hook.generatedImage} alt="Generated thumbnail" className="w-full h-full object-cover" />
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
                                Generate Visual
                            </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {!isLoading && videos.length === 0 && !selectedVideo && (
          <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <Play size={48} className="mb-4 opacity-50" />
            <p>Search or click "Find Trends" to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
