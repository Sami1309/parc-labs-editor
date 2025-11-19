import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';
import * as cheerio from 'cheerio';

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY || '');

// Helper to scrape OG Image
async function getOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIResearchBot/1.0)' },
        signal: AbortSignal.timeout(3000) // 3s timeout
    });
    if (!response.ok) return null;
    const html = await response.text();
    const $ = cheerio.load(html);
    const ogImage = $('meta[property="og:image"]').attr('content');
    return ogImage || null;
  } catch (e) {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    // 1. Generate search queries using Gemini
    const { object: searchPlan } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        queries: z.array(z.string()).describe('List of 3-5 specific search queries to research the video topic'),
        angle: z.string().describe('The creative angle or direction for the research'),
      }),
      prompt: `You are an expert video researcher. The user wants to make a video about: "${prompt}".
      Generate a research plan with 3-5 specific, high-quality search queries to find interesting assets, facts, and angles.
      Focus on finding unique, non-obvious information.`,
    });

    // 2. Execute searches using Exa (Server-side)
    const searchPromises = searchPlan.queries.map(async (query) => {
      try {
        const result = await exa.searchAndContents(query, {
          numResults: 2,
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
        const ogImage = await getOgImage(result.url);
        return { ...result, ogImage };
    }));

    // 4. Generate final nodes using Gemini (Non-streaming for simplicity without ai/react)
    // We will just return the full object at once since we removed the streaming client code.
    const { object: finalResult } = await generateObject({
        model: google('models/gemini-3-pro-preview'),
        schema: z.object({
            nodes: z.array(z.object({
                title: z.string(),
                url: z.string(),
                content: z.string().describe('A concise, interesting summary of the finding that prompts a deep dive.'),
                imageUrl: z.string().optional(),
            })),
        }),
        prompt: `
            You are a research assistant. I have performed a search for "${prompt}" and found the following results.
            
            Raw Results:
            ${JSON.stringify(resultsWithImages.map(r => ({
                title: r.title,
                url: r.url,
                text: (r as any).highlights?.[0] || r.text?.substring(0, 500),
                ogImage: r.ogImage
            })))}

            Please process these results into a list of "Research Nodes".
            For each result:
            1. Create a catchy title.
            2. Write a summary (content) that explains WHY this is interesting for the video. Don't just copy the text. Summarize the key insight.
            3. Include the URL.
            4. Include the 'ogImage' as 'imageUrl' if it exists.
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
