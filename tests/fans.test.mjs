import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as D from '../web/domain.js';
import * as E from '../web/engine.js';
import {mergeResearch,addClubExtras} from '../scripts/merge-research.mjs';
const read=async p=>JSON.parse(await readFile(p));
const [raw,ages,returns,youth,names]=await Promise.all(['catalog','age-verification','returns','youth','names'].map(x=>read(`research/${x}.json`)));
const catalog=await addClubExtras(mergeResearch(raw,ages,returns),readFile);

// 17/11/2026: clásicos (not necessarily mutual) and the crowd's mood.
test('clásicos are one-sided when the data says so, and the crowd reacts to results',()=>{
 let w=D.initialWorld(catalog,404,returns,youth,names);
 const regatas=w.clubs.find(c=>c.id==='regatas-bella-vista');
 assert.equal(regatas.fans,'La Ola');assert.deepEqual(regatas.rivals,['cuba']);
 assert.ok(D.isDerby(w,{homeId:'cuba',awayId:'regatas-bella-vista'}),'Regatas counts CUBA as its clásico');
 assert.ok(D.isDerby(w,{homeId:'los-matreros',awayId:'regatas-bella-vista'}),'Los Matreros counts Regatas');
 assert.ok(!D.isDerby(w,{homeId:'newman',awayId:'casi'}));
 assert.equal(D.fansName(w.clubs.find(c=>c.id==='casi')),'La hinchada de '+w.clubs.find(c=>c.id==='casi').name);
 for(let r=0;r<26;r++)w=D.advanceWorld(w,new Set());
 const moods=w.clubs.map(c=>c.fanMood);
 assert.ok(moods.some(m=>m>=20)&&moods.some(m=>m<=-20),'moods spread both ways');
 const fans=w.news.filter(n=>n.kind==='fans');
 assert.ok(fans.some(n=>n.mood==='angry'),'some barra protests');
 assert.ok(fans.some(n=>n.mood?.startsWith('derby')),'clásicos make the news');
 // No club protests twice within five rounds.
 for(const c of w.clubs){const r=fans.filter(n=>n.clubId===c.id&&n.protest).map(n=>n.round);for(let i=1;i<r.length;i++)assert.ok(r[i]-r[i-1]>=5,c.id);}
 // The crowd effect is small and signed.
 assert.ok(E.crowdEffect(80)>0&&E.crowdEffect(-80)<0&&E.crowdEffect(0)===0);
});
