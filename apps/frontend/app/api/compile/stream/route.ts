import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    // Lazy-load orchestrator (Node-only)
    const { CompilerOrchestrator } = await import('../../../../../../packages/pipeline/dist/orchestrator');
    const orchestrator = new CompilerOrchestrator();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // send a start event
        controller.enqueue(encoder.encode(`event: START\ndata: ${JSON.stringify({ message: 'Streaming started' })}\n\n`));

        orchestrator.compile(prompt, (ev: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
          } catch (e) {
            // ignore
          }
        }).then((artifacts: any) => {
          // send final artifact
          controller.enqueue(encoder.encode(`event: COMPLETE\ndata: ${JSON.stringify(artifacts)}\n\n`));

          // persist semantic/validation issues to review queue if present
          try {
            const reviewDir = path.join(process.cwd(), '.out');
            if (!fs.existsSync(reviewDir)) fs.mkdirSync(reviewDir, { recursive: true });
            const reviewPath = path.join(reviewDir, 'review_queue.json');
            const existing = fs.existsSync(reviewPath) ? JSON.parse(fs.readFileSync(reviewPath, 'utf8')) : [];
            const issues = artifacts.trace?.flatMap((t: any) => (t.type === 'SEMANTIC_ISSUES' ? t.data : (t.type === 'VALIDATION_FAILED' ? t.data : []))) || [];
            if (issues.length > 0) {
              const entry = { id: Date.now(), prompt, issues, timestamp: new Date().toISOString() };
              existing.push(entry);
              fs.writeFileSync(reviewPath, JSON.stringify(existing, null, 2));
            }
          } catch (e) {
            // swallow
          }

          controller.close();
        }).catch((err: any) => {
          controller.enqueue(encoder.encode(`event: ERROR\ndata: ${JSON.stringify({ error: err?.message || String(err) })}\n\n`));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (error: any) {
    console.error('Streaming compile error:', error);
    return NextResponse.json({ error: error.message || 'Stream failed' }, { status: 500 });
  }
}
