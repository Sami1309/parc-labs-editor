import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages, selectedNode } = await req.json();

    // Collect available images
    const availableImages = [];
    if (selectedNode.imageUrl) availableImages.push(selectedNode.imageUrl);
    if (selectedNode.assets && Array.isArray(selectedNode.assets)) {
        availableImages.push(...selectedNode.assets);
    }

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
        Available Images: ${JSON.stringify(availableImages)}
        
        Conversation History:
        ${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}
        
        Generate 4-6 compelling scenes that tell a story.
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

