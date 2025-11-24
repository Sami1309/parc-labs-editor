import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, type = 'image', image, aspectRatio = '16:9' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    if (type === 'motion') {
        const model = 'models/gemini-3-pro-preview'; // User specified model

        // Construct parts with optional image
        const parts: any[] = [{ text: `
            You are an expert motion graphics designer and coder.
            Create a standalone SVG animation (using <svg> and SMIL <animate> or <style> with CSS keyframes) based on the following request.
            It should be self-contained in a single SVG string.
            
            Request: ${prompt}
            
            Requirements:
            - Use modern SVG features.
            - Ensure it is visually appealing and professional.
            - Aspect Ratio: ${aspectRatio} (Widescreen cinematic).
            - The SVG viewBox should respect the ${aspectRatio} ratio (e.g., "0 0 1920 1080" for 16:9).
            - If an input image was provided, use it as inspiration for shapes/colors (e.g. outline trace), but do not try to embed the raster image unless necessary (and if so, use data URI, but prefer vector graphics).
            - The output MUST be valid SVG code starting with <svg and ending with </svg>.
            - Do not wrap in markdown code blocks. Just return the code.
        ` }];

        if (image) {
             // image is expected to be base64 string. 
             // We need to ensure we strip the data prefix if present or handle it.
             // Usually api expects base64 data.
             const base64Data = image.includes(',') ? image.split(',')[1] : image;
             parts.push({
                 inlineData: {
                     mimeType: 'image/png', // Assumption: mostly png/jpeg.
                     data: base64Data
                 }
             });
        }

        const result = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts }],
        });

        // Helper to get text from response regardless of SDK version structure
        const getText = (res: any) => {
            if (typeof res.text === 'function') return res.text();
            if (res.response && typeof res.response.text === 'function') return res.response.text();
            if (res.candidates?.[0]?.content?.parts?.[0]?.text) return res.candidates[0].content.parts[0].text;
            return "";
        };

        let svgCode = getText(result);
        // Clean up markdown code blocks if present
        svgCode = svgCode.replace(/^```xml|^```svg|^```/g, '').replace(/```$/g, '').trim();
        
        return NextResponse.json({ content: svgCode, type: 'motion' });

    } else {
        // Image generation
        const model = 'models/gemini-2.5-flash-image'; 
        
        const parts: any[] = [{ text: `${prompt}\n\nAspect Ratio: ${aspectRatio}` }];

        if (image) {
             // Expecting base64 data URI: "data:image/png;base64,..."
             const base64Data = image.split(',')[1];
             const mimeType = image.split(';')[0].split(':')[1];
             if (base64Data && mimeType) {
                 parts.push({
                     inlineData: {
                         mimeType,
                         data: base64Data
                     }
                 });
             }
        }

        const contents = [
            {
                role: 'user',
                parts: parts,
            },
        ];

        const response = await ai.models.generateContent({
            model,
            config: {
                responseModalities: ['IMAGE'],
            },
            contents,
        });
        
        const candidates = response.candidates;
        let base64Image = null;
        let mimeType = 'image/png';

        if (candidates?.[0]?.content?.parts?.[0]?.inlineData) {
             base64Image = candidates[0].content.parts[0].inlineData.data;
             mimeType = candidates[0].content.parts[0].inlineData.mimeType || 'image/png';
        }

        if (base64Image) {
            return NextResponse.json({ image: `data:${mimeType};base64,${base64Image}`, type: 'image' });
        } else {
            return NextResponse.json({ error: 'No image generated' }, { status: 500 });
        }
    }

  } catch (error) {
    console.error('Visual generation error:', error);
    return NextResponse.json({ 
        error: 'Generation failed', 
        details: String(error)
    }, { status: 500 });
  }
}
