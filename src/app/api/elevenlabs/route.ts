import { NextRequest, NextResponse } from 'next/server';
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId = '21m00Tcm4TlvDq8ikWAM' } = await req.json(); // Default to Rachel

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    const client = new ElevenLabsClient({
        apiKey: apiKey,
    });

    const audioStream = await client.textToSpeech.convert(voiceId, {
        output_format: "mp3_44100_128",
        text: text,
        model_id: "eleven_multilingual_v2",
    });

    // stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of audioStream) {
        chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('ElevenLabs generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
