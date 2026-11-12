import {readFile,writeFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {mergeResearch,addClubExtras} from './merge-research.mjs';
const get=p=>readFile(p,'utf8');
const [html,css,ts,statsSource,domainSource,appSource,catalogText,returnsText,youthText,namesText,ageText]=await Promise.all(['web/index.html','web/style.css','src/engine/index.ts','web/player-stats.js','web/domain.js','web/app.js','research/catalog.json','research/returns.json','research/youth.json','research/names.json','research/age-verification.json'].map(get));
const returns=JSON.parse(returnsText),catalog=mergeResearch(JSON.parse(catalogText),JSON.parse(ageText),returns);
await addClubExtras(catalog,readFile);
for(const club of catalog.clubs)if(club.crest?.localPath?.startsWith('/crests/')){const image=await readFile(`public${club.crest.localPath}`).catch(()=>null);if(image)club.crest.localPath=`data:image/png;base64,${image.toString('base64')}`;}
for(const club of catalog.clubs)for(const kit of Object.values(club.kits??{})){
 if(!kit?.localPath?.startsWith('/kits/'))continue;
 const filename=kit.localPath.slice('/kits/'.length);if(!/^[a-z0-9-]+\.png$/.test(filename))continue;
 const image=await readFile(`public/kits-web/${filename}`).catch(()=>null);if(image)kit.localPath=`data:image/png;base64,${image.toString('base64')}`;
}
const engine=stripTypeScriptTypes(ts);const exports=[...engine.matchAll(/export (?:const|function) (\w+)/g)].map(x=>x[1]);
const domainExports=[...domainSource.matchAll(/export (?:const|function) (\w+)/g)].map(x=>x[1]);
const domainImport=appSource.match(/import\s*\{([^}]+)\}\s*from\s*['\"]\.\/domain\.js['\"];?/);
if(!domainImport)throw new Error('No se encontró el contrato de importación del dominio');
const domainBindings=domainImport[1].replace(/\s+as\s+/g,':');
const domain=domainSource.replace(/^import .*;\n/gm,'').replace(/export /g,'');
const statsExports=[...statsSource.matchAll(/export (?:const|function) (\w+)/g)].map(x=>x[1]);const app=appSource.replace(/^import .*;\n/gm,'');
const source=`window.__RM_CATALOG=${JSON.stringify(catalog)};\nwindow.__RM_RETURNS=${returnsText};\nwindow.__RM_YOUTH=${youthText};\nwindow.__RM_NAMES=${namesText};\nconst engine=(()=>{${engine.replace(/export /g,'')}\nreturn {${exports.join(',')}}})();\nconst E=engine;\nconst Stats=(()=>{${statsSource.replace(/export /g,'')}return {${statsExports.join(',')}};})();\nconst {${statsExports.join(',')}}=Stats;\nconst Domain=(()=>{${domain}\nreturn {${domainExports.join(',')}};})();\nconst {${domainBindings}}=Domain;\n${app}`.replaceAll('</script','<\\/script');
const output=html.replace(/<link rel="icon"[^>]*>/,'').replace(/<link rel="stylesheet"[^>]*>/,`<style>${css.replaceAll('</style','<\\/style')}</style>`).replace(/<script type="module" src="\/app.js"><\/script>/,`<script type="module">${source}</script>`);
const path=process.argv[2]??'/tmp/Tercer-Tiempo-web.html';await writeFile(path,output);console.log(`Standalone: ${path} (${Buffer.byteLength(output)} bytes)`);
