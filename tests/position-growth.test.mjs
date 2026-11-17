import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as D from '../web/domain.js';
import * as E from '../web/engine.js';
import {mergeResearch} from '../scripts/merge-research.mjs';
const read=async p=>JSON.parse(await readFile(p));
const [raw,ages,returns,youth,names]=await Promise.all(['catalog','age-verification','returns','youth','names'].map(x=>read(`research/${x}.json`)));
const catalog=mergeResearch(raw,ages,returns);

// 17/11/2026: a Puma hooker's floor used to lift his goal kicking to 15.
test('forwards do not kick goals like fly-halves and the position cap is idempotent',()=>{
 const w=D.initialWorld(catalog,77,returns,youth,names);
 const forwards=w.clubs.flatMap(c=>c.players).filter(p=>E.POSITIONS.indexOf(p.position)<8);
 assert.ok(forwards.length>500);
 assert.ok(forwards.every(p=>p.attributes.goalKicking<=10),'no forward above 10 in goal kicking');
 for(const p of forwards.slice(0,200))assert.deepEqual(E.capPrejudice(p.position,p.attributes),p.attributes);
 // Strengths of the position are untouched: a lock keeps his jumping, a prop his scrummaging.
 const a={...forwards.find(p=>p.position==='Hooker').attributes,goalKicking:18,lineout:19};
 const capped=E.capPrejudice('Hooker',a);
 assert.ok(capped.goalKicking<18);assert.equal(capped.lineout,19);
});

// 17/11/2026: a 22-year-old centre who played every match ended the season where he started.
test('a young senior who plays every round grows during the season',()=>{
 let w=D.initialWorld(catalog,91,returns,youth,names);
 const club=w.clubs.find(c=>c.id==='regatas-bella-vista');
 const xv=new Set(club.lineup?.length?club.lineup:E.autoLineup(club));
 const young=club.players.filter(p=>p.squad==='Plantel superior'&&p.age!=null&&p.age<=23&&xv.has(p.id));
 const pool=young.length?young:club.players.filter(p=>p.squad==='Plantel superior'&&xv.has(p.id)).slice(0,4).map(p=>{p.age=22;return p;});
 const before=new Map(pool.map(p=>[p.id,E.overall(p)]));
 for(let r=0;r<20;r++)w=D.advanceWorld(w,new Set());
 const after=w.clubs.find(c=>c.id==='regatas-bella-vista').players.filter(p=>before.has(p.id));
 const gain=after.reduce((n,p)=>n+E.overall(p)-before.get(p.id),0)/after.length;
 assert.ok(gain>=1.2,`young starters grew ${gain.toFixed(2)} in 20 rounds`);
});
