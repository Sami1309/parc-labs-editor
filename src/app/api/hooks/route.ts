import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

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
  };
  statistics?: {
    viewCount: string;
  };
}

async function fetchYouTubeTrends(query?: string) {
  if (!YOUTUBE_API_KEY) {
    console.warn('YOUTUBE_API_KEY is missing. Returning mock data.');
    return getMockVideos();
  }

  try {
    let items: any[] = [];

    if (query) {
      // Search for videos
      const searchUrl = `${YOUTUBE_BASE_URL}/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=9&key=${YOUTUBE_API_KEY}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (!searchData.items) {
        throw new Error('No items found in search');
      }

      // Get details (statistics) for these videos
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const videosUrl = `${YOUTUBE_BASE_URL}/videos?part=snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
      const videosRes = await fetch(videosUrl);
      const videosData = await videosRes.json();
      items = videosData.items;

    } else {
      // Get most popular
      const popularUrl = `${YOUTUBE_BASE_URL}/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=9&key=${YOUTUBE_API_KEY}`;
      const popularRes = await fetch(popularUrl);
      const popularData = await popularRes.json();
      items = popularData.items;
    }

    return items.map((item: YouTubeVideo) => ({
      id: typeof item.id === 'string' ? item.id : item.id.videoId!,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      viewCount: item.statistics?.viewCount || '0',
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    }));

  } catch (error) {
    console.error('YouTube API Error:', error);
    return getMockVideos();
  }
}

function getMockVideos() {
  return [
    {
      id: 'mock1',
      title: 'Why 99% of People Fail at Research (Mock)',
      thumbnail: 'https://images.unsplash.com/photo-1598128558393-70ff21433be0?w=800&q=80',
      viewCount: '150000',
      channelTitle: 'Research Master',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'mock2',
      title: 'The Future of AI Agents in 2025',
      thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80',
      viewCount: '320000',
      channelTitle: 'Tech Futures',
      publishedAt: new Date().toISOString(),
    },
    {
      id: 'mock3',
      title: 'Minimalist Desk Setup Tour',
      thumbnail: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80',
      viewCount: '89000',
      channelTitle: 'Setup Wars',
      publishedAt: new Date().toISOString(),
    },
  ];
}

export async function POST(req: Request) {
  try {
    const { action, query, video, likedHooks } = await req.json();

    if (action === 'fetch_trends') {
      const videos = await fetchYouTubeTrends(query);
      return new Response(JSON.stringify({ videos }), { headers: { 'Content-Type': 'application/json' } });
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
      const hooksWithIds = results.map((h, i) => ({ ...h, id: `gen-${Date.now()}-${i}` }));

      return new Response(JSON.stringify({ hooks: hooksWithIds }), { headers: { 'Content-Type': 'application/json' } });
    }
    
    if (action === 'generate_thumbnail_image') {
        const { concept } = await req.json();
        // Placeholder for actual image generation logic with Gemini Flash or similar
        // In a real app, this would call an image generation API
        
        // For now, returning a mock or indicating success for the UI to handle
        // Since we don't have a direct image gen tool configured here yet, we'll return a dummy URL or instructions
        return new Response(JSON.stringify({ 
            imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop' // Placeholder
        }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
