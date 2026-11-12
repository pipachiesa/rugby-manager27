import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialWorld, ageOnDate, migrateWorld, SIMULATION_DATE, DATA_VERSION, careerStage, trajectoryLabel, trajectoryComplete} from '../web/domain.js';
import {mergeResearch} from '../scripts/merge-research.mjs';
import * as E from '../web/engine.js';
const read=async p=>JSON.parse(await readFile(p));
const returns=await read('research/returns.json'),youth=await read('research/youth.json');
const catalog=mergeResearch(await read('research/catalog.json'),await read('research/age-verification.json'),returns);
const names=await read('research/names.json').catch(()=>({}));
test('verified ages are calendar-based and future or malformed dates remain unknown',()=>{
 assert.equal(ageOnDate('1993-12-06','2026-11-10'),32);assert.equal(ageOnDate('2001-11-16','2026-11-16'),25);
 for(const birth of [null,'2001','2001-02-31','2027-01-01'])assert.equal(ageOnDate(birth,SIMULATION_DATE),null);
 assert.equal(ageOnDate('2000-01-01','2026-02-30'),null);
});
test('every position-supported active documented senior has one identity in the correct club with honest age',()=>{
 const world=initialWorld(catalog,42,returns,youth,names);const clubs=new Set(world.clubs.map(c=>c.id));
 const expected=catalog.players.filter(p=>clubs.has(p.clubId)&&!['departed','retired'].includes(p.rosterStatus)&&E.POSITIONS.includes(p.position==='Octavo'?'Número 8':p.position==='Tercera línea'?'Ala':p.position));
 const all=world.clubs.flatMap(c=>c.players.filter(p=>p.squad==='Plantel superior'&&!p.fictional).map(p=>({...p,clubId:c.id})));
 for(const record of expected){const matches=all.filter(p=>p.sourceRecordId===record.id);assert.equal(matches.length,1,record.id);const p=matches[0];assert.equal(p.clubId,record.clubId);const age=ageOnDate(record.birthDate,SIMULATION_DATE),estimate=age===null?ageOnDate(record.estimatedBirthDate,SIMULATION_DATE):null;assert.equal(p.age,age??estimate);assert.equal(p.ageKnown,age!==null);assert.equal(p.ageEstimated,estimate!==null);}
 const identities=all.map(p=>`${p.clubId}/${p.sourceRecordId}`);assert.equal(new Set(identities).size,identities.length);
 assert.ok(world.clubs.every(c=>new Set(c.players.map(p=>p.id)).size===c.players.length));
 for(const record of catalog.players.filter(p=>['departed','retired'].includes(p.rosterStatus)))assert.ok(!all.some(p=>p.sourceRecordId===record.id));
});
test('legacy migration is idempotent and preserves history and lineup while fixing ages and ratings',()=>{
 const world=initialWorld(catalog,123,returns,youth,names),club=world.clubs.find(c=>c.id==='regatas-bella-vista');
 const p=club.players.find(p=>!p.fictional);const originalId=p.id;p.age=19;p.ageKnown=false;p.birthDate=null;p.attributes=Object.fromEntries(Object.keys(p.attributes).map(k=>[k,19]));p.fitness=63;
 const oldMean=E.overall(p);delete world.dataVersion;world.fixtures[0].match={homeScore:22,awayScore:14};club.lineup=club.players.slice(0,15).map(p=>p.id);
 const old=structuredClone(world),migrated=migrateWorld(world,catalog,returns),newPlayer=migrated.clubs.flatMap(c=>c.players).find(x=>x.id===originalId);
 assert.equal(migrated.dataVersion,DATA_VERSION);assert.match(migrated.migrationNotice,/Valoraciones recalibradas/);assert.ok(E.overall(newPlayer)<oldMean);assert.equal(newPlayer.fitness,63);
 assert.deepEqual(migrated.fixtures,old.fixtures);assert.deepEqual(migrated.clubs.find(c=>c.id===club.id).lineup,club.lineup);assert.equal(migrateWorld(migrated,catalog,returns),migrated);assert.equal(world.clubs.find(c=>c.id===club.id).players.find(x=>x.id===originalId).age,19);
});
test('only real active overseas prospects appear and all origin clubs are correct',()=>{
 const world=initialWorld(catalog,9,returns,youth,names),byName=new Map(returns.players.map(p=>[p.name,p]));
 const local=world.clubs.flatMap(c=>c.players.filter(p=>!p.fictional).map(p=>`${c.id}/${p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}`));
 for(const c of world.returnCandidates){assert.ok(!local.includes(`${c.homeClubId}/${c.player.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}`));assert.equal(c.player.fictional,false);const source=byName.get(c.player.name);assert.ok(source,c.player.name);assert.equal(source.status,'exterior');assert.equal(source.eligibleForGameMarket,true);assert.equal(c.homeClubId,source.originClubId);assert.equal(c.player.age,ageOnDate(source.birthDate,SIMULATION_DATE));}
 assert.ok(!world.returnCandidates.some(c=>['Agustín Creevy','Santiago Cordero','Nicolás Sánchez'].includes(c.player.name)));
});
test('real unknown ages stay null through a season rollover',async()=>{
 const {advanceSeasonWorld}=await import('../web/domain.js');let w=initialWorld(catalog,44,returns,youth,names);let c=w.clubs.find(c=>c.players.some(p=>!p.fictional&&p.age===null));const id=c.players.find(p=>!p.fictional&&p.age===null).id;
 w.fixtures=w.fixtures.map(f=>({...f,match:{homeScore:0,awayScore:0,homeTries:0,awayTries:0}}));
 let next=advanceSeasonWorld(w);const player=next.clubs.flatMap(c=>c.players).find(p=>p.id===id);assert.equal(player.age,null);assert.equal(player.ageKnown,false);assert.equal(next.simulationDate,'2027-11-10');
});
test('estimated ages stay flagged, never override documented dates and survive rollover',async()=>{
 const {advanceSeasonWorld}=await import('../web/domain.js');
 const estimated=catalog.players.filter(p=>p.estimatedBirthDate);assert.ok(estimated.length>0);
 for(const p of estimated){assert.equal(p.birthDate,null,`${p.id}: estimate beside documented date`);assert.ok(p.estimatedBirthDateSourceIds?.length,`${p.id}: estimate without source`);}
 const w=initialWorld(catalog,7,returns,youth,names),all=w.clubs.flatMap(c=>c.players);
 const est=all.find(p=>p.ageEstimated);assert.ok(est);assert.equal(est.ageKnown,false);assert.equal(est.birthDate,null);assert.equal(est.age,ageOnDate(est.estimatedBirthDate,SIMULATION_DATE));
 assert.ok(all.every(p=>!(p.ageKnown&&p.ageEstimated)));
 w.fixtures=w.fixtures.map(f=>({...f,match:{homeScore:0,awayScore:0,homeTries:0,awayTries:0}}));
 const next=advanceSeasonWorld(w).clubs.flatMap(c=>c.players).find(p=>p.id===est.id);assert.equal(next.ageEstimated,true);assert.equal(next.ageKnown,false);assert.equal(next.age,ageOnDate(est.estimatedBirthDate,'2027-11-10'));
});
test('v2 leagues gain estimated ages and a uniform club recalibration without touching results or lineups',()=>{
 const w=initialWorld(catalog,9,returns,youth,names);w.dataVersion=2;
 for(const c of w.clubs)for(const p of c.players)if(p.ageEstimated)Object.assign(p,{age:null,ageEstimated:false,estimatedBirthDate:null});
 const old=structuredClone(w),m=migrateWorld(w,catalog,returns);
 assert.equal(m.dataVersion,DATA_VERSION);assert.match(m.migrationNotice,/estimadas/);assert.deepEqual(m.fixtures,old.fixtures);
 const before=old.clubs.flatMap(c=>c.players),after=m.clubs.flatMap(c=>c.players);
 assert.ok(after.some(p=>p.ageEstimated));
 // Documented players are rebuilt by v8 (individual quality); fictional ones only move with their club.
 for(const p of after){const o=before.find(x=>x.id===p.id);if(o.fictional)for(const k of Object.keys(o.attributes))assert.ok(Math.abs(p.attributes[k]-o.attributes[k])<=6,`${p.id} ${k}`);assert.equal(p.fitness,o.fitness);if(o.ageKnown)assert.equal(p.age,o.age);}
 for(const c of m.clubs)assert.deepEqual(c.lineup,old.clubs.find(x=>x.id===c.id).lineup);
 assert.equal(migrateWorld(m,catalog,returns),m);
});
test('squad levelling removes the seed bias: every XV sits where its club strength puts it',()=>{
 for(const seed of [7,2026]){
  const w=initialWorld(catalog,seed,returns,youth,names);
  // Clubs with internationals keep part of their pedigree floors on top of the club level (PEDIGREE_SHARE).
  for(const c of w.clubs.filter(c=>!c.players.some(p=>catalog.players.find(r=>r.id===p.sourceRecordId)?.quality?.floor))){
   const xv=E.autoLineup(c).map(id=>c.players.find(p=>p.id===id));
   const expected=E.POSITIONS.reduce((n,pos)=>n+E.expectedOverall(pos,c.strength+E.seniorSquadAdjustment('Primera')),0)/15;
   const actual=xv.reduce((n,p)=>n+E.overall(p),0)/15;
   assert.ok(Math.abs(actual-expected)<.75,`${seed} ${c.id}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`);
  }
 }
});
test('v3 leagues are recalibrated once, keep results, lineups and the order inside each squad',()=>{
 const w=initialWorld(catalog,11,returns,youth,names);w.dataVersion=3;w.fixtures[0].match={homeScore:20,awayScore:17};
 const old=structuredClone(w),m=migrateWorld(w,catalog,returns);
 assert.equal(m.dataVersion,DATA_VERSION);assert.match(m.migrationNotice,/recalibrado/);assert.deepEqual(m.fixtures,old.fixtures);assert.deepEqual(w,old);
 assert.equal(migrateWorld(m,catalog,returns),m);
});
test('trajectory labels and career stages: age wins, incomplete history gives no stage',()=>{
 const t=(seasons,complete=true,age=null)=>({age,trajectory:{seasons,complete,firstSeason:2019}});
 assert.deepEqual([1,2,3,4,5,6,7,9].map(n=>trajectoryLabel(t(n))),['Debutante','Joven','Joven','Jugador de Primera','Jugador de Primera','Experimentado','Veterano','Veterano']);
 assert.deepEqual([1,3,5,6,7].map(n=>careerStage(t(n))),['rising','growing','prime','steady','declining']);
 // Unknown seasons only make the history incomplete when they could change the label.
 assert.equal(trajectoryComplete({seasons:4,unknownSeasons:1}),true);assert.equal(trajectoryComplete({seasons:3,unknownSeasons:1}),false);assert.equal(trajectoryComplete({seasons:7,unknownSeasons:2}),true);
 assert.equal(trajectoryLabel(t(2,false)),'Historial incompleto');assert.equal(careerStage(t(2,false)),null);
 assert.equal(careerStage(t(1,true,34)),'declining');assert.equal(careerStage(t(9,true,21)),'rising');
 assert.equal(careerStage({age:null,trajectory:null}),null);
 const w=initialWorld(catalog,5,returns,youth,names),all=w.clubs.flatMap(c=>c.players.filter(p=>!p.fictional));
 assert.ok(all.filter(p=>p.trajectory).length>300);
 for(const p of all.filter(p=>p.trajectory)){const r=catalog.players.find(x=>x.id===p.sourceRecordId);assert.equal(p.trajectory.seasons,r.trajectory.seasons,p.id);assert.equal(p.trajectory.complete,r.trajectory.complete,p.id);}
 assert.ok(all.some(p=>p.trajectory?.primeraASeasons>0),'Primera A seasons count');
});
test('a season rollover adds a Primera season and veterans lose pace, acceleration and stamina',async()=>{
 const {advanceSeasonWorld}=await import('../web/domain.js');
 const w=initialWorld(catalog,6,returns,youth,names);
 const vet=w.clubs.flatMap(c=>c.players).find(p=>!p.fictional&&p.age==null&&careerStage(p)==='declining');assert.ok(vet,'needs a veteran without age');
 w.fixtures=w.fixtures.map(f=>({...f,match:{homeScore:0,awayScore:0,homeTries:0,awayTries:0}}));
 const after=advanceSeasonWorld(w).clubs.flatMap(c=>c.players).find(p=>p.id===vet.id);
 assert.equal(after.trajectory.seasons,vet.trajectory.seasons+1);
 for(const a of ['pace','acceleration','stamina'])assert.equal(after.attributes[a],Math.max(1,vet.attributes[a]-1));
 assert.equal(after.attributes.passing,vet.attributes.passing);
});
test('v4 leagues gain trajectories; fictional players keep their level',()=>{
 const w=initialWorld(catalog,12,returns,youth,names);w.dataVersion=4;
 for(const c of w.clubs)for(const p of c.players)delete p.trajectory;
 const old=structuredClone(w),m=migrateWorld(w,catalog,returns);
 assert.equal(m.dataVersion,DATA_VERSION);assert.match(m.migrationNotice,/trayectoria/);assert.deepEqual(w,old);
 assert.ok(m.clubs.flatMap(c=>c.players).some(p=>p.trajectory));
 for(const c of m.clubs)for(const p of c.players.filter(p=>p.fictional)){const o=old.clubs.find(x=>x.id===c.id).players.find(x=>x.id===p.id);for(const k of Object.keys(o.attributes))assert.ok(Math.abs(p.attributes[k]-o.attributes[k])<=5,`${p.id} ${k}`);}
});
test('v6 leagues get the 2019+ trajectory and keep seasons earned in-game',()=>{
 const w=initialWorld(catalog,13,returns,youth,names);w.dataVersion=6;w.season=2028;
 const p=w.clubs.flatMap(c=>c.players).find(x=>x.trajectory&&catalog.players.find(r=>r.id===x.sourceRecordId)?.trajectory?.officialSeasons>0);
 const r=catalog.players.find(x=>x.id===p.sourceRecordId);
 p.trajectory={seasons:12,firstSeason:2016,complete:true,officialSeasons:0,pressSeasons:0};// v6 shape, two seasons played in-game
 const old=structuredClone(w),m=migrateWorld(w,catalog,returns),q=m.clubs.flatMap(c=>c.players).find(x=>x.id===p.id);
 assert.deepEqual(w,old);assert.match(m.migrationNotice,/desde 2019/);
 assert.equal(q.trajectory.seasons,r.trajectory.seasons+2);assert.equal(q.trajectory.gameSeasons,2);assert.equal(q.trajectory.officialSeasons,r.trajectory.officialSeasons);
 assert.equal(migrateWorld(m,catalog,returns),m);
});
test('community contributions never override a documented birth date and are idempotent',async()=>{
 const {applyCommunity,validateContribution}=await import('../web/domain.js');
 const w=initialWorld(catalog,21,returns,youth,names),all=w.clubs.flatMap(c=>c.players);
 const known=all.find(p=>!p.fictional&&p.ageKnown),now=new Date('2026-11-11T00:00:00Z');
 const list=[{...validateContribution({playerId:known.sourceRecordId,type:'age',value:40},now),at:1}];
 const m=applyCommunity(w,list),k=m.clubs.flatMap(c=>c.players).find(p=>p.id===known.id);
 assert.equal(k.age,known.age);assert.equal(k.ageKnown,true);
 assert.equal(applyCommunity(m,list),m);assert.equal(applyCommunity(w,[]),w);
 assert.throws(()=>validateContribution({playerId:'x',type:'position',value:'Arquero'}));
 // A corrected position keeps the level: the profile is rebuilt for the new role.
 const ten=all.find(p=>!p.fictional&&p.position==='Apertura'),moved=applyCommunity(w,[{...validateContribution({playerId:ten.sourceRecordId,type:'position',value:'Wing'},now),at:2}]).clubs.flatMap(c=>c.players).find(p=>p.id===ten.id);
 assert.equal(moved.position,'Wing');assert.ok(Math.abs(E.overall(moved)-E.overall(ten))<=1,`${E.overall(ten)} → ${E.overall(moved)}`);
 assert.equal(validateContribution({playerId:'x',type:'age',value:24},now).value,'2002-07-01');
});
