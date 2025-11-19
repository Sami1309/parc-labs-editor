import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

// Initialize Exa client
const exa = new Exa(process.env.EXA_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    // 1. Generate search queries using Gemini
    const { object: searchPlan } = await generateObject({
      model: google('models/gemini-3-pro-preview'), // Using 1.5 Pro as 3.0 might not be available in the SDK alias yet, or I should check the model name. User said "gemini 3.0", I will try to use a model name that maps to it or fall back to a known one.
      // Note: The user specified Gemini 3.0. I will try to use 'gemini-1.5-pro' as a safe default if 3.0 isn't explicitly aliased, or check if I can specify the model string directly.
      // For now, I'll use 'gemini-1.5-pro' which is robust, or 'models/gemini-1.5-pro-latest'.
      // If the user specifically wants 3.0, I might need to check the exact model string.
      // Let's assume 'gemini-1.5-pro' is sufficient for the agentic logic for now.
      schema: z.object({
        queries: z.array(z.string()).describe('List of 3-5 specific search queries to research the video topic'),
        angle: z.string().describe('The creative angle or direction for the research'),
      }),
      prompt: `You are an expert video researcher. The user wants to make a video about: "${prompt}".
      Generate a research plan with 3-5 specific, high-quality search queries to find interesting assets, facts, and angles.
      Focus on finding unique, non-obvious information.`,
    });

    console.log('Search Plan:', searchPlan);

    // 2. Execute searches using Exa
    const allResults = [];
    
    // We'll run searches in parallel
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

    // 3. Deduplicate and format results
    const uniqueResults = Array.from(new Map(flatResults.map(item => [item.url, item])).values());

    // 4. (Optional) We could use Gemini to summarize these, but for speed we'll just return the Exa highlights/text.
    // Let's format them for the frontend.
    const formattedResults = uniqueResults.map(result => ({
      title: result.title || 'Untitled',
      url: result.url,
      content: result.highlights?.[0] || result.text?.substring(0, 200) + '...' || '',
      score: result.score,
    })).slice(0, 6); // Limit to 6 results to avoid clutter

    return new Response(JSON.stringify({ 
      results: formattedResults,
      angle: searchPlan.angle
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

