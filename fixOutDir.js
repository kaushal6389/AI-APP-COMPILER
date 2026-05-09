const fs = require('fs');

let orchestratorStr = fs.readFileSync('packages/pipeline/dist/orchestrator.js', 'utf8');

orchestratorStr = orchestratorStr.replace(/const dockerfile = "FROM node:18-alpine[\\s\\S]*?fs\.writeFileSync\(path\.join\(outDir, 'tests\.ts'\), testsFile\);/, '');

orchestratorStr = orchestratorStr.replace(/\/\/ Emitting artifacts to disk \(Simulated Execution-Aware Layer\)\s*const outDir = path\.join\(process\.cwd\(\), '\.out', appName\);\s*fs\.mkdirSync\(outDir, \{ recursive: true \}\);/, `// Emitting artifacts to disk (Simulated Execution-Aware Layer)
    const outDir = path.join(process.cwd(), '.out', appName);
    fs.mkdirSync(outDir, { recursive: true });

    const dockerfile = "FROM node:18-alpine\\nWORKDIR /app\\nCOPY package.json .\\nRUN npm install\\nCOPY . .\\nEXPOSE 3000\\nCMD [\\"npm\\", \\"start\\"]\\n";
    const envExample = "DATABASE_URL=postgresql://user:pass@localhost:5432/db\\nPORT=3000\\nJWT_SECRET=supersecret\\n";
    const testsFile = "import request from 'supertest';\\nimport app from './routes';\\n\\ndescribe('API Tests', () => {\\n  it('should return 401 unauthenticated', async () => {\\n    const res = await request(app).get('/api/health');\\n    expect(res.status).toBe(404);\\n  });\\n});\\n";

    fs.writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile);
    fs.writeFileSync(path.join(outDir, '.env.example'), envExample);
    fs.writeFileSync(path.join(outDir, 'tests.ts'), testsFile);
`);

fs.writeFileSync('packages/pipeline/dist/orchestrator.js', orchestratorStr);


let indexStr = fs.readFileSync('packages/runtime/src/index.ts', 'utf8');

indexStr = indexStr.replace(/const dockerfile = "FROM node:18-alpine[\\s\\S]*?fs\.writeFileSync\(path\.join\(outDir, 'tests\.ts'\), testsFile\);/, '');

indexStr = indexStr.replace(/\/\/ Emitting artifacts to disk \(Simulated Execution-Aware Layer\)\s*const outDir = path\.join\(process\.cwd\(\), '\.out', appName\);\s*fs\.mkdirSync\(outDir, \{ recursive: true \}\);/, `// Emitting artifacts to disk (Simulated Execution-Aware Layer)
    const outDir = path.join(process.cwd(), '.out', appName);
    fs.mkdirSync(outDir, { recursive: true });

    const dockerfile = "FROM node:18-alpine\\nWORKDIR /app\\nCOPY package.json .\\nRUN npm install\\nCOPY . .\\nEXPOSE 3000\\nCMD [\\"npm\\", \\"start\\"]\\n";
    const envExample = "DATABASE_URL=postgresql://user:pass@localhost:5432/db\\nPORT=3000\\nJWT_SECRET=supersecret\\n";
    const testsFile = "import request from 'supertest';\\nimport app from './routes';\\n\\ndescribe('API Tests', () => {\\n  it('should return 401 unauthenticated', async () => {\\n    const res = await request(app).get('/api/health');\\n    expect(res.status).toBe(404);\\n  });\\n});\\n";

    fs.writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile);
    fs.writeFileSync(path.join(outDir, '.env.example'), envExample);
    fs.writeFileSync(path.join(outDir, 'tests.ts'), testsFile);
`);

fs.writeFileSync('packages/runtime/src/index.ts', indexStr);

console.log("Fixed outDir ordering");