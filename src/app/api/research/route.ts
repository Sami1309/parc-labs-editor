import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';
import * as cheerio from 'cheerio';

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY || '');

// Helper to scrape data (OG Image + other images)
async function getScrapedData(url: string): Promise<{ ogImage: string | null, images: string[] }> {
  try {
    const response = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIResearchBot/1.0)' },
        signal: AbortSignal.timeout(4000) // 4s timeout
    });
    if (!response.ok) return { ogImage: null, images: [] };
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const ogImage = $('meta[property="og:image"]').attr('content') || null;
    
    // Scrape other images for asset nodes
    const images: string[] = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http') && !src.includes('icon') && !src.includes('logo')) {
            // Basic filter for likely content images
            images.push(src);
        }
    });

    return { ogImage, images: images.slice(0, 5) }; // Limit to 5 images
  } catch (e) {
    return { ogImage: null, images: [] };
  }
}

export async function POST(req: Request) {
  try {
    const { prompt, parentNodeId } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    const isDeepDive = !!parentNodeId;

    // 1. Generate search queries using Gemini
    const { object: searchPlan } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        queries: z.array(z.string()).describe('List of 2-3 specific search queries.'),
        angle: z.string().describe('The creative angle or direction for the research'),
      }),
      prompt: `You are an expert video researcher. 
      ${isDeepDive 
        ? `The user wants to deep dive into a specific aspect: "${prompt}". Find detailed info and visual assets.` 
        : `The user wants to make a video about: "${prompt}". Generate a research plan.`}
      
      Generate 2-3 specific, high-quality search queries.`,
    });

    // 2. Execute searches using Exa
    const searchPromises = searchPlan.queries.map(async (query) => {
      try {
        const result = await exa.searchAndContents(query, {
          numResults: 3, // Fetch a few more to filter
          text: true,
          highlights: true,
        });
        return result.results;
      } catch (e) {
        console.error(`Error searching for "${query}":`, e);
        return [];
      }
    });

    const searchResults = await Promise.all(searchPromises);
    const flatResults = searchResults.flat();
    
    // Deduplicate
    const uniqueResults = Array.from(new Map(flatResults.map(item => [item.url, item])).values());

    // 3. Fetch Images (Parallel)
    const resultsWithImages = await Promise.all(uniqueResults.map(async (result) => {
        const scraped = await getScrapedData(result.url);
        return { ...result, ...scraped };
    }));

    // 4. Generate final nodes
    const { object: finalResult } = await generateObject({
        model: google('models/gemini-3-pro-preview'),
        schema: z.object({
            nodes: z.array(z.object({
                title: z.string(),
                url: z.string(),
                content: z.string().describe('A concise, interesting summary.'),
                imageUrl: z.string().optional(),
                type: z.enum(['finding', 'asset']).describe('Use "asset" if the result contains multiple good images/videos, otherwise "finding".'),
                assets: z.array(z.string()).optional().describe('List of image URLs if type is asset'),
                suggestedQuestion: z.string().describe('A thought-provoking question to prompt further research on this specific node.'),
                suggestedPaths: z.array(z.string()).describe('3 distinct, interesting directions to take the research from here.'),
            })),
        }),
        prompt: `
            You are a research assistant. Process these search results into "Research Nodes".
            
            Context: ${isDeepDive ? 'Deep dive research' : 'Initial broad research'}
            Topic: "${prompt}"

            Raw Results:
            ${JSON.stringify(resultsWithImages.map(r => ({
                title: r.title,
                url: r.url,
                text: (r as any).highlights?.[0] || r.text?.substring(0, 500),
                ogImage: r.ogImage,
                images: r.images
            })))}

            Requirements:
            1. Generate exactly ${isDeepDive ? '4-5' : '4-5'} nodes.
            2. ${isDeepDive ? 'At least one node MUST be an "asset" type node containing multiple images from the source.' : 'Focus on interesting facts and angles.'}
            3. For "asset" nodes, populate the 'assets' array with the provided image URLs.
            4. For every node, provide a 'suggestedQuestion' and 3 'suggestedPaths' for the user to click.
        `,
    });

    return new Response(JSON.stringify(finalResult), {
        headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
