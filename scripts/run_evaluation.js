const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packages', 'pipeline', 'evaluation_prompts.json'), 'utf8'));
const outDir = path.join(process.cwd(), '.out', 'evaluation');
fs.mkdirSync(outDir, { recursive: true });

const results = [];

for (const p of prompts) {
  const start = Date.now();
  // Clear the existing manifest if any
  const appOutDir = path.join(process.cwd(), '.out', 'app');
  if (fs.existsSync(appOutDir)) {
    fs.rmSync(appOutDir, { recursive: true, force: true });
  }

  // Use the existing pipeline runner with an env var to inject prompt
  const env = { ...process.env, AI_PIPELINE_PROMPT: p.prompt };
  const r = spawnSync('node', ['packages/pipeline/run_test.js'], { env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const duration = Date.now() - start;

  const output = r.stdout || '';
  const error = r.stderr || (r.error ? r.error.message : '');

  // Simple heuristic to decide success: pipeline completes and writes .out/app/manifest.json
  const manifestPath = path.join(process.cwd(), '.out', 'app', 'manifest.json');
  const success = fs.existsSync(manifestPath);

  results.push({ id: p.id, type: p.type, prompt: p.prompt, success, durationMs: duration, exitCode: r.status, error: error.substring(0, 200), outputSnippet: output.substring(0, 1000) });

  // Save per-run result
  fs.writeFileSync(path.join(outDir, `result_${p.id}.json`), JSON.stringify(results[results.length - 1], null, 2));
}

// Aggregate metrics
const total = results.length;
const passed = results.filter(r => r.success).length;
const avgLatency = Math.round(results.reduce((s, r) => s + r.durationMs, 0) / total);

const summary = { total, passed, failed: total - passed, passRate: (passed/total)*100, avgLatency, results };
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log('Evaluation complete:', summary);
