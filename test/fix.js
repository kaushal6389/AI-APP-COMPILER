const fs = require('fs');
let code = fs.readFileSync('packages/pipeline/dist/orchestrator.js', 'utf8');

const match = code.match(/let routesFile = [\s\S]*?z\.object\([\s\S]*?\}\);\n\n\`;\n    \}/);
const blockToReplace = match[0];

const stringToPut = `
    const { ExpressProcessor } = require('../../runtime/src/generators/expressProcessor');
    const expressProcessor = new ExpressProcessor();
    const routesFile = expressProcessor.generateRoutesFile(manifest);
    const rbacFile = expressProcessor.generateRbacFile();
    const validatorsFile = expressProcessor.generateValidatorsFile(manifest);
`;

code = code.replace(blockToReplace, stringToPut);

fs.writeFileSync('packages/pipeline/dist/orchestrator.js', code);
console.log("Replaced!");