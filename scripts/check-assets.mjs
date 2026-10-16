import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const html=await readFile('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#?]*)"/g)) {
  if(match[1]==='./')continue;
  await access(resolve('dist',match[1]));
}
for(const file of ['app.js','domain.js','github.js','sample.js','session.js'])await access(resolve('dist',file));
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
if(manifest.static?.directory!=='dist')throw new Error('Expected static dist output.');
console.log('Static entrypoint, module output and local asset references verified.');
