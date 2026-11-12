import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

test('standalone bundle compiles when domain imports use aliases',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rm26-standalone-'));
 try{
  const html=join(dir,'app.html'),js=join(dir,'app.mjs');
  execFileSync(process.execPath,['scripts/build-standalone.mjs',html],{stdio:'pipe'});
  const text=await readFile(html,'utf8');const script=text.match(/<script type="module">([\s\S]*)<\/script>/);
  assert.ok(script,'inline application is present');assert.match(script[1],/trajectoryLabel\s*:\s*stageLabel/);
  await writeFile(js,script[1]);execFileSync(process.execPath,['--check',js],{stdio:'pipe'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
