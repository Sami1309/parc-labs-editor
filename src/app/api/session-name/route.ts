import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    const { object } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        name: z.string().describe('A short, catchy name for the research session (max 4-5 words).'),
      }),
      prompt: `Generate a short, catchy name for a research session based on this initial prompt: "${prompt}".`,
    });

    return new Response(JSON.stringify({ name: object.name }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating session name:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}

