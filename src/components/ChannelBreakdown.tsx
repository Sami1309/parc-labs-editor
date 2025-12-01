import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BarChart2, 
  PieChart, 
  Clock, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Video, 
  Mic, 
  Film, 
  Type,
  ArrowRight,
  Filter,
  Download,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type Tab = 'performance' | 'composition' | 'cost' | 'similar';

interface ChannelData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  stats: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
  };
}

interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  daysSincePublished: number;
  viewVelocity: number;
  outlierScore: number;
  duration: number;
  description: string;
}

interface SimilarChannel {
    id: string;
    title: string;
    thumbnail: string;
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
    avgViews: number;
    description: string;
}

export function ChannelBreakdown() {
  const [activeTab, setActiveTab] = useState<Tab>('performance');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data State
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [medianVelocity, setMedianVelocity] = useState<number>(0);
  const [similarChannels, setSimilarChannels] = useState<SimilarChannel[]>([]);
  const [searchQueriesUsed, setSearchQueriesUsed] = useState<string[]>([]);
  
  // UI State
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSimilarLoading, setIsSimilarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setChannelData(null);
    setVideos([]);
    setSelectedVideo(null);
    setSimilarChannels([]);

    try {
      const res = await fetch('/api/channel-analysis', {
        method: 'POST',
        body: JSON.stringify({ action: 'analyze_channel', query: searchQuery }),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      
      setChannelData(data.channel);
      setVideos(data.videos);
      setMedianVelocity(data.medianVelocity);
      
      if (data.videos.length > 0) {
        setSelectedVideo(data.videos[0]);
      }

    } catch (e: any) {
      setError(e.message || 'Failed to analyze channel');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSimilarChannels = async () => {
      if (!channelData || similarChannels.length > 0) return;
      
      setIsSimilarLoading(true);
      try {
          const res = await fetch('/api/channel-analysis', {
              method: 'POST',
              body: JSON.stringify({ 
                  action: 'find_similar_channels', 
                  channelData: {
                      id: channelData.id,
                      title: channelData.title,
                      description: channelData.description,
                      recentTitles: videos.slice(0, 5).map(v => v.title)
                  }
              }),
              headers: { 'Content-Type': 'application/json' }
          });
          
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          
          setSimilarChannels(data.channels);
          setSearchQueriesUsed(data.queriesUsed || []);

      } catch (e: any) {
          console.error(e);
          // Show toast error if possible, or just log
      } finally {
          setIsSimilarLoading(false);
      }
  };

  // Auto-fetch similar channels when tab is clicked
  useEffect(() => {
      if (activeTab === 'similar' && channelData && similarChannels.length === 0) {
          fetchSimilarChannels();
      }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full bg-stone-50 overflow-hidden">
      {/* Search Header */}
      <div className="p-6 border-b border-stone-200 bg-white">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
            <div className="flex gap-4">
            <Input 
                placeholder="Paste channel URL or handle (e.g. @AlexHormozi)" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} className="bg-stone-900 text-white hover:bg-stone-800" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" size={16}/> : <Search className="mr-2" size={16} />}
                Analyze
            </Button>
            </div>
            {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14}/> {error}</p>}
        </div>
      </div>

      {isLoading ? (
           <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
               <Loader2 size={48} className="animate-spin mb-4 text-stone-300" />
               <p className="text-stone-500 font-medium">Analyzing Channel Performance...</p>
               <p className="text-stone-400 text-sm mt-1">This may take a moment</p>
           </div>
      ) : channelData ? (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Channel Header & Tabs */}
          <div className="bg-white border-b border-stone-200 px-6 pt-6 pb-0">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <img src={channelData.thumbnail} className="w-16 h-16 rounded-full border border-stone-200" />
                <div>
                    <h2 className="text-2xl font-bold text-stone-900">{channelData.title}</h2>
                    <p className="text-stone-500">
                        {parseInt(channelData.stats.subscriberCount).toLocaleString()} Subscribers • {parseInt(channelData.stats.videoCount).toLocaleString()} Videos
                    </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <div className="text-xs text-stone-500 uppercase font-bold">Median View Velocity</div>
                  <div className="font-mono text-lg font-bold text-stone-900">{medianVelocity.toLocaleString()} / day</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-stone-500 uppercase font-bold">Outlier Rate</div>
                  <div className="font-mono text-lg font-bold text-green-600">
                      {videos.length > 0 ? Math.round((videos.filter(v => v.outlierScore > 2).length / videos.length) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-6 border-b border-transparent">
              <button 
                onClick={() => setActiveTab('performance')}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", 
                  activeTab === 'performance' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                )}
              >
                <TrendingUp size={16} />
                Performance & Outliers
              </button>
              <button 
                onClick={() => setActiveTab('composition')}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", 
                  activeTab === 'composition' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                )}
              >
                <PieChart size={16} />
                Composition Breakdown
              </button>
              <button 
                onClick={() => setActiveTab('cost')}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", 
                  activeTab === 'cost' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                )}
              >
                <DollarSign size={16} />
                Cost & ROI
              </button>
              <button 
                onClick={() => setActiveTab('similar')}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", 
                  activeTab === 'similar' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-700"
                )}
              >
                <Users size={16} />
                Similar High-ROI
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-stone-50 p-6">
            <div className="max-w-6xl mx-auto">
              
              {/* TAB 1: PERFORMANCE */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-stone-800">Video Performance Distribution</h3>
                    <div className="flex gap-2 text-sm">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Outliers (&gt;2x median)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-stone-300"></span> Normal</span>
                    </div>
                  </div>

                  {/* Outlier Table */}
                  <Card className="overflow-hidden border border-stone-200 shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="p-4 font-semibold text-stone-700">Video</th>
                          <th className="p-4 font-semibold text-stone-700">Views</th>
                          <th className="p-4 font-semibold text-stone-700">Velocity (views/day)</th>
                          <th className="p-4 font-semibold text-stone-700">Outlier Score</th>
                          <th className="p-4 font-semibold text-stone-700">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {videos.map((video) => (
                          <tr 
                            key={video.id} 
                            className={cn(
                              "border-b border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer",
                              selectedVideo?.id === video.id && "bg-stone-50 ring-1 ring-inset ring-stone-200"
                            )}
                            onClick={() => setSelectedVideo(video)}
                          >
                            <td className="p-4 flex gap-3 items-center">
                              <img src={video.thumbnail} className="w-24 h-14 object-cover rounded bg-stone-200" />
                              <div className="font-medium text-stone-900 line-clamp-2 max-w-xs">{video.title}</div>
                            </td>
                            <td className="p-4 text-stone-600">{video.views.toLocaleString()}</td>
                            <td className="p-4 text-stone-600">{Math.round(video.viewVelocity).toLocaleString()}</td>
                            <td className="p-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-xs font-bold",
                                video.outlierScore >= 2 ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"
                              )}>
                                {video.outlierScore}x
                              </span>
                            </td>
                            <td className="p-4">
                              <Button size="sm" variant="ghost" className="text-stone-500 hover:text-stone-900">Analyze</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}

              {/* TAB 2: COMPOSITION */}
              {activeTab === 'composition' && selectedVideo && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Composition Chart */}
                  <Card className="lg:col-span-1 p-6 border-stone-200">
                    <h3 className="font-bold text-stone-800 mb-6">Visual Composition</h3>
                    <div className="relative aspect-square max-w-[250px] mx-auto mb-6">
                      {/* CSS Donut Chart Mock */}
                      <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="40" stroke="#e7e5e4" strokeWidth="20" fill="none" />
                        <circle cx="50" cy="50" r="40" stroke="#a855f7" strokeWidth="20" fill="none" strokeDasharray="100 251" /> 
                        <circle cx="50" cy="50" r="40" stroke="#f59e0b" strokeWidth="20" fill="none" strokeDasharray="60 251" strokeDashoffset="-100" />
                        <circle cx="50" cy="50" r="40" stroke="#3b82f6" strokeWidth="20" fill="none" strokeDasharray="40 251" strokeDashoffset="-160" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center flex-col">
                         <span className="text-3xl font-bold text-stone-900">8.5</span>
                         <span className="text-xs text-stone-500 uppercase font-bold">Pace Score</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> Talking Head</div>
                        <span className="font-bold">40%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div> Screen Recording</div>
                        <span className="font-bold">35%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Stock / B-Roll</div>
                        <span className="font-bold">25%</span>
                      </div>
                    </div>
                  </Card>

                  {/* Right: Timeline & Segments */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 border-stone-200">
                       <h3 className="font-bold text-stone-800 mb-4">Segment Breakdown</h3>
                       <div className="h-8 w-full bg-stone-100 rounded-md overflow-hidden flex mb-2">
                         <div className="h-full bg-purple-500 w-[40%]"></div>
                         <div className="h-full bg-amber-500 w-[35%]"></div>
                         <div className="h-full bg-blue-500 w-[25%]"></div>
                       </div>
                       <div className="flex justify-between text-xs text-stone-400 font-mono mb-6">
                         <span>0:00</span>
                         <span>{Math.floor(selectedVideo.duration / 60)}:{(selectedVideo.duration % 60).toString().padStart(2, '0')}</span>
                       </div>

                       <div className="space-y-4">
                         {/* Mocked Segments for now, but using real duration context */}
                         {[
                           { type: 'Talking Head', duration: '0:00 - ' + Math.floor(selectedVideo.duration * 0.2 / 60) + ':00', desc: 'Intro + Hook', icon: Users, color: 'text-purple-600 bg-purple-50' },
                           { type: 'Screen Recording', duration: Math.floor(selectedVideo.duration * 0.2 / 60) + ':00 - ' + Math.floor(selectedVideo.duration * 0.8 / 60) + ':00', desc: 'Main Value Delivery', icon: Video, color: 'text-amber-600 bg-amber-50' },
                           { type: 'Stock/B-Roll', duration: Math.floor(selectedVideo.duration * 0.8 / 60) + ':00 - End', desc: 'Outro + CTA', icon: Film, color: 'text-blue-600 bg-blue-50' },
                         ].map((segment, i) => (
                           <div key={i} className="flex items-start gap-4 p-3 rounded-lg border border-stone-100 hover:border-stone-300 transition-colors">
                             <div className={cn("p-2 rounded-md", segment.color)}>
                               <segment.icon size={18} />
                             </div>
                             <div>
                               <div className="flex items-center gap-2 mb-1">
                                 <span className="font-bold text-sm text-stone-900">{segment.type}</span>
                                 <span className="text-xs text-stone-400 font-mono">{segment.duration}</span>
                               </div>
                               <p className="text-sm text-stone-600">{segment.desc}</p>
                             </div>
                           </div>
                         ))}
                       </div>
                       <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-xs italic">
                           Note: Visual segmentation is estimated. Connect video indexing service for frame-accurate analysis.
                       </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB 3: COST & ROI */}
              {activeTab === 'cost' && selectedVideo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Card className="p-6 border-stone-200">
                      <h3 className="font-bold text-lg text-stone-900 mb-4">Estimated Production Cost</h3>
                      
                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center py-2 border-b border-stone-100">
                          <span className="text-stone-600">Filming (Talking Head)</span>
                          <span className="font-mono font-bold">{(selectedVideo.duration / 3600 * 1.5).toFixed(1)} hrs</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-stone-100">
                          <span className="text-stone-600">Screen Recording</span>
                          <span className="font-mono font-bold">{(selectedVideo.duration / 3600 * 1.0).toFixed(1)} hrs</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-stone-100">
                          <span className="text-stone-600">Editing (Paced)</span>
                          <span className="font-mono font-bold">{(selectedVideo.duration / 3600 * 4).toFixed(1)} hrs</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-stone-100">
                          <span className="text-stone-600">Stock Assets</span>
                          <span className="font-mono font-bold">$45.00</span>
                        </div>
                      </div>

                      <div className="bg-stone-50 p-4 rounded-lg flex justify-between items-center">
                        <span className="font-bold text-stone-700">Total Est. Cost</span>
                        <div className="text-right">
                            {/* Simple cost model: $50/hr * estimated hours + stock */}
                          <div className="text-2xl font-bold text-stone-900">
                              ${Math.round(((selectedVideo.duration / 3600 * 6.5) * 50) + 45)}
                          </div>
                          <div className="text-xs text-stone-500">@ $50/hr rate</div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card className="p-6 border-stone-200 bg-gradient-to-br from-white to-green-50/50">
                      <h3 className="font-bold text-lg text-stone-900 mb-4">ROI Analysis</h3>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-white rounded-lg border border-stone-100 shadow-sm">
                          <div className="text-xs text-stone-500 uppercase font-bold mb-1">Views / $ Spent</div>
                          <div className="text-2xl font-bold text-green-600">
                              {Math.round(selectedVideo.views / (((selectedVideo.duration / 3600 * 6.5) * 50) + 45))}
                          </div>
                        </div>
                        <div className="p-4 bg-white rounded-lg border border-stone-100 shadow-sm">
                          <div className="text-xs text-stone-500 uppercase font-bold mb-1">Views / Work Hour</div>
                          <div className="text-2xl font-bold text-blue-600">
                              {Math.round(selectedVideo.views / (selectedVideo.duration / 3600 * 6.5)).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg border border-stone-200">
                        <h4 className="font-bold text-sm text-stone-800 mb-2">Verdict</h4>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          This video format has an <span className="font-bold text-green-600">
                              {selectedVideo.outlierScore > 2 ? "Exceptional" : selectedVideo.outlierScore > 1 ? "Good" : "Average"} ROI
                          </span>. 
                          {selectedVideo.outlierScore > 1 
                            ? " The high view-to-effort ratio suggests focusing on this format." 
                            : " Consider optimizing production workflow to improve margins."}
                        </p>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB 4: SIMILAR */}
              {activeTab === 'similar' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-stone-800">High-ROI Channel Opportunities</h3>
                        <Button variant="outline" size="sm" className="text-stone-600">
                        <Filter className="mr-2" size={14} /> Filter
                        </Button>
                     </div>

                     {searchQueriesUsed.length > 0 && (
                         <div className="text-xs text-stone-500 bg-stone-100 p-2 rounded flex flex-wrap gap-2 items-center">
                             <span className="font-bold text-stone-700 flex items-center gap-1"><Sparkles size={10} className="text-purple-500"/> AI Queries Used:</span>
                             {searchQueriesUsed.map((q, i) => (
                                 <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-stone-200 text-[10px]">{q}</span>
                             ))}
                         </div>
                     )}
                  </div>

                  {isSimilarLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-stone-200 rounded-xl">
                          <Loader2 size={32} className="animate-spin text-purple-500 mb-3" />
                          <p className="font-bold text-stone-700">Searching the depths of YouTube...</p>
                          <p className="text-sm text-stone-500">Generating queries & analyzing competitors</p>
                      </div>
                  ) : similarChannels.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {similarChannels.map((channel) => (
                        <Card key={channel.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer border-stone-200 group">
                            <div className="flex items-center gap-3 mb-4">
                                <img src={channel.thumbnail} className="w-12 h-12 rounded-full border border-stone-100" />
                            <div>
                                <h4 className="font-bold text-stone-900 line-clamp-1">{channel.title}</h4>
                                <div className="text-xs text-stone-500">{parseInt(channel.subscriberCount).toLocaleString()} Subs</div>
                            </div>
                            <div className="ml-auto bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
                                {channel.avgViews > 10000 ? 'High' : 'Med'} ROI
                            </div>
                            </div>
                            
                            <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-600">Avg Views/Vid</span>
                                <span className="font-medium">{channel.avgViews.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-stone-600">Total Videos</span>
                                <span className="font-medium">{parseInt(channel.videoCount).toLocaleString()}</span>
                            </div>
                            </div>

                            <div className="pt-4 border-t border-stone-100">
                                <p className="text-xs text-stone-400 line-clamp-2 mb-3 h-8">{channel.description}</p>
                                <Button size="sm" variant="outline" className="w-full text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors" onClick={() => {
                                    setSearchQuery(channel.id); // Or title
                                    handleSearch();
                                }}>
                                    Analyze This Channel
                                </Button>
                            </div>
                        </Card>
                        ))}
                    </div>
                  ) : (
                      <div className="py-12 text-center text-stone-500">
                          No similar channels found yet.
                      </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-8">
          <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mb-6">
            <Search size={48} className="opacity-20" />
          </div>
          <h2 className="text-xl font-bold text-stone-700 mb-2">Channel Deep Dive</h2>
          <p className="text-stone-500 max-w-md text-center">
            Enter a YouTube channel URL to analyze outliers, breakdown content composition, and estimate production ROI.
          </p>
        </div>
      )}
    </div>
  );
}
