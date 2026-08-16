import fs from 'fs';
import path from 'path';
import { generatePySideScript } from '../src/lib/pysideScriptGenerator.ts';

const pyScript = generatePySideScript();
const outputPath = path.resolve('nasser_company_app.py');
fs.writeFileSync(outputPath, pyScript, 'utf-8');
console.log('✅ Generated nasser_company_app.py successfully!');
