import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const reviewPath = path.join(process.cwd(), '.out', 'review_queue.json');
    if (!fs.existsSync(reviewPath)) return NextResponse.json({ items: [] });
    const items = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
    return NextResponse.json({ items });
  } catch (error: any) {
    console.error('Review queue read error', error);
    return NextResponse.json({ error: error.message || 'Failed to read review queue' }, { status: 500 });
  }
}
