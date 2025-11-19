import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const config = {
      responseModalities: ['IMAGE'] as const, // Force 'IMAGE' only if we want pure images, but user code had 'TEXT' too. 
      // However, for "generate visual", we mostly want the image. 
      // Let's follow the user's snippet logic but adapted for a single image return.
    };

    const model = 'gemini-2.5-flash-image';

    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config: {
          responseModalities: ['IMAGE'],
      },
      contents,
    });

    let base64Image = null;
    let mimeType = 'image/png';

    for await (const chunk of response) {
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        const inlineData = chunk.candidates[0].content.parts[0].inlineData;
        base64Image = inlineData.data;
        mimeType = inlineData.mimeType || 'image/png';
        break; // Found the image, stop
      }
    }

    if (base64Image) {
        return NextResponse.json({ image: `data:${mimeType};base64,${base64Image}` });
    } else {
        return NextResponse.json({ error: 'No image generated' }, { status: 500 });
    }

  } catch (error) {
    console.error('Visual generation error:', error);
    return NextResponse.json({ 
        error: 'Generation failed', 
        details: String(error)
    }, { status: 500 });
  }
}
