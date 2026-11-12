import {readFile,writeFile,mkdir,readdir,stat,cp} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {resolve,extname} from 'node:path';
import {mergeResearch,addClubExtras} from './merge-research.mjs';
const root=process.cwd();
const engine=stripTypeScriptTypes(await readFile('src/engine/index.ts','utf8'));
const stats=await readFile('web/player-stats.js','utf8');
const statsExports=[...stats.matchAll(/export (?:const|function) (\w+)/g)].map(x=>x[1]);
await writeFile('web/engine.js',engine);
const catalogRaw=JSON.parse(await readFile('research/catalog.json','utf8'));
const returns=JSON.parse(await readFile('research/returns.json','utf8'));
const youth=JSON.parse(await readFile('research/youth.json','utf8'));
const names=JSON.parse(await readFile('research/names.json','utf8').catch(()=>'{"firstNames":[],"surnames":[],"byClub":{}}'));
const ages=JSON.parse(await readFile('research/age-verification.json','utf8').catch(()=>'{}'));
const catalog=mergeResearch(catalogRaw,ages,returns);
// Club grounds (transfer distances) and URBA titles, when present.
await addClubExtras(catalog,readFile);
const assets={};const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.json':'application/json;charset=utf-8'};
for(const file of ['index.html','style.css','app.js','domain.js','engine.js','player-stats.js'])assets['/'+file]={type:types[extname(file)],body:await readFile('web/'+file,'utf8')};
assets['/catalog.json']={type:types['.json'],body:JSON.stringify(catalog)};
assets['/returns.json']={type:types['.json'],body:JSON.stringify(returns)};
assets['/youth.json']={type:types['.json'],body:JSON.stringify(youth)};
assets['/names.json']={type:types['.json'],body:JSON.stringify(names)};
assets['/favicon.svg']={type:types['.svg'],body:await readFile('public/favicon.svg','utf8')};
// PNGs are binary; keep them encoded in the Worker bundle and decode on request.
for (const file of await readdir('public/crests').catch(()=>[])) if (file.endsWith('.png')) assets['/crests/'+file]={type:'image/png',encoding:'base64',body:await readFile('public/crests/'+file,'base64')};
for (const file of await readdir('public/kits-web').catch(()=>[])) {
 if (file.endsWith('.png')) assets['/kits/'+file]={type:'image/png',encoding:'base64',body:await readFile('public/kits-web/'+file,'base64')};
}
let domain=await readFile('web/domain.js','utf8');domain=domain.replace(/^import .*;\n/gm,'');
const worker=(await readFile('server/worker.js','utf8')).replace(/^import .*;\n/gm,'').replace('export async function handle','async function handle');
const exports=[...engine.matchAll(/export (?:const|function) (\w+)/g)].map(x=>x[1]);
const source=`const E=(()=>{${engine.replace(/export /g,'')}return {${exports.join(',')}};})();\nconst Stats=(()=>{${stats.replace(/export /g,'')}return {${statsExports.join(',')}};})();\n${domain.replace(/export /g,'')}\n${worker}\nconst ASSETS=${JSON.stringify(assets)};\nconst CATALOG=${JSON.stringify(catalog)};\nconst RETURNS=${JSON.stringify(returns)};\nconst YOUTH=${JSON.stringify(youth)};\nconst NAMES=${JSON.stringify(names)};\nexport default {fetch(request,env){return handle(request,env,ASSETS,CATALOG,RETURNS,YOUTH,NAMES)}};`;
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await writeFile('dist/server/index.js',source);await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built dependency-free Worker: ${(Buffer.byteLength(source)/1024).toFixed(0)} KB; ${catalog.clubs.length} clubs.`);
