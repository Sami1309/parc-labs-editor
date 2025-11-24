import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { timeline } = await req.json();

    if (!timeline || !Array.isArray(timeline)) {
      return NextResponse.json({ error: 'Invalid timeline data' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: google('models/gemini-3-pro-preview'),
      schema: z.object({
        expandedTimeline: z.array(z.object({
          id: z.string(),
          text: z.string().describe('Script/Narration'),
          notes: z.string().optional().describe('Visual description'),
          transition: z.enum(['cut', 'fade', 'dissolve', 'wipe']).optional(),
          isNew: z.boolean().describe('True if this is a newly added scene'),
        })),
      }),
      prompt: `
        You are an expert film editor. 
        Review the following storyboard timeline and "expand" it to make the narrative flow smoother, add depth, and improve pacing.
        
        Current Timeline:
        ${JSON.stringify(timeline.map(t => ({ id: t.id, text: t.text, notes: t.notes })))}

        Instructions:
        1. Keep the essence of the original scenes but feel free to split them if they are too long.
        2. Insert "in-between" scenes (connective tissue) to improve flow.
        3. Assign appropriate transitions (cut, fade, dissolve, wipe). Use 'cut' for standard changes, 'dissolve' for time passing, etc.
        4. Mark new scenes with isNew: true.
        5. Return a cohesive list of scenes (original + new/modified) in order.
      `,
    });

    // Merge back with original data (images/audio) where possible
    // If an ID matches, preserve the image/audio if the text hasn't changed drastically, 
    // OR just return the new structure and let the user re-generate assets for new parts.
    // For simplicity, we will try to map back by ID if provided, but new items will need generation.
    
    const newTimeline = object.expandedTimeline.map(item => {
        const original = timeline.find((t: any) => t.id === item.id);
        return {
            ...item,
            image: original ? original.image : undefined,
            audioUrl: original ? original.audioUrl : undefined,
            duration: original ? original.duration : 5, // Default duration
            id: item.id || Math.random().toString(36).substring(7),
        };
    });

    return NextResponse.json({ timeline: newTimeline });

  } catch (error) {
    console.error('Expand API error:', error);
    return NextResponse.json({ error: 'Failed to expand timeline' }, { status: 500 });
  }
}



