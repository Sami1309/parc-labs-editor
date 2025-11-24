import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, globalContext, contextBefore, contextAfter } = await req.json();

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = 'models/gemini-3-pro-preview'; // User specified model

    const fullPrompt = `
      You are a creative director assistant for a video production.
      
      Context Information:
      - Global Context (Movie Style/Theme): ${globalContext || "Cinematic, general"}
      - Scene Before: ${contextBefore || "None"}
      - Scene After: ${contextAfter || "None"}
      - User's specific prompt/intent: ${prompt || "Bridge these scenes"}

      Task: Suggest 3 distinct visual concepts for the next shot/asset.
      For each suggestion, provide:
      1. A short label (2-4 words).
      2. A detailed generation prompt.
      3. The best format ('image' or 'motion'). Use 'motion' if the concept involves movement, transformation, diagrams, or kinetic text. Use 'image' for static shots.

      Return ONLY a JSON array with this structure:
      [
        { "label": "...", "prompt": "...", "format": "image" | "motion" },
        ...
      ]
    `;

    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    // Helper to get text from response regardless of SDK version structure
    const getText = (res: any) => {
        if (typeof res.text === 'function') return res.text();
        if (res.response && typeof res.response.text === 'function') return res.response.text();
        if (res.candidates?.[0]?.content?.parts?.[0]?.text) return res.candidates[0].content.parts[0].text;
        return JSON.stringify(res);
    };

    const text = getText(result);
    
    // Parse JSON safely
    let suggestions = [];
    try {
        suggestions = JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON suggestions", e);
        // Fallback or attempt to extract JSON block
        const match = text.match(/\[.*\]/s);
        if (match) {
            suggestions = JSON.parse(match[0]);
        }
    }

    return NextResponse.json({ suggestions });

  } catch (error) {
    console.error('Quick suggest error:', error);
    return NextResponse.json({ 
        error: 'Generation failed', 
        details: String(error)
    }, { status: 500 });
  }
}

