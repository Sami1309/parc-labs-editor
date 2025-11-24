import { GoogleGenAI } from '@google/genai';
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
    const model = 'gemini-2.0-flash-exp'; // Fast model

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = result.response.text();

    return NextResponse.json({ text });

  } catch (error) {
    console.error('Quick suggest error:', error);
    return NextResponse.json({ 
        error: 'Generation failed', 
        details: String(error)
    }, { status: 500 });
  }
}

