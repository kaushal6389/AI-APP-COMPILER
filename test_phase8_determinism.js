/**
 * PHASE 8 DETERMINISM TEST
 * Test that identical inputs produce identical outputs
 */

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node'
});
require('ts-node/register/transpile-only');
require('tsconfig-paths/register');
const { CompilerOrchestrator } = require('./packages/pipeline/src/orchestrator.ts');

async function testDeterminism() {
  console.log('========== PHASE 8: DETERMINISTIC PIPELINE TESTS ==========\n');

  const orchestrator = new CompilerOrchestrator();

  // Test prompt that should produce consistent results
  const testPrompt = 'Create a simple CRM system with users, contacts, and leads. Include admin, manager, and sales agent roles.';

  console.log('Testing deterministic behavior...');
  console.log(`Prompt: "${testPrompt}"\n`);

  // Run the same prompt multiple times
  const runs = [];
  const numRuns = 5;

  for (let i = 0; i < numRuns; i++) {
    console.log(`Run ${i + 1}/${numRuns}...`);
    try {
      const result = await orchestrator.compile(testPrompt);
      runs.push(result);

      if (result.deterministic) {
        console.log(`  ✓ Semantic Hash: ${result.deterministic.hash.combinedHash}`);
        console.log(`  ✓ Naming Canonical: ${result.deterministic.canonical}`);
        console.log(`  ✓ Entities: ${result.deterministic.naming.entityCount}, Relations: ${result.deterministic.naming.relationCount}, Roles: ${result.deterministic.naming.roleCount}, APIs: ${result.deterministic.naming.apiCount}`);
      } else {
        console.log('  ⚠️ No deterministic data in result');
      }
    } catch (error) {
      console.log(`  ✗ Run ${i + 1} failed:`, error.message);
    }
  }

  // Check determinism
  console.log('\n========== DETERMINISM VERIFICATION ==========');

  let allDeterministic = true;
  const firstRun = runs[0];

  if (!firstRun?.deterministic) {
    console.log('✗ No deterministic data in first run');
    allDeterministic = false;
  } else {
    for (let i = 1; i < runs.length; i++) {
      const run = runs[i];
      if (!run?.deterministic) {
        console.log(`✗ Run ${i + 1} missing deterministic data`);
        allDeterministic = false;
        continue;
      }

      // Check semantic hashes match
      if (run.deterministic.hash.intentHash !== firstRun.deterministic.hash.intentHash) {
        console.log(`✗ Intent hash mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
      if (run.deterministic.hash.designHash !== firstRun.deterministic.hash.designHash) {
        console.log(`✗ Design hash mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
      if (run.deterministic.hash.combinedHash !== firstRun.deterministic.hash.combinedHash) {
        console.log(`✗ Combined hash mismatch in run ${i + 1}`);
        allDeterministic = false;
      }

      // Check naming is canonical
      if (!run.deterministic.canonical) {
        console.log(`✗ Run ${i + 1} naming not canonical`);
        allDeterministic = false;
      }

      // Check entity/relation counts match
      if (run.deterministic.naming.entityCount !== firstRun.deterministic.naming.entityCount) {
        console.log(`✗ Entity count mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
      if (run.deterministic.naming.relationCount !== firstRun.deterministic.naming.relationCount) {
        console.log(`✗ Relation count mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
      if (run.deterministic.naming.roleCount !== firstRun.deterministic.naming.roleCount) {
        console.log(`✗ Role count mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
      if (run.deterministic.naming.apiCount !== firstRun.deterministic.naming.apiCount) {
        console.log(`✗ API count mismatch in run ${i + 1}`);
        allDeterministic = false;
      }
    }
  }

  if (allDeterministic) {
    console.log('✓ ALL RUNS DETERMINISTIC - Phase 8 SUCCESS!');
    console.log(`✓ Semantic Hash: ${firstRun.deterministic.hash.combinedHash}`);
    console.log(`✓ ${runs.length} identical runs completed`);
  } else {
    console.log('✗ DETERMINISM FAILED - Phase 8 needs fixes');
  }

  console.log('\n========== PHASE 8 COMPLETE ==========');
}

// Run the test
testDeterminism().catch(console.error);