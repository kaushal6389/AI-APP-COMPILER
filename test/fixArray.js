const fs = require('fs');

let orchestratorStr = fs.readFileSync('packages/pipeline/dist/orchestrator.js', 'utf8');

// I will just patch the array of "files" that it returns so it matches what we want
orchestratorStr = orchestratorStr.replace(/files:\s*\["schema\.prisma",\s*"routes\.ts",\s*"rbac\.ts",\s*"validators\.ts",\s*"manifest\.json",\s*"summary\.json",\s*"readiness\.json"\]/, 'files: ["schema.prisma", "routes.ts", "rbac.ts", "validators.ts", "manifest.json", "summary.json", "readiness.json", "Dockerfile", ".env.example", "tests.ts"]');

fs.writeFileSync('packages/pipeline/dist/orchestrator.js', orchestratorStr);