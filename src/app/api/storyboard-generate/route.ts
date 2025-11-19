import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

export const maxDuration = 60;

const exa = new Exa(process.env.EXA_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, selectedNode, mode = 'standard' } = await req.json();

    // 1. Extract keywords for asset search from the conversation and context
    const { object: searchQueries } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        keywords: z.array(z.string()).describe('3-5 visual keywords or phrases to search for images'),
      }),
      prompt: `
        Based on this research topic: "${selectedNode.title}" 
        and conversation history: 
        ${messages.slice(-3).map((m: any) => m.content).join('\n')}
        
        Generate 3-5 specific visual keywords to find relevant images/assets for a storyboard.
      `,
    });

    // 2. Search for additional assets using Exa
    let exaImages: string[] = [];
    try {
        const searchResults = await Promise.all(
            searchQueries.keywords.slice(0, 3).map(query => 
                exa.searchAndContents(query, {
                    numResults: 2,
                    type: 'neural',
                    useAutoprompt: true,
                })
            )
        );

        // Naive extraction of potential image URLs from results (if Exa returns any, or we rely on what we have)
        // Since Exa text search doesn't always return images directly in standard search, 
        // we might rely on the previously scraped 'assets' from the research phase if available.
        // However, if we want *new* assets, we'd typically need an image search API. 
        // Exa's 'contents' might have OG images.
        
        exaImages = searchResults.flatMap(r => r.results.map(res => {
            // Mock logic to find an image - in reality Exa might not return direct image URLs in 'text' mode easily 
            // without deeper scraping, but let's assume we check for OG images if available or just skip if none.
            // Exa currently doesn't natively return a list of "images" in standard search response unless we scrape.
            // For now, we will try to use what we have or placeholders.
            return null; 
        })).filter(Boolean) as string[];

    } catch (e) {
        console.error("Exa search failed", e);
    }

    // Collect available images
    const availableImages = new Set<string>();
    if (selectedNode.imageUrl) availableImages.add(selectedNode.imageUrl);
    if (selectedNode.assets && Array.isArray(selectedNode.assets)) {
        selectedNode.assets.forEach((img: string) => availableImages.add(img));
    }
    // Add Exa images if we managed to get any (mocked for now as extraction is complex without scraping)
    exaImages.forEach(img => availableImages.add(img));

    const imageList = Array.from(availableImages);

    const isExpand = mode === 'expand';
    const sceneCountPrompt = isExpand ? 'Generate 8-12 detailed scenes' : 'Generate 4-6 compelling scenes';
    const detailPrompt = isExpand ? 'Provide more plot depth, character development, and descriptive notes.' : '';

    const { object } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        scenes: z.array(z.object({
          id: z.string(),
          text: z.string().describe('The script or narration for this scene'),
          image: z.string().optional().describe('URL of an image from the research to use, if any. MUST be one of the provided available images.'),
          notes: z.string().optional().describe('Director notes or visual description'),
        })),
      }),
      prompt: `
        Create a visual storyboard based on the following research and conversation history.
        
        Research Context:
        Title: ${selectedNode.title}
        Content: ${selectedNode.content}
        Available Images: ${JSON.stringify(imageList)}
        
        Conversation History:
        ${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
        
        ${sceneCountPrompt} that tell a story.
        ${detailPrompt}
        Prioritize using the Available Images where they fit the narrative.
        If no specific image matches a scene, leave the image field empty.
      `,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Storyboard generation error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate storyboard' }), { status: 500 });
  }
}
