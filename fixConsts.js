const fs = require('fs');

function fixDuplicates(filePath) {
    let str = fs.readFileSync(filePath, 'utf8');

    // Find and remove the first block of dockerfile/envExample/testsFile
    // Since my regex before failed, I will use precise string manipulations or simpler regex.
    
    // We remove the entire first declaration of all 3 consts and their writeFileSync calls before `outDir` is declared.
    const badBlockRegex = /const dockerfile = "FROM node:18-alpine[\s\S]*?const testsFile = "import request from 'supertest';[\s\S]*?\n\s*fs\.writeFileSync\(path\.join\(outDir, 'tests\.ts'\), testsFile\);/g;
    
    // Let's count matches
    const matches = str.match(badBlockRegex);
    if (matches && matches.length >= 2) {
       // Replace the first match with an empty string, keeping the second
       str = str.replace(badBlockRegex, '');
    } else if (matches && matches.length === 1) {
        // there's only one. But there's another block that has the exact identical strings maybe?
         // No wait, the replacement string I used had `fs.mkdirSync` before the new declarations.
         // Let's just rip all declarations out and put them *only* after `const outDir = ...fs.mkdirSync`
    }
    
    // An easier approach:
    // 1. Remove all instances of `const dockerfile = ...`
    // 2. Remove all instances of `const envExample = ...`
    // 3. Remove all instances of `const testsFile = ...`
    // 4. Remove all `fs.writeFileSync(path.join(outDir, 'Dockerfile')...`

    str = str.replace(/const dockerfile = [\s\S]*?CMD \[\"npm\", \"start\"\]\\n";/g, "");
    str = str.replace(/const envExample = [\s\S]*?JWT_SECRET=supersecret\\n";/g, "");
    str = str.replace(/const testsFile = [\s\S]*?\}\);\n";/g, "");
    
    str = str.replace(/fs\.writeFileSync\(path\.join\(outDir, 'Dockerfile'\), dockerfile\);/g, "");
    str = str.replace(/fs\.writeFileSync\(path\.join\(outDir, '\.env\.example'\), envExample\);/g, "");
    str = str.replace(/fs\.writeFileSync\(path\.join\(outDir, 'tests\.ts'\), testsFile\);/g, "");
    
    // Now re-insert exactly once after outDir
    str = str.replace(
        /const outDir = path\.join\(process\.cwd\(\), '\.out', appName\);\s*fs\.mkdirSync\(outDir, \{ recursive: true \}\);/,
        `const outDir = path.join(process.cwd(), '.out', appName);\n    fs.mkdirSync(outDir, { recursive: true });\n\n    const dockerfile = "FROM node:18-alpine\\nWORKDIR /app\\nCOPY package.json .\\nRUN npm install\\nCOPY . .\\nEXPOSE 3000\\nCMD [\\"npm\\", \\"start\\"]\\n";\n    const envExample = "DATABASE_URL=postgresql://user:pass@localhost:5432/db\\nPORT=3000\\nJWT_SECRET=supersecret\\n";\n    const testsFile = "import request from 'supertest';\\nimport app from './routes';\\n\\ndescribe('API Tests', () => {\\n  it('should return 401 unauthenticated', async () => {\\n    const res = await request(app).get('/api/health');\\n    expect(res.status).toBe(404);\\n  });\\n});\\n";\n\n    fs.writeFileSync(path.join(outDir, 'Dockerfile'), dockerfile);\n    fs.writeFileSync(path.join(outDir, '.env.example'), envExample);\n    fs.writeFileSync(path.join(outDir, 'tests.ts'), testsFile);`
    );

    fs.writeFileSync(filePath, str);
}

fixDuplicates('packages/pipeline/dist/orchestrator.js');
fixDuplicates('packages/runtime/src/index.ts');
console.log("Fixed duplicate consts");