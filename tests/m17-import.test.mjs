import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as D from '../web/domain.js';
import * as E from '../web/engine.js';
import {mergeResearch} from '../scripts/merge-research.mjs';
const read=async p=>JSON.parse(await readFile(p));
const [raw,ages,returns,youth,names]=await Promise.all(['catalog','age-verification','returns','youth','names'].map(x=>read(`research/${x}.json`)));
const catalog=mergeResearch(raw,ages,returns),records=youth.players.filter(p=>p.youthCategory==='M17'&&p.season===2026),prior={...youth,players:youth.players.filter(p=>p.youthCategory!=='M17')};
const players=w=>w.clubs.flatMap(c=>c.players.map(p=>({clubId:c.id,player:p})));
const pos=r=>r.position==='Octavo'?'Número 8':r.position;

test('official URBA M17 selection is sourced, placed at home, and does not invent birth dates',()=>{
 assert.equal(records.length,28);const world=D.initialWorld(catalog,26,returns,youth,names);const all=players(world);
 for(const r of records){const found=all.filter(x=>!x.player.fictional&&x.player.sourceRecordId===r.id);assert.equal(found.length,1,r.name);const {player:p,clubId}=found[0];assert.equal(clubId,r.clubId);assert.equal(p.squad,'M17');assert.equal(p.position,pos(r));assert.equal(p.age,null);assert.equal(p.ageKnown,false);assert.equal(p.selectionLevel,'URBA M17');assert.ok(p.sourceIds.length);// A URBA call-up starts above the usual M17 and projects to a first-team player (user decision, 12/11/2026).
const profile=E.developmentProfile(p);assert.ok(profile.originalProjection>=74,r.name+' projection');assert.ok(E.overall(p)>=36,r.name+' level');}
 const regatas=all.filter(x=>x.clubId==='regatas-bella-vista'&&records.some(r=>r.id===x.player.sourceRecordId));assert.deepEqual(regatas.map(x=>x.player.name).sort(),['Baltazar Estrada','Facundo Moreira','Juan Segundo Fresca','Ramiro Santa Ana'].sort());
 for(const entry of regatas)assert.equal(entry.player.position,pos(records.find(r=>r.id===entry.player.sourceRecordId)));
 assert.equal(new Set(all.map(x=>x.player.id)).size,all.length);
});
test('saved 2026 and 2027 worlds migrate once without deleting existing players or progress',()=>{
 for(const season of [2026,2027]){const before=D.initialWorld(catalog,12,returns,prior,names);before.dataVersion=17;delete before.urbaM17Revision;before.season=season;before.simulationDate=`${season}-11-10`;before.fixtures[0].match={homeScore:12,awayScore:5};const saved=structuredClone(before);
 const after=D.migrateWorld(before,catalog,returns,youth);assert.equal(after.dataVersion,D.DATA_VERSION);assert.deepEqual(after.fixtures,saved.fixtures);const all=players(after);
 for(const club of saved.clubs){const current=after.clubs.find(c=>c.id===club.id);assert.deepEqual(current.lineup,club.lineup);for(const old of club.players)assert.deepEqual(current.players.find(p=>p.id===old.id),old);}
 for(const r of records){const matches=all.filter(x=>x.player.sourceRecordId===r.id);assert.equal(matches.length,1,r.name);assert.equal(matches[0].player.youthSeasons,season-2026);}
 assert.equal(D.migrateWorld(after,catalog,returns,youth),after);assert.deepEqual(before,saved);
 }
});
test('later career saves do not fabricate missing players or duplicate existing identities',()=>{
 const older=D.initialWorld(catalog,12,returns,prior,names);older.dataVersion=17;delete older.urbaM17Revision;older.season=2028;older.simulationDate='2028-11-10';
 const rec=records[0],current=older.clubs.find(c=>c.id===rec.clubId),other=older.clubs.find(c=>c.id!==rec.clubId);const real={...current.players[0],id:`existing-${rec.id}`,name:rec.name,fictional:false,sourceRecordId:rec.id,attributes:{...current.players[0].attributes,pace:19}};other.players.push(real);
 const after=D.migrateWorld(older,catalog,returns,youth),all=players(after),matches=all.filter(x=>x.player.sourceRecordId===rec.id);assert.equal(matches.length,1);assert.equal(matches[0].clubId,other.id);assert.equal(matches[0].player.attributes.pace,19);
 assert.ok(records.slice(1).every(r=>!all.some(x=>x.player.sourceRecordId===r.id)));
});
