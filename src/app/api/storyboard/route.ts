import { google } from '@ai-sdk/google';
import { streamText, tool, convertToCoreMessages } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, researchContext } = body;
    
    if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: 'Invalid messages format' }), { status: 400 });
    }

    const coreMessages = convertToCoreMessages(messages);

    const result = streamText({
      model: google('models/gemini-3-pro-preview'),
      messages: coreMessages,
      system: `You are an expert video production assistant.
      You have access to a research session with the following findings and assets:
      ${JSON.stringify(researchContext || [])}

      Your goal is to help the user find an interesting angle for a video based on this research, and then generate a storyboard.
      
      Guidelines:
      1. Start by analyzing the provided research context (if this is the first message).
      2. Suggest 2-3 distinct, creative angles or narrative structures for a video based ONLY on these findings.
      3. If the user asks questions, answer them using the research context.
      4. Once the user decides on a direction, use the 'generateStoryboard' tool to create a detailed storyboard.
      5. When creating the storyboard, you MUST include visual assets from the research context.
      6. Use Markdown for formatting your responses. Use bolding, lists, and headers to make it readable.
      7. IMPORTANT: When describing visuals in text or in the storyboard tool, if a relevant image URL exists in the research context, embed it using Markdown image syntax: ![description](url).
      `,
      tools: {
        generateStoryboard: tool({
          description: 'Generate a structured storyboard with scenes. Use this when the user has agreed on a direction.',
          inputSchema: z.object({
            title: z.string(),
            scenes: z.array(z.object({
               id: z.string(),
               description: z.string(),
               visual: z.string().describe('Visual description of what is on screen. If a relevant asset exists in context, include its URL here or describe it.'),
               audio: z.string().describe('Audio/Voiceover description'),
               duration: z.string(),
            })),
          }),
        }),
      },
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('Storyboard API Error:', error);
    return new Response(JSON.stringify({ error: `Storyboard generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
