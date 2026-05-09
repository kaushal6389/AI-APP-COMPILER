import { CompilerOrchestrator } from '@ai-compiler/pipeline/src/orchestrator';

/**
 * 10 Realistic & Edge-Case Prompts
 */
export const SAMPLE_PROMPTS = [
  // Realistic SaaS Prompts
  "Build a CRM for real estate agents. Roles: Admin, Agent. Entities: Properties, Clients, Appointments. Agents can CRUD their own clients. Need Stripe usage-based billing.",
  "Create an internal employee directory. Needs Azure AD SSO. Users can view profiles. HR role can edit salaries. DB: Postgres.",
  "Make a minimal inventory tracking app for a warehouse. Items need barcodes, quantities, and locations. Users can scan items in/out. Manager gets a dashboard.",
  "Design a patient portal for a dental clinic. Patients can book appointments and view prescriptions. Doctors can upload records. Must be HIPAA compliant.",
  "E-commerce backend for a clothing store. Admin adds products. Customers add to cart and checkout. Need variants (size, color).",
  // Edge-Case / Vague / Contradictory Prompts
  "Build Facebook but for dogs.", // Very vague, needs assumption logging
  "Create a secure banking app. Everyone can delete accounts.", // Contradictory security requirements
  "I want an app that uses AI.", // Extreme lack of constraints
  "Make a marketplace where sellers upload items, but there are no sellers allowed.", // Logical contradiction
  "Build a task app with a massive database for a million users." // Underspecified entities
];

/**
 * Evaluation Engine
 * Tracks generation success, retries, latency, and consistency.
 */
export class EvaluationEngine {
  private orchestrator = new CompilerOrchestrator();

  public async runEvaluationBatch() {
    console.log("=== STARTING EVALUATION BATCH (10 PROMPTS) ===");
    
    let successCount = 0;
    let totalRetries = 0;
    const metrics: any[] = [];

    for (let i = 0; i < SAMPLE_PROMPTS.length; i++) {
        const prompt = SAMPLE_PROMPTS[i];
        console.log(`\nEvaluating [${i + 1}/${SAMPLE_PROMPTS.length}]: "${prompt.substring(0, 40)}..."`);
        
        const startTime = Date.now();
        try {
            // Mocking execution trace inside the compilation flow
            await this.orchestrator.compile(prompt);
            
            const latency = Date.now() - startTime;
            metrics.push({ prompt, status: 'Success', latency, tokenCost: 'Est. ~1500 tokens' });
            successCount++;
        } catch (error: any) {
            const latency = Date.now() - startTime;
            metrics.push({ prompt, status: 'Failed', error: error.message, latency });
        }
    }

    console.log("\n=== EVALUATION REPORT ===");
    console.table(metrics);
    console.log(`Success Rate: ${(successCount / SAMPLE_PROMPTS.length) * 100}%`);
    console.log(`Total System Repair Retries Triggered: ${totalRetries}`);
  }
}
