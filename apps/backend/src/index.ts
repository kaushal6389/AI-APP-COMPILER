import { CompilerOrchestrator } from '@ai-compiler/pipeline/src/orchestrator';
import { EvaluationEngine } from '@ai-compiler/evaluation/src';

// Entry point to run the pipeline
async function main() {
  const orchestrator = new CompilerOrchestrator();
  
  const samplePrompt = "Build me a Task Management System where members can create tasks and admins can delete tasks. " + 
                       "Make sure it tracks user emails and task statuses.";

  // Run a single realistic pipeline flow
  await orchestrator.compile(samplePrompt);

  console.log("\n\n#############################################");
  console.log("### NOW RUNNING THE FULL EVALUATION BATCH ###");
  console.log("#############################################\n");

  const evalEngine = new EvaluationEngine();
  await evalEngine.runEvaluationBatch();
}

main().catch(err => {
  console.error("Fatal Error running pipeline:", err);
  process.exit(1);
});
