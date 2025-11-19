import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, data } = await req.json();

  const context = data?.context || '';

  const result = await streamText({
    model: google('models/gemini-3-pro-preview'),
    messages,
    system: `You are an expert video storyteller and storyboard artist. 
    You help users create storyboards from research.
    
    Current Context:
    ${context}
    
    Guidelines:
    - Be concise and helpful.
    - Use Markdown for formatting.
    - When the user selects a research topic, suggest 3 distinct storyboard angles/styles (e.g., Documentary, Fast-paced Social, Deep Dive).
    - Once an angle is chosen, help outline the storyboard.
    `,
  });

  // Return the raw text stream to avoid AI SDK client protocol dependency
  return new Response(result.textStream, {
    headers: {
        'Content-Type': 'text/plain; charset=utf-8',
    }
  });
}
