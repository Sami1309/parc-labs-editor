import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { timeline, selection, prompt } = await req.json();

    if (!timeline || !selection || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Filter items that overlap with the selection
    const relevantItems = timeline.filter((item: any) => {
        // Calculate item start/end times based on timeline order
        let startTime = 0;
        for (const t of timeline) {
            if (t === item) break;
            startTime += t.duration;
        }
        const endTime = startTime + item.duration;
        
        // Check overlap
        return (startTime < selection.end && endTime > selection.start);
    });

    if (relevantItems.length === 0) {
         return NextResponse.json({ error: 'No scenes in selected range' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        modifiedScenes: z.array(z.object({
          id: z.string(),
          text: z.string().describe('Script/Narration'),
          notes: z.string().optional().describe('Visual description'),
          transition: z.enum(['cut', 'fade', 'dissolve', 'wipe']).optional(),
          effect: z.enum(['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'static']).optional(),
          duration: z.number(),
        })),
      }),
      prompt: `
        You are an expert film editor and director.
        The user wants to modify a specific section of the video timeline based on their prompt: "${prompt}".
        
        Selected Scenes Context:
        ${JSON.stringify(relevantItems.map((t: any) => ({ id: t.id, text: t.text, notes: t.notes, duration: t.duration })))}

        Instructions:
        1. Modify the selected scenes to match the user's request.
        2. You can change the script (text), visual notes, transition, effect, or duration.
        3. You can split scenes or merge them if needed, but try to keep the structure unless the prompt requires drastic changes.
        4. Return the new list of scenes that should REPLACE the selected scenes.
        5. Be creative and ensure high visual quality descriptions.
      `,
    });

    return NextResponse.json({ modifiedScenes: object.modifiedScenes });

  } catch (error) {
    console.error('Interpretive Editor API error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}


