import { AppManifest } from '@ai-compiler/schemas';

/**
 * Stage 5: Repair Engine
 * An autonomous agent that receives specific JSON paths and error messages,
 * and surgical applies JSON patches (RFC 6902 style) without regenerating the whole schema.
 */
export class RepairEngine {
  public async attemptRepair(manifest: AppManifest, errors: any[]): Promise<AppManifest> {
    console.log(`\n[Stage 5] 🔧 Repair Engine Triggered! Analyzing ${errors.length} error(s)...`);
    
    // Deep clone to prevent mutating the original state uncontrollably
    let repairedManifest: AppManifest = JSON.parse(JSON.stringify(manifest));
    let repairCount = 0;

    for (const error of errors) {
      console.log(`   -> Diagnosing Error at path [${error.path}]`);
      console.log(`   -> Reason: ${error.message}`);

      // MOCK LLM REPAIR ACTION:
      // In production, we'd pass the Error + Schema slice to the LLM to get a JSON Patch.
      // Here, we'll simulate the deterministic repair logic.

      if (error.path.includes('rolesAllowed')) {
        // Simulated JSON Patch logic (LLM decides to remove the hallucinated role)
        const match = error.path.match(/api\[(\d+)\]\.rolesAllowed\[(\d+)\]/);
        if (match) {
          const apiIndex = parseInt(match[1]);
          const roleIndex = parseInt(match[2]);

          console.log(`   -> [Fix Applied]: Surgically removing hallucinated role from API route [${repairedManifest.api[apiIndex].method} ${repairedManifest.api[apiIndex].path}]`);

          // Apply patch: Removing the invalid element
          repairedManifest.api[apiIndex].rolesAllowed?.splice(roleIndex, 1);
          repairCount++;
        }
      }

      if (error.path.includes('targetModel')) {
        // Simulated JSON Patch logic (LLM fixes a typo in DB relations)
        const match = error.path.match(/database\[(\d+)\]\.relations\[(\d+)\]\.targetModel/);
        if (match) {
          const mIndex = parseInt(match[1]);
          const rIndex = parseInt(match[2]);
          console.log(`   -> [Fix Applied]: Setting orphaned relationship target model back to valid entity`);
          // Repairing it to point to a safe fallback or correcting the typo
          repairedManifest.database[mIndex].relations![rIndex].targetModel = "User";
          repairCount++;
        }
      }
    }

    // attach repair metadata
    try { (repairedManifest as any).repairCount = repairCount; } catch (e) {}

    console.log(`[Stage 5] 🟢 Repair actions completed. Applied ${repairCount} fixes. Returning patched manifest.\n`);
    return repairedManifest;
  }
}
