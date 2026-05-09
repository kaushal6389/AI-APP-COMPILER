import * as fs from 'fs';
import * as path from 'path';
import { runBenchmarks } from './evaluator';

const run = async () => {
  const results = await runBenchmarks();
  const outDir = path.join(process.cwd(), '.out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'benchmarks.json'), JSON.stringify(results, null, 2));
  console.log('Benchmark results saved to .out/benchmarks.json');
};

run().catch((error) => {
  console.error('Benchmark run failed:', error);
  process.exit(1);
});
