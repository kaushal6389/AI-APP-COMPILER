process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node'
});
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { CompilerOrchestrator } = require('./src/orchestrator.ts');

(async () => {
  try {
    const orchestrator = new CompilerOrchestrator();
    console.log('Starting pipeline run...');
    const res = await orchestrator.compile('Create a simple notes app with users and notes', (ev) => {
      try { console.log('EVENT>', JSON.stringify(ev)); } catch(e) { console.log('EVENT>', ev); }
    });
    console.log('PIPELINE RESULT>', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Pipeline failed:', e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();
