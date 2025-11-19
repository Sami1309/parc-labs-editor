'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, Play, Search, ThumbsUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

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

  const generateHooks = async (video: TrendingVideo) => {
    setIsLoading(true);
    setSelectedVideo(video);
    try {
      const res = await fetch('/api/hooks', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate_hooks', video }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.hooks) {
        setGeneratedHooks(data.hooks);
      }
    } catch (error) {
      console.error('Failed to generate hooks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-stone-50 overflow-hidden">
      <div className="p-6 border-b border-stone-200 bg-white">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Hook & Trend Generator</h1>
        <p className="text-stone-600 mb-4">Discover trending formats and generate viral hooks using AI.</p>
        
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
          <div className="max-w-4xl mx-auto space-y-8">
            <Button variant="ghost" onClick={() => setSelectedVideo(null)} className="mb-4">
              ← Back to Trends
            </Button>

            <div className="flex gap-6 items-start p-6 bg-white rounded-xl border border-stone-200">
              <img src={selectedVideo.thumbnail} alt={selectedVideo.title} className="w-48 rounded-lg" />
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                <p className="text-stone-600 mb-4">{selectedVideo.channelTitle} • {parseInt(selectedVideo.viewCount).toLocaleString()} views</p>
                <Button onClick={() => generateHooks(selectedVideo)} disabled={isLoading}>
                  <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} size={16} />
                  Regenerate Ideas
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Generated Concepts</h3>
              <div className="grid gap-4">
                {generatedHooks.map((hook) => (
                  <Card key={hook.id} className="p-6">
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Title</span>
                          <p className="text-lg font-medium">{hook.title}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Hook</span>
                          <p className="text-stone-700">{hook.hook}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Thumbnail Concept</span>
                          <p className="text-sm text-stone-600 italic">{hook.thumbnailConcept}</p>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <Button variant="ghost" size="icon">
                          <ThumbsUp size={18} />
                        </Button>
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

