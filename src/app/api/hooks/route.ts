import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

interface YouTubeVideo {
  id: { videoId?: string } | string;
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium: { url: string };
      high: { url: string };
    };
    publishedAt: string;
    description: string;
    channelId: string;
  };
  statistics?: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
  channelStatistics?: {
      subscriberCount: string;
      videoCount: string;
      viewCount: string;
  };
  outlierScore?: number; // (Video Views) / (Average Channel Views)
}

async function fetchYouTubeTrends(query?: string, pageToken?: string, semanticFilter?: string, isOutlierMode: boolean = false) {
  if (!YOUTUBE_API_KEY) {
    console.warn('YOUTUBE_API_KEY is missing. Returning mock data.');
    return { videos: getMockVideos(), nextPageToken: null };
  }

  try {
    let items: any[] = [];
    let nextPageToken = null;
    
    // Fetch significantly more videos if filtering to ensure we have enough matches
    const fetchLimit = (semanticFilter || isOutlierMode) ? 50 : 9; 

    if (query) {
      // Search for videos
      let searchUrl = `${YOUTUBE_BASE_URL}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${fetchLimit}&key=${YOUTUBE_API_KEY}`;
      if (pageToken) searchUrl += `&pageToken=${pageToken}`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.items) {
        return { videos: [], nextPageToken: null };
      }
      nextPageToken = searchData.nextPageToken;

      // Get details (statistics) for these videos
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const videosUrl = `${YOUTUBE_BASE_URL}/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
      const videosRes = await fetch(videosUrl);
      const videosData = await videosRes.json();
      items = videosData.items;

    } else {
      // Get most popular
      let popularUrl = `${YOUTUBE_BASE_URL}/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=${fetchLimit}&key=${YOUTUBE_API_KEY}`;
      if (pageToken) popularUrl += `&pageToken=${pageToken}`;

      const popularRes = await fetch(popularUrl);
      const popularData = await popularRes.json();
      items = popularData.items || [];
      nextPageToken = popularData.nextPageToken;
    }

    // Enrich with channel stats for analytics and outlier score
    if (items.length > 0) {
        const channelIds = [...new Set(items.map((item: any) => item.snippet.channelId))].join(',');
        const channelsUrl = `${YOUTUBE_BASE_URL}/channels?part=statistics&id=${channelIds}&key=${YOUTUBE_API_KEY}`;
        const channelsRes = await fetch(channelsUrl);
        const channelsData = await channelsRes.json();
        const channelStatsMap = new Map(channelsData.items?.map((c: any) => [c.id, c.statistics]));
        
        items.forEach((item: any) => {
            item.channelStatistics = channelStatsMap.get(item.snippet.channelId);
        });
    }

    let videos = items.map((item: YouTubeVideo) => {
        const viewCount = parseInt(item.statistics?.viewCount || '0');
        const channelViewCount = parseInt(item.channelStatistics?.viewCount || '0');
        const channelVideoCount = parseInt(item.channelStatistics?.videoCount || '1');
        
        // Calculate average views for the channel (Global Average)
        // Note: This is a rough approximation. A better one would be "recent average", but requires more API calls.
        const averageChannelViews = channelVideoCount > 0 ? channelViewCount / channelVideoCount : 0;
        
        // Outlier Score: How many times better than the average?
        // Avoid division by zero. If average is very low, score might be huge, cap it or handle it.
        const outlierScore = averageChannelViews > 100 ? (viewCount / averageChannelViews) : 1;

        return {
            id: typeof item.id === 'string' ? item.id : item.id.videoId!,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
            viewCount: item.statistics?.viewCount || '0',
            likeCount: item.statistics?.likeCount,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            subscriberCount: item.channelStatistics?.subscriberCount,
            description: item.snippet.description || '',
            outlierScore: parseFloat(outlierScore.toFixed(2))
        };
    });

    // Semantic Filtering
    if (semanticFilter) {
        const lowerFilter = semanticFilter.toLowerCase();
        
        if (lowerFilter.includes('no face') || lowerFilter.includes('faceless')) {
            videos = videos.filter(v => {
                const text = (v.title + ' ' + v.description).toLowerCase();
                const hasPositiveSignal = text.includes('faceless') || text.includes('no face') || text.includes('tutorial') || text.includes('guide') || text.includes('essay') || text.includes('documentary');
                const hasNegativeSignal = text.includes('vlog') || text.includes('reaction') || text.includes('interview');
                return hasPositiveSignal && !hasNegativeSignal;
            });
        } else if (lowerFilter.includes('infographic')) {
            videos = videos.filter(v => {
                const text = (v.title + ' ' + v.description).toLowerCase();
                return text.includes('data') || text.includes('map') || text.includes('chart') || text.includes('visualization') || text.includes('statistics') || text.includes('graph');
            });
        }
    }

    // If Outlier Mode, sort by Outlier Score descending
    if (isOutlierMode) {
        videos.sort((a, b) => (b.outlierScore || 0) - (a.outlierScore || 0));
    }

    // Slice for pagination
    const pageSize = isOutlierMode ? 50 : 9; // Show more for graph
    return { videos: videos.slice(0, pageSize), nextPageToken };

  } catch (error) {
    console.error('YouTube API Error:', error);
    return { videos: getMockVideos(), nextPageToken: null };
  }
}

function getMockVideos() {
  return [
    {
      id: 'mock1',
      title: 'Why 99% of People Fail at Research (Mock)',
      thumbnail: 'https://images.unsplash.com/photo-1598128558393-70ff21433be0?w=800&q=80',
      viewCount: '150000',
      likeCount: '12000',
      subscriberCount: '50000',
      channelTitle: 'Research Master',
      publishedAt: new Date().toISOString(),
      outlierScore: 2.5
    },
    {
      id: 'mock2',
      title: 'The Future of AI Agents in 2025',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80',
      viewCount: '320000',
      likeCount: '25000',
      subscriberCount: '100000',
      channelTitle: 'Tech Futures',
      publishedAt: new Date().toISOString(),
      outlierScore: 1.2
    },
    {
      id: 'mock3',
      title: 'Minimalist Desk Setup Tour',
      thumbnail: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80',
      viewCount: '89000',
      likeCount: '5000',
      subscriberCount: '20000',
      channelTitle: 'Setup Wars',
      publishedAt: new Date().toISOString(),
      outlierScore: 0.8
    },
     {
      id: 'mock4',
      title: 'Viral Outlier Video Example',
      thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
      viewCount: '1500000',
      likeCount: '150000',
      subscriberCount: '10000',
      channelTitle: 'New Creator',
      publishedAt: new Date().toISOString(),
      outlierScore: 15.5
    },
  ];
}

async function generateImage(prompt: string): Promise<string | null> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        // Use the model ID that was working in the other endpoint
        const model = 'gemini-2.0-flash-exp'; 

        const response = await ai.models.generateContent({
            model,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `Generate a thumbnail image for: ${prompt}` }],
                }
            ],
             config: {
                // @ts-ignore
                responseModalities: ['IMAGE'],
            },
        });

        const candidate = response.response?.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        
        if (part?.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
        
        return null;
    } catch (e) {
        console.error("Image Gen Error", e);
        return null;
    }
}


export async function POST(req: Request) {
  try {
    const { action, query, video, likedHooks, pageToken, semanticFilter, concept, isOutlierMode } = await req.json();

    if (action === 'fetch_trends') {
      const result = await fetchYouTubeTrends(query, pageToken, semanticFilter, isOutlierMode);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_hooks') {
      if (!video) {
        return new Response(JSON.stringify({ error: 'Video data required' }), { status: 400 });
      }

      // If likedHooks provided, influence the generation
      const contextPrompt = likedHooks && likedHooks.length > 0 
        ? `The user liked these previously generated hooks: 
           ${JSON.stringify(likedHooks.map((h: any) => h.title))}
           Generate similar but unique variations.`
        : 'Generate 1 unique hook concept.';

      // Generate 3 hooks in parallel
      const promises = Array(3).fill(null).map(async () => {
        const { object: result } = await generateObject({
            model: google('models/gemini-3-pro-preview'),
            schema: z.object({
              title: z.string(),
              hook: z.string().describe('The opening line or visual hook'),
              thumbnailConcept: z.string().describe('A visual description of the thumbnail'),
            }),
            prompt: `
            Analyze this popular video and generate a viral hook/title/thumbnail concept inspired by it, but for a similar niche.
            
            Source Video:
            Title: ${video.title}
            Channel: ${video.channelTitle}
            Views: ${video.viewCount}
            
            ${contextPrompt}

            Make it catchy, click-worthy, but not misleading.
            `,
        });
        return result;
      });

      const results = await Promise.all(promises);
      const hooksWithIds = results.map((h, i) => ({ 
          ...h, 
          id: `gen-${Date.now()}-${i}`,
          generatedImages: [] 
      }));

      return new Response(JSON.stringify({ hooks: hooksWithIds }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (action === 'generate_thumbnail_image') {
        if (!concept) return new Response(JSON.stringify({ error: 'Concept required' }), { status: 400 });
        
        // Generate 4 images in parallel
        const imagePromises = Array(4).fill(null).map(async () => {
            const img = await generateImage(concept);
            // Keep fallback for testing if API fails/is rate limited, but prefer real generation
            // If img is null, return a random placeholder
            return img || `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000)}?w=800&q=80`;
        });

        const images = await Promise.all(imagePromises);
        
        return new Response(JSON.stringify({ 
            images: images.filter(Boolean) // Return valid images
        }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
