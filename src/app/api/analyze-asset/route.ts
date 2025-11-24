import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = file.type;

    const result = await generateText({
      model: google('models/gemini-3-pro-preview'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this asset for a video editor context. Briefly describe the visual content, mood, and potential use cases in a video sequence. Keep it concise (under 50 words).' },
            { type: 'image', image: base64, mimeType: mimeType as any }, // Cast to any to avoid type issues if sdk types are strict, though mimeType string usually works
          ],
        },
      ],
    });

    return NextResponse.json({ 
        analysis: result.text
    });

  } catch (error) {
    console.error('Asset analysis error:', error);
    return NextResponse.json({ error: 'Failed to analyze asset' }, { status: 500 });
  }
}

