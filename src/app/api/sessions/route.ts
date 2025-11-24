import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'sessions');

export async function GET() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(SESSIONS_DIR).filter(file => file.endsWith('.json'));
    const sessions = files.map(file => {
      try {
        const content = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Failed to parse session file: ${file}`, e);
        return null;
      }
    }).filter(Boolean);

    // Sort by timestamp descending
    sessions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await req.json();
    
    if (!session.id || !session.name) {
      return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
    }

    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

    return NextResponse.json({ success: true, id: session.id });
  } catch (error) {
    console.error('Failed to save session:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

