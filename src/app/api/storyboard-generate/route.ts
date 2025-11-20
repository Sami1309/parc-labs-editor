import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

export const maxDuration = 60;

const exa = new Exa(process.env.EXA_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { messages, selectedNode, additionalContext = [], mode = 'standard' } = await req.json();

    // 1. STRICT LIMITS CONSTANTS
    const MAX_CONTEXT_NODES = 5;
    const MAX_NODE_CONTENT_LENGTH = 1500; // chars
    const MAX_HISTORY_MESSAGES = 5;
    const MAX_MESSAGE_LENGTH = 500; // chars
    const MAX_IMAGES = 10;

    // 2. Prepare Context
    // Combine primary node and additional context, strictly limited
    const allContext = [selectedNode, ...additionalContext]
        .filter(Boolean)
        .slice(0, MAX_CONTEXT_NODES); // Limit number of nodes

    const contextString = allContext.map((c, i) => {
        const content = typeof c.content === 'string' ? c.content : JSON.stringify(c.content || '');
        const truncatedContent = content.length > MAX_NODE_CONTENT_LENGTH 
            ? content.substring(0, MAX_NODE_CONTENT_LENGTH) + '...[truncated]' 
            : content;
        return `Finding ${i + 1}: ${c.title || c.label}\nContent: ${truncatedContent}\n`;
    }).join('\n');

    // 3. Sanitize History
    const sanitizedHistory = Array.isArray(messages) ? messages
        .filter((m: any) => m.id !== 'initial-context') 
        .slice(-MAX_HISTORY_MESSAGES) 
        .map((m: any) => {
            const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
            const truncated = content.length > MAX_MESSAGE_LENGTH 
                ? content.substring(0, MAX_MESSAGE_LENGTH) + '...' 
                : content;
            return `${m.role}: ${truncated}`;
        })
        .join('\n') : '';

    // 4. Generate Visual Keywords (Text-only prompt, low token usage)
    let searchQueries: { keywords: string[] } = { keywords: [] };
    try {
        const result = await generateObject({
          model: google('models/gemini-3-pro-preview'),
          schema: z.object({
            keywords: z.array(z.string()).describe('3-5 visual keywords or phrases to search for images'),
          }),
          prompt: `
            Context: 
            ${contextString.substring(0, 2000)} 
            
            Chat: 
            ${sanitizedHistory.substring(0, 1000)}
            
            Generate 3 visual search keywords for a storyboard.
          `,
        });
        searchQueries = result.object;
    } catch (e) {
        console.warn("Keyword generation failed, skipping exa search", e);
        searchQueries = { keywords: [] };
    }

    // 5. Search for assets (Exa)
    let exaImages: string[] = [];
    if (searchQueries.keywords && searchQueries.keywords.length > 0) {
        try {
            const searchResults = await Promise.all(
                searchQueries.keywords.slice(0, 2).map(query => 
                    exa.searchAndContents(query, {
                        numResults: 1, // Minimal results
                        type: 'neural',
                        useAutoprompt: true,
                    })
                )
            );
            
            // Placeholder for extraction - assuming we might get images in future
            // For now, just ensuring this block doesn't crash or leak tokens
            exaImages = []; 

        } catch (e) {
            console.warn("Exa search failed", e);
        }
    }

    // 6. Collect & Filter Images
    const availableImages = new Set<string>();
    
    const addImageSafe = (img: string) => {
        if (typeof img === 'string' && !img.startsWith('data:') && img.length < 2000) {
            availableImages.add(img);
        }
    };

    allContext.forEach(node => {
        if (node.imageUrl) addImageSafe(node.imageUrl);
        if (node.assets && Array.isArray(node.assets)) {
            node.assets.forEach((img: string) => addImageSafe(img));
        }
    });
    
    exaImages.forEach(img => addImageSafe(img));

    const imageList = Array.from(availableImages).slice(0, MAX_IMAGES);

    // 7. Generate Scenes
    const isExpand = mode === 'expand';
    const sceneCountPrompt = isExpand ? 'Generate 8-10 scenes' : 'Generate 4-6 scenes';
    const detailPrompt = isExpand ? 'Provide plot depth.' : '';

    const { object } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        scenes: z.array(z.object({
          id: z.string(),
          text: z.string().describe('Script/Narration'),
          image: z.string().optional().describe('Exact URL from Available Images if matching, else empty.'),
          notes: z.string().optional().describe('Visual notes'),
        })),
      }),
      prompt: `
        Create a storyboard.
        
        Research:
        ${contextString}
        
        Images: ${JSON.stringify(imageList)}
        
        Chat:
        ${sanitizedHistory}
        
        ${sceneCountPrompt}. ${detailPrompt}
        Use provided images if relevant.
      `,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Storyboard generation error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate storyboard' }), { status: 500 });
  }
}
