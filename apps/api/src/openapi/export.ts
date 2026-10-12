import { writeFileSync } from 'fs';
import { join } from 'path';
import { openApiSpec } from './spec';

const outputPath = join(process.cwd(), 'openapi.json');
writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));
console.log(`OpenAPI spec exported to ${outputPath}`);
