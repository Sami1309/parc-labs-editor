import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Helper to fetch from YouTube API
async function fetchYouTube(endpoint: string, params: Record<string, string>) {
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY is missing');
  
  const url = new URL(`${YOUTUBE_BASE_URL}/${endpoint}`);
  url.searchParams.append('key', YOUTUBE_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || 'YouTube API Error');
  }
  return res.json();
}

async function getChannelDetails(query: string) {
  // If query starts with @, search as handle, else search as keyword
  let channelId = query;
  
  // 1. Try to resolve handle/username to Channel ID via Search if not a direct ID
  if (!query.startsWith('UC')) {
    const searchRes = await fetchYouTube('search', {
      part: 'snippet',
      type: 'channel',
      q: query,
      maxResults: '1'
    });
    
    if (!searchRes.items?.length) throw new Error('Channel not found');
    channelId = searchRes.items[0].id.channelId;
  }

  // 2. Get Channel Stats & Uploads Playlist
  const channelRes = await fetchYouTube('channels', {
    part: 'snippet,contentDetails,statistics',
    id: channelId
  });

  if (!channelRes.items?.length) throw new Error('Channel details not found');
  const channel = channelRes.items[0];

  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnail: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.medium?.url,
    stats: channel.statistics,
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
  };
}

async function getChannelVideos(playlistId: string) {
  // 1. Get recent uploads (up to 50)
  const playlistRes = await fetchYouTube('playlistItems', {
    part: 'snippet',
    playlistId: playlistId,
    maxResults: '50'
  });

  if (!playlistRes.items?.length) return [];

  const videoIds = playlistRes.items.map((item: any) => item.snippet.resourceId.videoId).join(',');

  // 2. Get Video Stats (views, duration, etc)
  const videosRes = await fetchYouTube('videos', {
    part: 'snippet,statistics,contentDetails',
    id: videoIds
  });

  return videosRes.items.map((item: any) => {
    // Parse duration (PT1H2M10S) to seconds
    const duration = parseDuration(item.contentDetails.duration);
    const viewCount = parseInt(item.statistics?.viewCount || '0');
    const publishedAt = new Date(item.snippet.publishedAt);
    const daysSincePublished = Math.max(1, Math.floor((Date.now() - publishedAt.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      id: item.id,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      views: viewCount,
      likes: parseInt(item.statistics?.likeCount || '0'),
      comments: parseInt(item.statistics?.commentCount || '0'),
      publishedAt: item.snippet.publishedAt,
      daysSincePublished,
      viewVelocity: Math.round(viewCount / daysSincePublished),
      duration,
      description: item.snippet.description
    };
  });
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = (parseInt(match[1] || '0'));
  const minutes = (parseInt(match[2] || '0'));
  const seconds = (parseInt(match[3] || '0'));
  return (hours * 3600) + (minutes * 60) + seconds;
}

export async function POST(req: Request) {
  try {
    const { action, query, channelData } = await req.json();

    if (action === 'analyze_channel') {
      const channel = await getChannelDetails(query);
      const videos = await getChannelVideos(channel.uploadsPlaylistId);

      // Calculate Outlier Scores
      // Median View Velocity
      const velocities = videos.map((v: any) => v.viewVelocity).sort((a: number, b: number) => a - b);
      const medianVelocity = velocities[Math.floor(velocities.length / 2)] || 1;
      
      const enrichedVideos = videos.map((v: any) => ({
        ...v,
        outlierScore: parseFloat((v.viewVelocity / medianVelocity).toFixed(2))
      }));

      return new Response(JSON.stringify({
        channel,
        videos: enrichedVideos,
        medianVelocity
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'find_similar_channels') {
      if (!channelData) return new Response(JSON.stringify({ error: 'Channel data required' }), { status: 400 });

      // 1. Generate Search Queries using Gemini
      const { object: searchStrategy } = await generateObject({
        model: google('models/gemini-3-pro-preview'),
        schema: z.object({
          queries: z.array(z.string()).describe('List of 5 specific YouTube search queries to find similar channels')
        }),
        prompt: `
          Analyze this YouTube channel and generate 5 highly specific search queries to find OTHER channels in the exact same niche.
          
          Target Channel: ${channelData.title}
          Description: ${channelData.description?.slice(0, 200)}...
          Recent Video Titles: ${channelData.recentTitles?.slice(0, 5).join(', ')}
          
          Focus on the specific sub-niche, format, and topic. 
          Avoid generic terms.
          Example: If channel is "Coding Tutorials for React", queries shouldn't just be "coding", but "React.js advanced patterns", "Next.js 14 tutorial", "frontend engineering vlog".
        `
      });

      // 2. Parallel Search on YouTube
      // We'll run searches and aggregate channel IDs
      const searchPromises = searchStrategy.queries.map(q => 
        fetchYouTube('search', {
          part: 'snippet',
          type: 'channel',
          q: q,
          maxResults: '3'
        }).catch(() => ({ items: [] }))
      );

      const searchResults = await Promise.all(searchPromises);
      
      const potentialChannelIds = new Set<string>();
      searchResults.forEach((res: any) => {
        res.items?.forEach((item: any) => {
            if (item.id.channelId !== channelData.id) { // Exclude original
                potentialChannelIds.add(item.id.channelId);
            }
        });
      });

      if (potentialChannelIds.size === 0) {
          return new Response(JSON.stringify({ channels: [] }), { headers: { 'Content-Type': 'application/json' } });
      }

      // 3. Get Details for Found Channels
      const channelIdsArr = Array.from(potentialChannelIds).slice(0, 15); // Limit to 15
      const channelsRes = await fetchYouTube('channels', {
          part: 'snippet,statistics',
          id: channelIdsArr.join(',')
      });

      const similarChannels = channelsRes.items.map((c: any) => {
          const subs = parseInt(c.statistics.subscriberCount || '0');
          const views = parseInt(c.statistics.viewCount || '0');
          const videos = parseInt(c.statistics.videoCount || '0');
          
          // Simple ROI / Performance Metric
          // Views per Video
          const avgViews = videos > 0 ? views / videos : 0;
          
          return {
              id: c.id,
              title: c.snippet.title,
              thumbnail: c.snippet.thumbnails.medium?.url,
              subscriberCount: c.statistics.subscriberCount,
              videoCount: c.statistics.videoCount,
              viewCount: c.statistics.viewCount,
              avgViews: Math.round(avgViews),
              description: c.snippet.description
          };
      });

      // Sort by Avg Views (Proxy for "High ROI" / Success)
      similarChannels.sort((a: any, b: any) => b.avgViews - a.avgViews);

      return new Response(JSON.stringify({ 
          channels: similarChannels, 
          queriesUsed: searchStrategy.queries 
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });

  } catch (error: any) {
    console.error('Channel Analysis Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Error' }), { status: 500 });
  }
}

