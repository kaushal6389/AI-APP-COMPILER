const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
app.use(bodyParser.json());

app.post('/generate', (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const env = { ...process.env, AI_PIPELINE_PROMPT: prompt };
  const proc = spawn('node', [path.join(process.cwd(), 'packages', 'pipeline', 'run_test.js')], { env });

  let out = '';
  proc.stdout.on('data', d => { out += d.toString(); });
  proc.stderr.on('data', d => { out += d.toString(); });

  proc.on('close', code => {
    const manifestPath = path.join(process.cwd(), '.out', 'app', 'manifest.json');
    let manifest = null;
    if (fs.existsSync(manifestPath)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) { manifest = null; }
    }
    res.json({ code, manifest, logs: out.substring(0, 2000) });
  });
});

app.get('/', (req, res) => res.send('AI App Compiler demo server. POST /generate { prompt }'));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Demo server listening on http://localhost:${port}`));
