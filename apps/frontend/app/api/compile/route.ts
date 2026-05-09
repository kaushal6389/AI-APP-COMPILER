import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });

    // Lazy-load the Node-only orchestrator to avoid Next.js bundling/build-time side-effects
    const { CompilerOrchestrator } = await import('../../../../../packages/pipeline/dist/orchestrator');
    const orchestrator = new CompilerOrchestrator();
    const events: Array<{ type: string; data?: any }> = [];

    const startTime = Date.now();

    const artifacts = await orchestrator.compile(prompt, (event) => {
      events.push(event);
    });

    const endTime = Date.now();
    const repairCount = events.filter((event) => event.type === 'REPAIR_APPLIED').length;
    const validationFailures = events.filter((event) => event.type === 'VALIDATION_FAILED').length;
    const confidenceScore = artifacts.intentIR?.hallucinationRisk === 'Low'
      ? 0.92
      : artifacts.intentIR?.hallucinationRisk === 'Medium'
        ? 0.72
        : 0.55;

    const stageTimings = events
      .filter((event) => event.type.endsWith('_END') && event.data?.durationMs)
      .reduce((acc: Record<string, number>, event) => {
        acc[event.type] = event.data.durationMs as number;
        return acc;
      }, {});

    const summary = {
      latencyMs: endTime - startTime,
      repairCount,
      validationFailures,
      confidenceScore,
      stageCount: events.length,
      completed: events.some((event) => event.type === 'PIPELINE_COMPLETE'),
      stageTimings
    };

    return NextResponse.json({ ...artifacts, trace: events, summary });
  } catch (error: any) {
    console.error("API Compilation Error:", error);
    return NextResponse.json({ error: error.message || 'Pipeline failed' }, { status: 500 });
  }
}
