import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root = resolve(import.meta.dirname,'..');
const src=resolve(root,'src/engine.mjs');
const dst=resolve(root,'site/assets/engine.mjs');
copyFileSync(src,dst);
console.log('Engine copied to site/assets/engine.mjs (no bundle dependency)');
