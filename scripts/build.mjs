import {rm,mkdir,cp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
await cp('public','dist',{recursive:true});
console.log('TypeScript compiled and static assets copied to dist.');
