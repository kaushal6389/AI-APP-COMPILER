const fs = require('fs');
let code = fs.readFileSync('packages/pipeline/dist/orchestrator.js', 'utf8');

code = code.replace(/import express from 'express';/g, "import express, { Request, Response } from 'express';");
code = code.replace(/async \(req, res\) => \{/g, "async (req: Request, res: Response) => {");

fs.writeFileSync('packages/pipeline/dist/orchestrator.js', code);
console.log("Done replace");