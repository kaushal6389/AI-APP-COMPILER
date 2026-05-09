import { NextResponse } from 'next/server';
import { runBenchmarks } from '../../../../../packages/pipeline/src/evaluation/evaluator';

export async function POST() {
  try {
    const results = await runBenchmarks();
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Benchmark Error:', error);
    return NextResponse.json({ error: error.message || 'Benchmark failed' }, { status: 500 });
  }
}
