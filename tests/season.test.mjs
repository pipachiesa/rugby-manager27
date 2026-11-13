import {test} from 'node:test';import assert from 'node:assert/strict';import * as E from '../web/engine.js';
test('complete 26-round season records 546 matches and consistent final event scores',()=>{
 let state=E.createInitialState(2026);assert.equal(state.fixtures.length,546);
 for(let round=1;round<=26;round++){
  state=E.autoPlayRound(state);
  assert.equal(state.fixtures.filter(f=>f.match).length,round*21);
 }
 for(const f of state.fixtures){const m=f.match;assert.ok(m);const last=m.events.at(-1);assert.equal(last.type,'fullTime');assert.equal(last.homeScore,m.homeScore);assert.equal(last.awayScore,m.awayScore);}
 for(const division of ['Top 14','Primera A','Primera B'])assert.ok(E.getStandings(state,division).every(row=>row.played===26));
 const next=E.advanceSeason(state);assert.equal(next.season,state.season+1);assert.equal(next.fixtures.length,546);assert.ok(next.fixtures.every(f=>!f.match));
});
test('injuries: realistic frequency, deterministic, and injured players never play',async()=>{
 const {readFile}=await import('node:fs/promises');const {initialWorld,advanceWorld}=await import('../web/domain.js');const E=await import('../web/engine.js');const {mergeResearch}=await import('../scripts/merge-research.mjs');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const returns=await j('research/returns.json');
 const catalog=mergeResearch(await j('research/catalog.json'),await j('research/age-verification.json'),returns);
 const run=async()=>{let w=initialWorld(catalog,11,returns,await j('research/youth.json'),await j('research/names.json'));const out=[];
  for(let i=0;i<13;i++){const injured=new Set(w.clubs.flatMap(c=>c.players.filter(p=>p.injury).map(p=>p.id)));w=advanceWorld(w);
   for(const f of w.fixtures.filter(f=>f.round===i+1))for(const id of [...f.match.homeLineup,...f.match.awayLineup])assert.ok(!injured.has(id),`${id} played injured in round ${i+1}`);
   out.push(w.clubs.map(c=>c.players.filter(p=>p.injury&&p.squad==='Plantel superior').length));}
  return {w,out};};
 const a=await run(),b=await run();
 assert.deepEqual(a.out,b.out,'same seed, same injuries');
 const perClub=a.w.news.filter(n=>n.kind==='injury').length/a.w.clubs.length*2;// half a season
 assert.ok(perClub>8&&perClub<30,`injuries per club-season ${perClub}`);
 const flat=a.out.flat();assert.ok(flat.reduce((x,y)=>x+y,0)/flat.length<5,'average injured at a time');
 const c=a.w.clubs.find(c=>c.players.some(p=>p.injury&&p.squad==='Plantel superior'));const hurt=c.players.find(p=>p.injury&&p.squad==='Plantel superior');
 const ids=E.autoLineup({players:c.players.map(p=>p.id===hurt.id?{...p,injury:null}:p)});
 if(ids.includes(hurt.id))assert.throws(()=>E.setLineup(a.w,c.id,ids),/no elegible/);
});
test('parallel tournaments: every category plays each round, standings add up, deterministic and backfilled on migration',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const returns=await j('research/returns.json');
 const catalog=await j('research/catalog.json'),youth=await j('research/youth.json'),names=await j('research/names.json');
 const play=n=>{let w=D.initialWorld(catalog,21,returns,youth,names);for(let i=0;i<n;i++)w=D.advanceWorld(w);return w;};
 const w=play(3),again=play(3);
 assert.deepEqual(w.parallel.results,again.parallel.results,'same seed, same results');
 const played=w.fixtures.filter(f=>f.match);assert.equal(Object.keys(w.parallel.results).length,played.length);
 for(const f of played)for(const cat of D.PARALLEL_CATEGORIES){const r=w.parallel.results[f.id][cat];assert.equal(r.length,4);assert.ok(r[0]>=r[2]*5&&r[1]>=r[3]*5,`${f.id} ${cat}`);}
 for(const cat of D.PARALLEL_CATEGORIES)for(const division of Object.values(D.DIVISIONS)){const rows=D.parallelStandings(w,division,cat);assert.ok(rows.every(r=>r.played===3));assert.equal(rows.reduce((n,r)=>n+r.pointsFor,0),rows.reduce((n,r)=>n+r.pointsAgainst,0));}
 assert.ok(D.parallelStandings(w,'Top 14','M19',2).every(r=>r.played===1),'results hidden from a round on');
 for(const c of w.clubs)for(const g of ['Primera','Intermedia','Pre A','Pre B'])assert.ok(c.players.some(p=>p.squad==='Plantel superior'&&p.seniorSquad===g),`${c.id} ${g}`);
 // A league saved before v10: played rounds get their results, Primera results stay.
 const old={...w,dataVersion:9,parallel:undefined};const m=D.migrateWorld(old,catalog,returns);
 assert.equal(Object.keys(m.parallel.results).length,played.length);assert.deepEqual(m.fixtures,w.fixtures);assert.match(m.migrationNotice,/Intermedia/);
 const next=D.advanceSeasonWorld((()=>{let x=w;while(x.fixtures.some(f=>!f.match))x=D.advanceWorld(x);return x;})());
 assert.deepEqual(next.parallel.results,{});assert.equal(next.parallel.champions.length,15);
});
test('tactics action validates mentality and penalty choice and fills them for older clients',async()=>{
 const E=await import('../web/engine.js');const {applyClubAction}=await import('../web/domain.js');
 const s=E.createInitialState(5),id=s.clubs[0].id,{mentality,penalty,...legacy}=E.DEFAULT_TACTICS;
 assert.deepEqual(applyClubAction(s,id,'tactics',{tactics:legacy}).tactics[id],E.DEFAULT_TACTICS);
 assert.equal(applyClubAction(s,id,'tactics',{tactics:{...legacy,mentality:'Ofensiva',penalty:'Touch'}}).tactics[id].penalty,'Touch');
 assert.throws(()=>applyClubAction(s,id,'tactics',{tactics:{...E.DEFAULT_TACTICS,mentality:'Kamikaze'}}),/no válida/);
 assert.throws(()=>applyClubAction(s,id,'tactics',{tactics:{...E.DEFAULT_TACTICS,extra:1,penalty:'Drop'}}),/no válida/);
});
test('youth plan: validated, saved per club, juniors grow toward their potential and never past it',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const E=await import('../web/engine.js');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));
 let w=D.initialWorld(await j('research/catalog.json'),33,await j('research/returns.json'),await j('research/youth.json'),await j('research/names.json'));
 const id=w.clubs[0].id;
 assert.throws(()=>D.applyClubAction(w,id,'youth-training',{plan:'Magia'}),/no válido/);
 w=D.applyClubAction(w,id,'youth-training',{plan:'Contacto'});assert.equal(w.youthTraining[id],'Contacto');
 const juniors=c=>c.players.filter(p=>p.squad==='M19'||p.squad==='M17');
 const before=new Map(w.clubs.flatMap(c=>juniors(c).map(p=>[p.id,p])));
 for(let i=0;i<10;i++)w=D.advanceWorld(w);
 let grew=0;for(const c of w.clubs)for(const p of juniors(c)){const o=before.get(p.id);if(!o)continue;
  for(const [k,v] of Object.entries(p.attributes)){assert.ok(v>=o.attributes[k]);if(v>o.attributes[k])assert.ok(v<=p.potential,`${p.id} ${k} past potential`);}
  if(E.overall(p)>E.overall(o))grew++;}
 assert.ok(grew>before.size*.4,`juniors improved: ${grew}/${before.size}`);
 // Contacto only touches its own attributes.
 for(const p of juniors(w.clubs[0])){const o=before.get(p.id);for(const k of Object.keys(p.attributes))if(p.attributes[k]!==o.attributes[k])assert.ok(D.YOUTH_PLANS.Contacto.attrs.includes(k),k);}
});
test('position retraining: plausible moves only, progresses weekly, injured players wait, then the player can be picked there',async()=>{
 const E=await import('../web/engine.js');const D=await import('../web/domain.js');
 let s=E.createInitialState(41);s.news=[];const club=s.clubs[0];
 const prop=club.players.find(p=>p.squad==='Plantel superior'&&p.position==='Pilar izquierdo'&&!p.positions);
 assert.ok(!D.retrainOptions(prop).some(o=>o.to==='Apertura'),'never a prop to 10');
 assert.throws(()=>D.applyClubAction(s,club.id,'retrain',{playerId:prop.id,to:'Apertura'}),/no es posible/);
 s=D.applyClubAction(s,club.id,'retrain',{playerId:prop.id,to:'Pilar derecho'});
 assert.throws(()=>D.applyClubAction(s,club.id,'retrain',{playerId:prop.id,to:'Hooker'}),/otro puesto/);
 const others=club.players.filter(p=>p.squad==='Plantel superior'&&p.id!==prop.id&&D.retrainOptions(p).length).slice(0,3);
 s=D.applyClubAction(s,club.id,'retrain',{playerId:others[0].id,to:D.retrainOptions(others[0])[0].to});
 s=D.applyClubAction(s,club.id,'retrain',{playerId:others[1].id,to:D.retrainOptions(others[1])[0].to});
 assert.throws(()=>D.applyClubAction(s,club.id,'retrain',{playerId:others[2].id,to:D.retrainOptions(others[2])[0].to}),/hasta 3/);
 // Injured: no progress that week.
 s={...s,clubs:s.clubs.map(c=>c.id!==club.id?c:{...c,players:c.players.map(p=>p.id===prop.id?{...p,injury:{type:'x',name:'X',weeksOut:1,since:0,season:s.season}}:p)})};
 s=D.advanceWorld(s);let p=s.clubs[0].players.find(x=>x.id===prop.id);assert.equal(p.retraining.weeksLeft,6);
 for(let i=0;i<6;i++)s=D.advanceWorld(s);
 p=s.clubs[0].players.find(x=>x.id===prop.id);
 if(p.injury)return;// a new injury on the way only delays it
 assert.equal(p.retraining,null);assert.ok(E.canPlay(p,'Pilar derecho'));assert.ok(s.news.some(n=>n.kind==='training'&&n.playerId===prop.id));
 assert.equal(D.applyClubAction(s,club.id,'cancel-retrain',{playerId:others[0].id}).clubs[0].players.find(x=>x.id===others[0].id).retraining??null,null);
});
test('no fictional player carries the name of a documented player or of a club-mate',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const catalog=await j('research/catalog.json');
 const w=D.initialWorld(catalog,7,await j('research/returns.json'),await j('research/youth.json'),await j('research/names.json'));
 const n=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();const real=new Set(catalog.players.map(p=>n(p.name)));
 for(const c of w.clubs){const seen=new Set();for(const p of c.players){assert.ok(!seen.has(n(p.name)),`${c.id} ${p.name} twice`);seen.add(n(p.name));if(p.fictional)assert.ok(!real.has(n(p.name)),`${p.name} fictional with a real name`);}}
 const old={...w,dataVersion:10,clubs:w.clubs.map(c=>({...c,players:c.players.map((p,i)=>p.fictional&&i===40?{...p,name:c.players.find(q=>!q.fictional)?.name??p.name}:p)}))};
 const m=D.migrateWorld(old,catalog);for(const c of m.clubs)assert.equal(new Set(c.players.map(p=>n(p.name))).size,c.players.length,c.id);
});
test('only managed clubs keep full replays; others keep the result and scoring events',async()=>{
 const E=await import('../web/engine.js');const D=await import('../web/domain.js');
 let s=E.createInitialState(51);s.news=[];const mine=s.clubs[0].id;
 s=D.advanceWorld(s,new Set([mine]));
 const played=s.fixtures.filter(f=>f.match);const own=played.find(f=>f.homeId===mine||f.awayId===mine),other=played.find(f=>f.homeId!==mine&&f.awayId!==mine);
 assert.ok(D.hasReplay(own)&&!D.hasReplay(other));
 assert.ok(E.regenerateReplay(s,own.id).frames.length>0);
 const pts=e=>e.reduce((n,x)=>n+(x.points??0),0);assert.equal(pts(other.match.events),other.match.homeScore+other.match.awayScore);
 assert.deepEqual(E.getStandings(s,other.division).map(r=>r.points).sort(),E.getStandings(D.slimMatches(s,undefined),other.division).map(r=>r.points).sort());
 assert.ok(JSON.stringify(other).length<JSON.stringify(own).length/4);
 assert.deepEqual(D.slimMatches(s,new Set([mine])),s,'idempotent');
});
test('between seasons veterans retire and surplus fictional seniors leave, keeping cover in every position',async()=>{
 const E=await import('../web/engine.js');const D=await import('../web/domain.js');
 let s=E.createInitialState(61);s.news=[];
 const c0=s.clubs[0];const extra=Array.from({length:12},(_,i)=>({...c0.players.find(p=>p.squad==='Plantel superior'),id:`extra-${i}`,name:`Extra ${i}`,age:24}));
 s={...s,clubs:s.clubs.map((c,i)=>i===0?{...c,players:[...c.players.map((p,j)=>j===0?{...p,age:38}:p),...extra]}:c),fixtures:s.fixtures.map(f=>({...f,match:{homeScore:10,awayScore:5,homeTries:1,awayTries:1,events:[]}}))};
 const n=D.advanceSeasonWorld(s);const c=n.clubs[0],seniors=c.players.filter(p=>p.squad==='Plantel superior');
 assert.ok(seniors.length<=66,`${seniors.length} seniors`);
 // Releases never cut below four per position; a retirement can leave three until the next intake.
 for(const pos of E.POSITIONS)assert.ok(seniors.filter(p=>E.canPlay(p,pos)).length>=3,pos);
 assert.ok(n.news.some(x=>x.kind==='squad'));
});
test('v12 raises Primera A/B clubs by the baseline change, keeping each player relative to his club-mates',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const E=await import('../web/engine.js');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const catalog=await j('research/catalog.json');
 const w=D.initialWorld(catalog,9,await j('research/returns.json'),await j('research/youth.json'),await j('research/names.json'));
 // Clubs the 12/11 strength refit (v15) does not move, so only v12 acts on them.
 const id='hurling',top='los-tilos';
 // A league saved with the old Primera A baseline (9.8): strength .35 lower, attributes one point lower.
 const old={...w,dataVersion:11,clubs:w.clubs.map(c=>c.id!==id?c:{...c,strength:c.strength-.35,players:c.players.map(p=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,Math.max(1,v-1)]))}))})};
 const m=D.migrateWorld(old,catalog);const before=old.clubs.find(c=>c.id===id),after=m.clubs.find(c=>c.id===id);
 assert.ok(Math.abs(after.strength-w.clubs.find(c=>c.id===id).strength)<1e-9);
 const diffs=after.players.flatMap((p,i)=>Object.keys(p.attributes).map(k=>p.attributes[k]-before.players[i].attributes[k]));
 assert.ok(diffs.every(d=>d===0||d===1));const mean=diffs.reduce((a,b)=>a+b,0)/diffs.length;assert.ok(mean>.25&&mean<.45,`${mean}`);
 const attrsOf=(x,id)=>x.clubs.find(c=>c.id===id).players.map(p=>[p.id,p.attributes]);assert.deepEqual(attrsOf(m,top),attrsOf(w,top),'Top 14 untouched');
 assert.match(m.migrationNotice,/Primera A y B/);
});
test('local market: nearby reserves are keen, starters are not, one contact a round, managed clubs are off limits; training tires',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const {mergeResearch,addClubExtras}=await import('../scripts/merge-research.mjs');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const returns=await j('research/returns.json');
 const catalog=await addClubExtras(mergeResearch(await j('research/catalog.json'),await j('research/age-verification.json'),returns),readFile);
 let w=D.initialWorld(catalog,5,returns,await j('research/youth.json'),await j('research/names.json'));
 const me='regatas-bella-vista';assert.ok(D.clubDistance(w,me,'newman')<40,'grounds loaded');
 const list=D.marketPlayers(w,me);
 const avg=r=>{const xs=list.filter(x=>x.now===r);return xs.reduce((n,x)=>n+x.chance,0)/xs.length;};
 assert.ok(avg('Pre B')>avg('XV')*2,`Pre B ${avg('Pre B')} vs XV ${avg('XV')}`);
 const near=list.filter(x=>x.distance!==null&&x.distance<=20),far=list.filter(x=>x.distance>60);
 assert.ok(near.reduce((n,x)=>n+x.chance,0)/near.length>far.reduce((n,x)=>n+x.chance,0)/far.length);
 const reserve=list.find(x=>x.now==='Pre B'&&x.then!=='XV'&&x.distance!==null&&x.distance<30);
 if(reserve){const base=D.transferInterest(w,me,reserve.clubId,reserve.player).chance,xv=D.transferInterest(w,me,reserve.clubId,reserve.player,'XV').chance,low=D.transferInterest(w,me,reserve.clubId,reserve.player,'Pre A').chance;
  assert.ok(xv>base&&base>=low,`offer XV ${xv} > fair ${base} >= Pre A ${low}`);}
 const target=[...list].sort((a,b)=>b.chance-a.chance)[0];
 const after=D.applyClubAction(w,me,'contact-player',{playerId:target.player.id});
 const joined=after.clubs.find(c=>c.id===me).players.some(p=>p.id===target.player.id);
 const left=after.clubs.find(c=>c.id===target.clubId).players.some(p=>p.id===target.player.id);
 assert.equal(joined,!left,'player is in exactly one club');assert.ok(after.news.some(n=>n.kind==='transfer'&&n.clubId===me));
 assert.throws(()=>D.applyClubAction(after,me,'contact-player',{playerId:list[1].player.id}),/Ya hiciste un contacto/);
 assert.throws(()=>D.applyClubAction({...w,managedClubs:[me,target.clubId]},me,'contact-player',{playerId:target.player.id}),/tiene manager/);
 assert.ok(!D.marketPlayers({...w,managedClubs:[me,'casi']},me).some(x=>x.clubId==='casi'));
 const club=w.clubs.find(c=>c.id===me),p=club.players.find(p=>p.squad==='Plantel superior'&&Object.values(p.attributes).some(v=>v<p.potential));
 const attr=Object.keys(p.attributes).find(k=>p.attributes[k]<p.potential);
 const training=D.applyClubAction(w,me,'train-player',{playerId:p.id,attribute:attr});
 const trained=training.clubs.find(c=>c.id===me).players.find(q=>q.id===p.id);
 assert.throws(()=>D.applyClubAction(training,me,'train-player',{playerId:p.id,attribute:attr}),/ya entrenó/);
 assert.equal(trained.fitness,Math.max(35,p.fitness-D.TRAINING_FATIGUE));assert.ok([p.attributes[attr],p.attributes[attr]+1].includes(trained.attributes[attr]),'training is an attempt, not guaranteed growth');
 const obj=D.clubObjective(w,'newman');assert.equal(obj.level,'Máxima');assert.equal(D.clubObjective(w,'champagnat').level,'Baja');
});
test('community editor: name and stats comments; a suggested level nudges the rating once',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const {mergeResearch}=await import('../scripts/merge-research.mjs');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const returns=await j('research/returns.json');
 const catalog=mergeResearch(await j('research/catalog.json'),await j('research/age-verification.json'),returns);
 const w=D.initialWorld(catalog,3,returns,await j('research/youth.json'),await j('research/names.json'));
 const p=w.clubs.flatMap(c=>c.players).find(p=>!p.fictional&&p.sourceRecordId&&p.squad==='Plantel superior');
 assert.throws(()=>D.validateContribution({type:'name',playerId:p.sourceRecordId,value:'X'}),/nombre y apellido/);
 assert.throws(()=>D.validateContribution({type:'stats',playerId:p.sourceRecordId,value:{text:'',level:120}}),/30 a 95/);
 const at=1;const list=[{...D.validateContribution({type:'name',playerId:p.sourceRecordId,value:'Juan  Pérez Test'}),at},
  {...D.validateContribution({type:'stats',playerId:p.sourceRecordId,value:{text:'Gran pateador',level:Math.min(95,D.overall(p)+20)}}),at}];
 const once=D.applyCommunity(w,list),q=once.clubs.flatMap(c=>c.players).find(x=>x.id===p.id);
 assert.equal(q.name,'Juan Pérez Test');assert.deepEqual(q.community.comments,['Gran pateador']);assert.ok(D.overall(q)>D.overall(p),'rating moves up');
 const twice=D.applyCommunity(once,list);assert.equal(D.overall(twice.clubs.flatMap(c=>c.players).find(x=>x.id===p.id)),D.overall(q),'applied once');
});
test('URBA playoffs: semis 1v4 and 2v3 at the better-placed ground, neutral final, promotion and relegation by the rules',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const E=await import('../web/engine.js');const {mergeResearch}=await import('../scripts/merge-research.mjs');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const returns=await j('research/returns.json');
 const catalog=mergeResearch(await j('research/catalog.json'),await j('research/age-verification.json'),returns);
 let w=D.initialWorld(catalog,9,returns,await j('research/youth.json'),await j('research/names.json'));
 while(Number.isFinite(D.roundOf(w)))w=D.advanceWorld(w);
 for(const division of ['Top 14','Primera A','Primera B']){
  const st=D.playoffState(w,division),seeds=st.seeds;
  assert.equal(st.semis.length,2);assert.deepEqual(st.semis.map(f=>[f.homeId,f.awayId]),[[seeds[0],seeds[3]],[seeds[1],seeds[2]]]);
  assert.ok(st.final?.match&&st.final.neutral,'final played at a neutral ground');assert.ok(seeds.includes(st.winner));
  assert.ok(E.getStandings(w,division).every(r=>r.played===26),'playoffs do not count in the table');
  if(division!=='Top 14')assert.equal(seeds[0],st.table[1].clubId,'2nd–5th play for promotion');
 }
 const top=D.playoffState(w,'Top 14'),a=D.playoffState(w,'Primera A'),b=D.playoffState(w,'Primera B');
 const next=D.advanceSeasonWorld(w),div=id=>next.clubs.find(c=>c.id===id).division;
 for(const r of top.table.slice(-2))assert.equal(div(r.clubId),'Primera A');
 assert.equal(div(a.table[0].clubId),'Top 14');assert.equal(div(a.winner),'Top 14');
 for(const r of a.table.slice(-2))assert.equal(div(r.clubId),'Primera B');
 assert.equal(div(b.table[0].clubId),'Primera A');assert.equal(div(b.winner),'Primera A');
 for(const d of ['Top 14','Primera A','Primera B'])assert.equal(next.clubs.filter(c=>c.division===d).length,14);
 assert.equal(next.honours.find(h=>h.division==='Top 14'&&h.season===w.season).clubId,top.winner,'the final winner is the URBA champion');
 assert.ok(next.fixtures.every(f=>!f.stage&&!f.match));
});

test('v15 shifts refitted clubs by the strength change and leaves the rest alone',async()=>{
 const {readFile}=await import('node:fs/promises');const D=await import('../web/domain.js');const E=await import('../web/engine.js');
 const j=async p=>JSON.parse(await readFile(p,'utf8'));const catalog=await j('research/catalog.json');
 const w=D.initialWorld(catalog,4,await j('research/returns.json'),await j('research/youth.json'),await j('research/names.json'));
 const m=D.migrateWorld({...w,dataVersion:14},catalog),xv=(world,id)=>{const c=world.clubs.find(c=>c.id===id);return E.effectiveLineup(c).map(i=>c.players.find(p=>p.id===i)).reduce((n,p)=>n+E.overall(p),0)/15;};
 assert.ok(xv(m,'newman')>xv(w,'newman')+1,'Newman goes up');assert.ok(xv(m,'belgrano-athletic')<xv(w,'belgrano-athletic')-1,'Belgrano goes down');
 assert.deepEqual(m.clubs.find(c=>c.id==='los-tilos').players.map(p=>[p.id,p.attributes]),w.clubs.find(c=>c.id==='los-tilos').players.map(p=>[p.id,p.attributes]));
 assert.match(m.migrationNotice,/fuerza de los clubes/);
});
