// Auditoría de integridad sobre una partida larga: 6 temporadas seguidas, con ida y vuelta por JSON en cada fecha,
// migrateWorld cada temporada y acciones de manager en 3 clubes.
// Uso:  node scripts/playtest/rules-audit.mjs            (3 semillas en paralelo, escribe research/playtest/rules-audit-data.json)
//       node scripts/playtest/rules-audit.mjs --seed 101 [--seasons 6] [--out archivo.json]
// Requiere `npm run build` (web/engine.js).
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(ROOT);
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};

if(!arg('seed')){
 const seeds=(arg('seeds','101,202,303')).split(',');
 await mkdir('research/playtest',{recursive:true});
 const runs=await Promise.all(seeds.map(seed=>new Promise((res,rej)=>{
  const out=`/tmp/rules-audit-${seed}.json`;
  const c=spawn(process.execPath,['--max-old-space-size=6000',fileURLToPath(import.meta.url),'--seed',seed,'--seasons',arg('seasons','6'),'--out',out],{stdio:['ignore','inherit','inherit']});
  c.on('exit',code=>code===0?readFile(out,'utf8').then(t=>res(JSON.parse(t)),rej):rej(Error('seed '+seed+' salió con '+code)));
 })));
 await writeFile('research/playtest/rules-audit-data.json',JSON.stringify(runs,null,1));
 console.log('listo: research/playtest/rules-audit-data.json');
 process.exit(0);
}

const D=await import(ROOT+'/web/domain.js');
const E=await import(ROOT+'/web/engine.js');
const Stats=await import(ROOT+'/web/player-stats.js');
const {mergeResearch,addClubExtras}=await import(ROOT+'/scripts/merge-research.mjs');
const j=async p=>JSON.parse(await readFile(p,'utf8'));
const returns=await j('research/returns.json');
const catalog=await addClubExtras(mergeResearch(await j('research/catalog.json'),await j('research/age-verification.json'),returns),readFile);
const youth=await j('research/youth.json'),names=await j('research/names.json');

const SEED=Number(arg('seed')),SEASONS=Number(arg('seasons','6'));
const KEEP=['regatas-bella-vista','lomas-athletic','delta'];
const keep=new Set(KEEP);
const ATTRS=Object.keys(E.ATTRIBUTE_LABELS);
const DIVS=['Top 14','Primera A','Primera B'];
const POS=E.POSITIONS;

// ---------- violaciones ----------
const violations=new Map();
let ctx={season:null,round:null};
function bad(sev,code,msg,fn){
 const key=sev+'|'+code;let v=violations.get(key);
 if(!v){v={sev,code,fn,count:0,first:{seed:SEED,season:ctx.season,round:ctx.round,msg}};violations.set(key,v);}
 v.count++;
}
const ok=(cond,sev,code,msg,fn)=>{if(!cond)bad(sev,code,typeof msg==='function'?msg():msg,fn);return cond;};
const rt=w=>JSON.parse(JSON.stringify(w));
const jsonSize=w=>Buffer.byteLength(JSON.stringify(w));
const md5=s=>createHash('md5').update(s).digest('hex');
const mb=n=>Math.round(n/1e4)/100;
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;

function deepNonFinite(o,pth='',out=[],depth=0){
 if(out.length>5||depth>12)return out;
 if(typeof o==='number'){if(!Number.isFinite(o))out.push(pth);return out;}
 if(o&&typeof o==='object'){
  if(Array.isArray(o)){for(let i=0;i<o.length&&out.length<=5;i++)deepNonFinite(o[i],pth+'['+i+']',out,depth+1);}
  else for(const k of Object.keys(o)){deepNonFinite(o[k],pth+'.'+k,out,depth+1);if(out.length>5)break;}
 }

 return out;
}

// ---------- estado del informe ----------
const report={seed:SEED,managed:KEEP,seasons:[],notes:[],timing:[]};
let world;

// ---------- invariantes de jugadores ----------
function checkPlayers(w,where){
 const seen=new Map();
 for(const c of w.clubs)for(const p of c.players){
  if(seen.has(p.id))ok(false,'broken','id-duplicado-entre-clubes',`${p.id} en ${seen.get(p.id)} y ${c.id} (${where})`,'initialWorld/advanceSeason/contactPlayer');
  seen.set(p.id,c.id);
  const a=p.attributes;
  if(!a){bad('broken','sin-atributos',`${p.id}`,'—');continue;}
  for(const k of ATTRS){const v=a[k];
   if(!Number.isFinite(v))ok(false,'broken','atributo-NaN-undefined',`${p.id}.${k}=${v} (${where})`,'developPlayer/migrate');
   else if(v<1||v>20)ok(false,'broken','atributo-fuera-de-1-20',`${p.id}.${k}=${v} (${where})`,'developPlayer/developYouth');
   else if(!Number.isInteger(v))ok(false,'suspicious','atributo-no-entero',`${p.id}.${k}=${v} (${where})`,'developPlayer');}
  if(Object.keys(a).length!==ATTRS.length)ok(false,'broken','cantidad-de-atributos',`${p.id} tiene ${Object.keys(a).length}`,'—');
  if(!Number.isFinite(p.potential))ok(false,'broken','potencial-invalido',`${p.id} potential=${p.potential}`,'—');
  if(!Number.isFinite(p.fitness)||p.fitness<0||p.fitness>100)ok(false,'broken','fitness-fuera-de-0-100',`${p.id} fitness=${p.fitness}`,'simulateFixture/trainPlayer');
  if(p.age!==null&&p.age!==undefined&&(!Number.isFinite(p.age)||p.age<10||p.age>50))ok(false,'broken','edad-invalida',`${p.id} age=${p.age}`,'ageFields/advanceSeason');
  if(!E.POSITIONS.includes(p.position))ok(false,'broken','puesto-invalido',`${p.id} ${p.position}`,'—');
  if(p.injury&&!(p.injury.weeksOut>0))ok(false,'broken','lesion-sin-semanas',`${p.id} ${JSON.stringify(p.injury)}`,'applyInjuries');
  if(!['Plantel superior','M19','M17'].includes(p.squad))ok(false,'broken','categoria-invalida',`${p.id} ${p.squad}`,'—');
  if(p.squad==='Plantel superior'&&!['Primera','Intermedia','Pre A','Pre B'].includes(p.seniorSquad))ok(false,'suspicious','seniorSquad-invalido',`${p.id} ${p.seniorSquad}`,'assignSeniorGroups');
 }
 for(const oc of w.overseasCareers??[])if(oc.status==='abroad'&&seen.has(oc.player.id))ok(false,'broken','jugador-en-el-exterior-y-en-un-club',`${oc.player.id} en ${seen.get(oc.player.id)}`,'advanceSeason/overseasMove');
 return seen;
}
function checkXV(w,where){
 for(const c of w.clubs){
  const xv=E.effectiveLineup(c);
  if(!ok(xv.length===15&&new Set(xv).size===15,'broken','xv-no-tiene-15-distintos',`${c.id} ${xv.length}/${new Set(xv).size} (${where})`,'effectiveLineup'))continue;
  xv.forEach((id,i)=>{const p=c.players.find(q=>q.id===id);
   ok(p&&p.squad==='Plantel superior'&&!p.injury,'broken','xv-lesionado-o-no-senior',`${c.id} ${id} lesión=${!!p?.injury} (${where})`,'effectiveLineup');
   ok(p&&E.canPlay(p,POS[i]),'broken','xv-fuera-de-puesto',`${c.id} dorsal ${i+1} ${POS[i]}: ${p?.name} (${p?.position}/${p?.positions}) (${where})`,'effectiveLineup/autoLineup');});
  if(c.lineup&&c.lineup.length===15){ // un lineup guardado inválido se debe ignorar sin lanzar
   ok(c.lineup.every(id=>c.players.some(p=>p.id===id)),'broken','lineup-guardado-con-jugador-ajeno',`${c.id} (${where})`,'setLineup/squadTurnover/transferencia');}
 }
}

// ---------- tamaños de plantel y categorías paralelas ----------
function squadStats(w){
 const per={};
 for(const c of w.clubs){
  const s=c.players.filter(p=>p.squad==='Plantel superior'),g=k=>s.filter(p=>p.seniorSquad===k).length;
  const row={senior:s.length,Primera:g('Primera'),Intermedia:g('Intermedia'),'Pre A':g('Pre A'),'Pre B':g('Pre B'),M19:c.players.filter(p=>p.squad==='M19').length,M17:c.players.filter(p=>p.squad==='M17').length,injured:c.players.filter(p=>p.injury).length};
  per[c.id]=row;
 }
 const agg={};
 for(const k of ['senior','Primera','Intermedia','Pre A','Pre B','M19','M17','injured']){const v=Object.values(per).map(r=>r[k]);agg[k]={min:Math.min(...v),max:Math.max(...v),mean:Math.round(mean(v)*10)/10};}
 return {per,agg};
}
function checkFieldable(w,where){
 // Cada categoría debe poder armar 15 con puesto (imita categoryTeams): se cuentan puestos sin nadie que los juegue.
 const res={noOne:0,outOfPos:0,teams:0,byCat:{}};
 for(const c of w.clubs){
  const seniors=c.players.filter(p=>p.squad==='Plantel superior'),by=g=>seniors.filter(p=>p.seniorSquad===g);
  const first=new Set(E.autoLineup(c));
  const plans={Intermedia:[[...by('Primera'),...by('Intermedia')],by('Pre A'),by('Pre B')],'Pre A':[by('Pre A'),by('Pre B'),by('Intermedia')],'Pre B':[by('Pre B'),seniors],M19:[c.players.filter(p=>p.squad==='M19')],M17:[c.players.filter(p=>p.squad==='M17')]};
  const used=new Set(first);
  for(const [cat,pools] of Object.entries(plans)){
   let no=0,oop=0;
   for(const pos of POS){
    let found=false;
    for(const pool of pools){const p=pool.filter(p=>!used.has(p.id)&&E.available(p)&&E.canPlay(p,pos)).sort((a,b)=>E.overall(b)-E.overall(a))[0];if(p){used.add(p.id);found=true;break;}}
    if(found)continue;
    const any=pools[0].filter(p=>!used.has(p.id)&&E.available(p))[0];
    if(any){used.add(any.id);oop++;}else no++;
   }
   res.teams++;res.noOne+=no;res.outOfPos+=oop;
   const b=res.byCat[cat]??={noOne:0,outOfPos:0,clubsWithGap:0};b.noOne+=no;b.outOfPos+=oop;if(no||oop)b.clubsWithGap++;
   if(no)ok(false,'suspicious','categoria-no-puede-armar-equipo',`${c.id} ${cat}: ${no} puestos sin jugador (${where})`,'categoryTeams/playParallelRound');
   const total=pools[0].length;
   if(total<15)ok(false,'suspicious','categoria-con-menos-de-15',`${c.id} ${cat}: grupo propio de ${total} (${where})`,'assignSeniorGroups/addAcademyIntake');
  }
 }
 return res;
}

// ---------- tabla y playoffs (recálculo independiente) ----------
function myStandings(w,division){
 const rows=Object.fromEntries(w.clubs.filter(c=>c.division===division).map(c=>[c.id,{clubId:c.id,P:0,W:0,D:0,L:0,PF:0,PA:0,T:0,bonus:0,pts:0,home:0,away:0}]));
 for(const f of w.fixtures)if(f.division===division&&!f.stage&&f.match){
  const m=f.match,h=rows[f.homeId],a=rows[f.awayId];if(!h||!a){ok(false,'broken','fixture-con-club-de-otra-division',`${f.id}`,'createFixtures');continue;}
  h.home++;a.away++;
  for(const [r,pf,pa,t,ot] of [[h,m.homeScore,m.awayScore,m.homeTries,m.awayTries],[a,m.awayScore,m.homeScore,m.awayTries,m.homeTries]]){
   r.P++;r.PF+=pf;r.PA+=pa;r.T+=t;if(pf>pa){r.W++;r.pts+=4;}else if(pf<pa)r.L++;else{r.D++;r.pts+=2;}
   const b=(t>=ot+3?1:0)+(pf<pa&&pa-pf<=7?1:0);r.bonus+=b;r.pts+=b;}
 }
 return Object.values(rows).sort((a,b)=>b.pts-a.pts||(b.PF-b.PA)-(a.PF-a.PA)||b.PF-a.PF||a.clubId.localeCompare(b.clubId));
}
function checkRegularSeason(w){
 const info={};
 for(const division of DIVS){
  const mine=myStandings(w,division),eng=E.getStandings(w,division);
  ok(mine.length===14,'broken','division-sin-14-clubes',`${division} tiene ${mine.length}`,'advanceSeason');
  ok(mine.every(r=>r.P===26&&r.home===13&&r.away===13),'broken','club-no-jugo-26-fechas-13L-13V',()=>mine.filter(r=>!(r.P===26&&r.home===13&&r.away===13)).map(r=>`${r.clubId}:${r.P}(${r.home}/${r.away})`).join(','),'createFixtures');
  ok(JSON.stringify(mine.map(r=>[r.clubId,r.pts,r.PF,r.PA]))===JSON.stringify(eng.map(r=>[r.clubId,r.points,r.pointsFor,r.pointsAgainst])),'broken','getStandings-difiere-del-recalculo',division,'getStandings');
  ok(mine.reduce((n,r)=>n+r.PF,0)===mine.reduce((n,r)=>n+r.PA,0),'broken','puntos-a-favor-distinto-de-en-contra',division,'getStandings');
  ok(mine.reduce((n,r)=>n+r.W,0)===mine.reduce((n,r)=>n+r.L,0),'broken','victorias-distinto-de-derrotas',division,'getStandings');
  // cada par juega dos veces, una de local y otra de visitante
  const pairs=new Map();for(const f of w.fixtures.filter(f=>f.division===division&&!f.stage)){const k=f.homeId+'>'+f.awayId;pairs.set(k,(pairs.get(k)??0)+1);}
  ok([...pairs.values()].every(n=>n===1)&&pairs.size===14*13,'broken','fixture-no-es-ida-y-vuelta',`${division} ${pairs.size} cruces`,'createFixtures');
  info[division]=mine.slice(0,3).map(r=>r.clubId);
 }
 return info;
}
function expectedPlayoffs(w,division){
 const rule=D.PLAYOFF_RULES[division],table=myStandings(w,division).map(r=>r.clubId),seeds=table.slice(rule.offset,rule.offset+rule.seeds);
 return {table,seeds};
}
function checkPlayoffs(w){
 const result={};
 for(const division of DIVS){
  const {table,seeds}=expectedPlayoffs(w,division);
  const semis=w.fixtures.filter(f=>f.division===division&&f.stage==='semi'),final=w.fixtures.find(f=>f.division===division&&f.stage==='final');
  const seedOf=id=>{const i=seeds.indexOf(id);return i<0?99:i+1;};
  if(!ok(semis.length===2&&final,'broken','playoffs-sin-programar',`${division} semis=${semis.length} final=${!!final}`,'schedulePlayoffs'))continue;
  const [a,b,c,d]=seeds;
  const want=[[a,d],[b,c]];
  want.forEach(([h,v],i)=>{const f=semis.find(x=>x.homeId===h&&x.awayId===v);ok(f,'broken','semifinal-mal-armada',`${division} esperaba ${h} (local) vs ${v}; hay ${semis.map(s=>s.homeId+' v '+s.awayId)}`,'schedulePlayoffs');
   ok(f&&!f.neutral,'broken','semifinal-neutral',`${division}`,'schedulePlayoffs');});
  ok(semis.every(f=>f.match),'broken','semifinal-sin-jugar',division,'advanceWorld');
  const win=f=>{const m=f.match;if(m.homeScore!==m.awayScore)return m.homeScore>m.awayScore?f.homeId:f.awayId;if(m.homeTries!==m.awayTries)return m.homeTries>m.awayTries?f.homeId:f.awayId;return seedOf(f.homeId)<=seedOf(f.awayId)?f.homeId:f.awayId;};
  const winners=semis.filter(f=>f.match).map(win).sort((p,q)=>seedOf(p)-seedOf(q));
  ok(winners.length===2&&final.neutral===true,'broken','final-no-neutral',division,'schedulePlayoffs');
  ok(final.homeId===winners[0]&&final.awayId===winners[1],'broken','finalistas-incorrectos',`${division} final ${final.homeId} v ${final.awayId}, esperados ${winners}`,'schedulePlayoffs');
  ok(final.match,'broken','final-sin-jugar',division,'advanceWorld');
  // todos los playoffs se juegan en la misma ronda lógica
  ok(semis.every(f=>f.round===semis[0].round)&&final.round===semis[0].round+0||final.round>=semis[0].round,'suspicious','ronda-de-playoffs',`${division} semis ${semis[0].round} final ${final.round}`,'schedulePlayoffs');
  const champion=final.match?win(final):null;
  const ps=D.playoffState(w,division);
  ok(ps.winner===champion,'broken','playoffState.winner-difiere',`${division} ${ps.winner} vs ${champion}`,'playoffState/playoffWinner');
  // empate: se debe resolver
  for(const f of [...semis,final])if(f.match&&f.match.homeScore===f.match.awayScore)result.tieSeen=(result.tieSeen??0)+1;
  result[division]={table,seeds,champion,final:final.match?`${final.homeId} ${final.match.homeScore}-${final.match.awayScore} ${final.awayId}`:null};
 }
 return result;
}
function expectedMoves(w,po){
 const moves={};
 const t=po['Top 14'].table,a=po['Primera A'],b=po['Primera B'];
 for(const id of t.slice(-2))moves[id]='Primera A';
 for(const id of [a.table[0],a.champion])moves[id]='Top 14';
 for(const id of a.table.slice(-2))moves[id]='Primera B';
 for(const id of [b.table[0],b.champion])moves[id]='Primera A';
 return moves;
}

// ---------- estadísticas por jugador ----------
const SEC=2,TRY=3,POINTS=12,APP=0;
function checkStatsArchive(w,where,final){
 const ps=w.playerStats;
 if(!ok(ps&&ps.seasons,'broken','playerStats-ausente',where,'recordPlayerStats'))return {};
 const seasonObj=ps.seasons[w.season]??{};
 const played=w.fixtures.filter(f=>f.match);
 ok(Object.keys(seasonObj).length===played.length,'broken','archivo-de-stats-no-coincide-con-partidos',`${where} archivo=${Object.keys(seasonObj).length} jugados=${played.length}`,'recordPlayerStats');
 const ids=Object.values(ps.playerIds);
 ok(new Set(ids).size===ids.length&&ids.every((v,i)=>v===i),'broken','indices-de-jugador-del-archivo-rotos',`${where}: ${ids.length} ids, únicos ${new Set(ids).size}`,'recordPlayerStats');
 if(final){
  let triesBad=0,ptsBad=0,nullTries=0,nullPts=0,checked=0,appBad=0;
  for(const f of played){
   const rec=seasonObj[f.id];if(!rec){bad('broken','partido-sin-registro-de-stats',f.id,'recordPlayerStats');continue;}
   checked++;
   const sum=(side,i)=>side[1].reduce((n,row)=>n+(row[1+i]??0),0);
   const hasNull=side=>side[1].some(row=>row[1+TRY]===null);
   for(const [side,tries,score] of [[rec.home,f.match.homeTries,f.match.homeScore],[rec.away,f.match.awayTries,f.match.awayScore]]){
    if(side[1].some(r=>r[1+TRY]===null))nullTries++;else if(sum(side,TRY)!==tries)triesBad++;
    if(side[1].some(r=>r[1+POINTS]===null))nullPts++;else if(sum(side,POINTS)!==score)ptsBad++;
    const starters=side[1].filter(r=>r[1+APP]===1).length;if(starters<15)appBad++;
   }
  }
  ok(triesBad===0,'broken','tries-de-jugadores-no-suman-los-del-partido',`${where}: ${triesBad} lados (de ${checked*2})`,'recordPlayerStats/matchSide');
  ok(ptsBad===0,'broken','puntos-de-jugadores-no-suman-el-marcador',`${where}: ${ptsBad} lados (de ${checked*2}); null=${nullPts}`,'recordPlayerStats/matchSide');
  ok(appBad===0,'suspicious','menos-de-15-apariciones-por-lado',`${where}: ${appBad}`,'matchSide');
  if(nullTries||nullPts)report.notes.push(`${where}: stats con valores null (desconocidos): tries ${nullTries}, puntos ${nullPts} lados.`);
 }
 return {};
}

// ---------- acciones de manager ----------
const actionLog={ok:{},err:{}};
const count=(o,k)=>{o[k]=(o[k]??0)+1;};
const pendingRefusals=[];const contactedNow=new Set();
const marketCheck={contacts:0,accepted:0,refused:0,violations:0,blockedOk:0};
function rng(seedStr){let h=2166136261;for(const ch of seedStr){h=Math.imul(h^ch.charCodeAt(0),16777619);}return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return (h>>>0)/4294967296;};}

function tryAct(w,clubId,action,payload){
 try{const n=D.applyClubAction(w,clubId,action,payload);count(actionLog.ok,action);return n;}
 catch(e){count(actionLog.err,action+': '+String(e.message).slice(0,70));return w;}
}
function managerActions(w,round,season){
 const r=rng(`${SEED}-${season}-${round}`);
 const total=w.fixtures.filter(f=>!f.match&&!f.stage).length;
 if(!total)return w; // el mercado cierra con la temporada
 for(const id of KEEP){
  const c=w.clubs.find(x=>x.id===id);if(!c)continue;
  if(round===1||round%7===0){
   w=tryAct(w,id,'tactics',{tactics:{...E.DEFAULT_TACTICS,mentality:['Ofensiva','Equilibrada','Defensiva'][Math.floor(r()*3)],lineout:r()<.5?'Competir':'Seguro',defense:r()<.5?'Rush':'Drift'}});
   w=tryAct(w,id,'youth-training',{plan:Object.keys(D.YOUTH_PLANS)[Math.floor(r()*5)]});
   w=tryAct(w,id,'training',{focus:['Equilibrado','Ataque','Defensa','Formaciones'][Math.floor(r()*4)]});
  }
  if(round%4===1){ // XV elegido a mano: el automático con un par de cambios válidos entre suplentes del mismo puesto
   const cc=w.clubs.find(x=>x.id===id);let ids=E.autoLineup(cc);
   const slot=Math.floor(r()*15),alt=cc.players.filter(p=>p.squad==='Plantel superior'&&!p.injury&&!ids.includes(p.id)&&E.canPlay(p,POS[slot]));
   if(alt.length)ids=ids.map((x,i)=>i===slot?alt[0].id:x);
   w=tryAct(w,id,'lineup',{ids});
  }
  { // sesión individual
   const cc=w.clubs.find(x=>x.id===id),cand=cc.players.filter(p=>p.squad==='Plantel superior'&&!p.injury);
   const p=cand[Math.floor(r()*cand.length)];if(p)w=tryAct(w,id,'train-player',{playerId:p.id,attribute:ATTRS[Math.floor(r()*ATTRS.length)]});
  }
  if(round%6===2){ // reconversión
   const cc=w.clubs.find(x=>x.id===id),cand=cc.players.filter(p=>p.squad==='Plantel superior'&&!p.retraining&&D.retrainOptions(p).length);
   const p=cand[Math.floor(r()*cand.length)];if(p)w=tryAct(w,id,'retrain',{playerId:p.id,to:D.retrainOptions(p)[0].to});
  }
  if(round%5===3){ // promover un M19
   const cc=w.clubs.find(x=>x.id===id),p=cc.players.filter(p=>p.squad==='M19')[0];if(p)w=tryAct(w,id,'promote',{playerId:p.id});
  }
  if(round%5===4){ // mover de categoría dentro del plantel superior
   const cc=w.clubs.find(x=>x.id===id),p=cc.players.filter(p=>p.squad==='Plantel superior')[Math.floor(r()*30)];
   if(p)w=tryAct(w,id,'assign-senior',{playerId:p.id,seniorSquad:['Primera','Intermedia','Pre A','Pre B'][Math.floor(r()*4)]});
  }
  // Mercado: un contacto por fecha en la mitad de las fechas
  if(r()<.7)w=marketContact(w,id,round,r);
 }
 return w;
}
function allIdsCount(w,id){let n=0;for(const c of w.clubs)for(const p of c.players)if(p.id===id)n++;return n;}
function marketContact(w,buyerId,round,r){
 const roundNow=D.roundOf(w);
 const list=D.marketPlayers(w,buyerId,'XV').filter(x=>x.chance>=.25&&!(w.transfers?.refused?.[buyerId]??[]).includes(x.player.id));
 if(!list.length)return w;
 const pick=list[Math.floor(r()*list.length)];
 const from=w.clubs.find(c=>c.id===pick.clubId);
 const logLen=w.transfers?.log?.length??0;
 const buyerBefore=w.clubs.find(c=>c.id===buyerId).players.filter(p=>p.squad==='Plantel superior').length;
 let n;
 try{n=D.applyClubAction(w,buyerId,'contact-player',{playerId:pick.player.id,offer:'XV'});}
 catch(e){count(actionLog.err,'contact-player: '+String(e.message).slice(0,70));
  if(/Ya hiciste un contacto/.test(e.message)&&!contactedNow.has(`${w.season}-${roundNow}-${buyerId}`))bad('broken','contacto-rechazado-por-un-contacto-de-la-temporada-anterior',`${buyerId} en la fecha ${roundNow} de ${w.season}: transfers.contacts=${JSON.stringify(w.transfers?.contacts)}`,'contactPlayer (transfers.contacts no se reinicia al cambiar de temporada)');
  return w;}
 contactedNow.add(`${w.season}-${roundNow}-${buyerId}`);marketCheck.contacts++;
 const log=n.transfers?.log??[],accepted=log.length>logLen;
 const where=`${buyerId} ← ${pick.player.id} (${from.id})`;
 if(accepted){
  marketCheck.accepted++;
  const last=log.at(-1);
  const inBuyer=n.clubs.find(c=>c.id===buyerId).players.filter(p=>p.id===pick.player.id).length;
  const inFrom=n.clubs.find(c=>c.id===from.id).players.filter(p=>p.id===pick.player.id).length;
  ok(inBuyer===1&&inFrom===0&&allIdsCount(n,pick.player.id)===1,'broken','traspaso-no-mueve-exactamente-una-vez',`${where}: comprador ${inBuyer}, vendedor ${inFrom}, total ${allIdsCount(n,pick.player.id)}`,'contactPlayer');
  ok(last.from===from.id&&last.to===buyerId&&last.playerId===pick.player.id,'broken','registro-de-traspaso-incorrecto',where,'contactPlayer');
  ok(!(n.clubs.find(c=>c.id===from.id).lineup??[]).includes(pick.player.id),'broken','lineup-del-vendedor-conserva-al-traspasado',where,'contactPlayer');
  const moved=n.clubs.find(c=>c.id===buyerId).players.find(p=>p.id===pick.player.id);
  ok(moved.squad==='Plantel superior','broken','traspasado-fuera-del-plantel-superior',where,'contactPlayer');
  const promisedGroup=moved.promise?.role==='XV'?'Primera':moved.promise?.role;
  ok(moved.seniorSquad===promisedGroup,'suspicious','categoria-prometida-no-se-respeta-tras-traspaso',`${where}: prometido ${moved.promise?.role}, queda en ${moved.seniorSquad}`,'contactPlayer (assignSeniorGroups reasigna todo el plantel del comprador)');
  const bb=w.clubs.find(c=>c.id===buyerId).players,aa=n.clubs.find(c=>c.id===buyerId).players;
  const changed=bb.filter(p=>aa.find(q=>q.id===p.id)?.seniorSquad!==p.seniorSquad).length;
  marketCheck.groupsReshuffled=(marketCheck.groupsReshuffled??0)+changed;
  ok(changed===0,'suspicious','fichaje-reasigna-las-categorias-de-todo-el-plantel',`${where}: ${changed} jugadores cambiaron de categoría (incluye asignaciones manuales)`,'contactPlayer/assignSeniorGroups');
  ok(n.clubs.find(c=>c.id===buyerId).players.filter(p=>p.squad==='Plantel superior').length===buyerBefore+1,'broken','plantel-del-comprador-no-sube-en-1',where,'contactPlayer');
  // jugador ya traspasado no se puede volver a contactar en el club vendedor por el mismo comprador (ya es suyo)
  try{D.applyClubAction(n,buyerId,'contact-player',{playerId:pick.player.id,offer:'XV'});ok(false,'broken','se-puede-contactar-a-un-jugador-propio',where,'contactPlayer');}catch{marketCheck.blockedOk++;}
 }else{
  marketCheck.refused++;
  ok(allIdsCount(n,pick.player.id)===1&&n.clubs.find(c=>c.id===from.id).players.some(p=>p.id===pick.player.id),'broken','rechazo-movio-al-jugador',where,'contactPlayer');
  ok((n.transfers.refused?.[buyerId]??[]).includes(pick.player.id),'broken','rechazo-no-registrado',where,'contactPlayer');
  pendingRefusals.push({buyerId,playerId:pick.player.id,season:w.season,round:roundNow});
 }
 // segundo contacto en la misma fecha debe fallar
 const other=list.find(x=>x.player.id!==pick.player.id);
 if(other){try{D.applyClubAction(n,buyerId,'contact-player',{playerId:other.player.id,offer:'XV'});ok(false,'broken','dos-contactos-en-la-misma-fecha',where,'contactPlayer');}catch{marketCheck.blockedOk++;}}
 return n;
}
function checkRefusalsStillBlocked(w){
 // Un rechazo vale toda la temporada, y no más.
 for(const ref of pendingRefusals.splice(0)){
  const c=w.clubs.find(x=>x.id===ref.buyerId);if(!c||D.roundOf(w)===Infinity)continue;
  const from=w.clubs.find(x=>x.id!==ref.buyerId&&x.players.some(p=>p.id===ref.playerId));if(!from)continue;
  if(w.season!==ref.season){
   ok(false,'suspicious','rechazo-persiste-entre-temporadas',`${ref.buyerId} ← ${ref.playerId} sigue vetado en temporada ${w.season} (rechazo de ${ref.season})`,'contactPlayer/advanceSeason (no limpia transfers.refused)');continue;}
  if(w.transfers?.contacts?.[ref.buyerId]===D.roundOf(w))continue;
  try{D.applyClubAction(w,ref.buyerId,'contact-player',{playerId:ref.playerId,offer:'XV'});ok(false,'broken','rechazo-no-respetado',`${ref.buyerId} ← ${ref.playerId}`,'contactPlayer');}catch(e){if(/dijo que no/.test(e.message))marketCheck.blockedOk++;}
 }
}

// ---------- bucle principal ----------
const t00=Date.now();
{
 const t=Date.now();
 world=D.initialWorld(catalog,SEED,returns,youth,names);
 report.initMs=Date.now()-t;
}
const noMoveKeepers=[];
const seasonSnap=[];
let archiveHashes={};
for(let s=0;s<SEASONS;s++){
 const seasonStart=Date.now();
 ctx={season:world.season,round:0};
 const rec={season:world.season,sizes:{},timing:{},squads:{},objectives:{},fieldable:{}};
 // --- inicio de temporada
 world=rt(world);
 {
  const before=JSON.stringify(world);
  const mig=D.migrateWorld(rt(world),catalog,returns,youth);
  ok(JSON.stringify(mig)===before,'suspicious','migrateWorld-cambia-una-liga-actual',`dataVersion=${world.dataVersion}`,'migrateWorld');
  // simulación de liga guardada con versión vieja (v16 -> aplica v16 y v17, y reasigna categorías) para ver que no rompa nada
  if(s===1||s===4){
   const old=rt(world);old.dataVersion=15;const m15=D.migrateWorld(old,catalog,returns,youth);
   const ids=new Set(),dups=[];for(const c of m15.clubs)for(const p of c.players){if(ids.has(p.id))dups.push(p.id);ids.add(p.id);}
   ok(!dups.length,'broken','migrar-v15-duplica-ids',dups.slice(0,3).join(','),'migrateWorld');
   const sz=x=>x.clubs.map(c=>c.players.length).reduce((a,b)=>a+b,0);
   ok(sz(m15)===sz(world),'suspicious','migrar-v15-cambia-el-tamano-de-la-liga',`${sz(world)} → ${sz(m15)}`,'migrateWorld (completeCurrentAcademyIntake/attachSelectedM17)');
   rec.migrateV15={dataVersion:m15.dataVersion,players:sz(m15),before:sz(world)};
   checkPlayers(m15,'migrar v15');
  }
 }
 world={...world,managedClubs:KEEP};
 const seen0=checkPlayers(world,`inicio ${world.season}`);
 checkXV(world,`inicio ${world.season}`);
 {const sq=squadStats(world);rec.squads.start=sq.agg;rec.fieldable.start=checkFieldable(world,`inicio ${world.season}`);
  for(const [id,row] of Object.entries(sq.per)){
   ok(row.M19>=15&&row.M17>=12,'suspicious','juveniles-por-debajo-del-minimo',`${id} M19=${row.M19} M17=${row.M17}`,'addAcademyIntake');
   ok(row.senior<=D.SQUAD_LIMIT,'suspicious','plantel-superior-supera-SQUAD_LIMIT',`${id} ${row.senior}`,'squadTurnover/contactPlayer');
   ok(row.senior>=30,'broken','plantel-superior-demasiado-chico',`${id} ${row.senior}`,'squadTurnover');}}
 rec.sizes.start=mb(jsonSize(world));
 rec.totalPlayers=world.clubs.reduce((n,c)=>n+c.players.length,0);
 {const big=world.clubs.map(c=>[c.id,c.players.filter(p=>p.squad==='Plantel superior').length]).sort((a,b)=>b[1]-a[1]);rec.biggestSquads=big.slice(0,3).map(x=>x.join(':'));rec.smallestSquads=big.slice(-2).map(x=>x.join(':'));rec.clubsOverLimit=big.filter(x=>x[1]>D.SQUAD_LIMIT).length;}
 rec.attrAbovePotentialAtStart=world.clubs.reduce((n,c)=>n+c.players.filter(p=>Math.max(...Object.values(p.attributes))>p.potential).length,0);
 // objetivos
 for(const division of DIVS){
  const cs=world.clubs.filter(c=>c.division===division);
  const lv={};for(const c of cs){const o=D.clubObjective(world,c.id);lv[o.level]=(lv[o.level]??0)+1;
   ok(o.rank>=1&&o.rank<=cs.length&&o.target>=1&&o.target<=cs.length,'broken','objetivo-fuera-de-rango',`${c.id} ${JSON.stringify(o)}`,'clubObjective');}
  rec.objectives[division]=lv;
  // ¿la fuerza del club refleja el nivel real del XV? (Spearman)
  const strength=cs.map(c=>c.strength),xv=cs.map(c=>mean(E.autoLineup(c).map(id=>E.overall(c.players.find(p=>p.id===id)))));
  const rank=a=>{const o=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=[];o.forEach(([,i],k)=>r[i]=k);return r;};
  const ra=rank(strength),rb=rank(xv),n=cs.length;
  const sp=1-6*ra.reduce((acc,v,i)=>acc+(v-rb[i])**2,0)/(n*(n*n-1));
  (rec.strengthVsXV??={})[division]=Math.round(sp*100)/100;
 }
 // --- fechas
 const pre0=world;
 let iter=0,lastRound=0;
 const matchSnapshotFor=new Map();
 while(iter++<45){
  const finalsDone=DIVS.every(d=>world.fixtures.some(f=>f.division===d&&f.stage==='final'&&f.match));
  if(finalsDone)break;
  const cur=D.roundOf(world);
  const roundNum=Number.isFinite(cur)?cur:lastRound+1;
  ctx.round=roundNum;
  // acciones de manager sobre el mundo (como si llegaran por la API)
  checkRefusalsStillBlocked(world);
  if(Number.isFinite(cur))world=managerActions(world,cur,world.season);
  const preW=world;
  const preInjured=new Set(preW.clubs.flatMap(c=>c.players.filter(p=>p.injury).map(p=>p.id)));
  const prePlayers=new Map(preW.clubs.flatMap(c=>c.players.map(p=>[p.id,{club:c.id,p}])));
  const preLineups=Object.fromEntries(preW.clubs.map(c=>[c.id,{saved:c.lineup,eff:E.effectiveLineup(c)}]));
  const prePlayedIds=new Set(preW.fixtures.filter(f=>f.match).map(f=>f.id));
  const t=Date.now();
  // Liga guardada: se recarga desde JSON antes de cada avance.
  const loaded=rt(preW);
  let next;
  try{next=D.advanceWorld(loaded,keep);}catch(e){bad('broken','advanceWorld-lanza',`${e.message}`,'advanceWorld');report.crash={season:world.season,round:roundNum,msg:e.stack};break;}
  const ms=Date.now()-t;(rec.timing.rounds??=[]).push(ms);
  // determinismo: avanzar el mundo en memoria (sin recargar) da lo mismo que recargado
  if([1,13,27,28].includes(roundNum)||s===0&&roundNum===2){
   const direct=D.advanceWorld(preW,keep);
   ok(JSON.stringify(direct)===JSON.stringify(next),'broken','json-ida-y-vuelta-cambia-el-resultado',`mundo en memoria vs recargado difieren en la fecha ${roundNum}`,'advanceWorld/serialización');
  }
  // --- invariantes de la fecha
  const played=next.fixtures.filter(f=>f.match&&!prePlayedIds.has(f.id));
  const roundsPlayed=[...new Set(played.map(f=>f.round))];
  ok(played.length>0&&roundsPlayed.length===1,'broken','la-fecha-jugo-fixtures-de-varias-rondas',`${roundsPlayed}`,'autoPlayRound');
  const remaining=next.fixtures.filter(f=>!f.match&&f.round===roundsPlayed[0]);
  ok(remaining.length===0,'broken','fixture-de-la-fecha-sin-jugar',`${remaining.length}`,'autoPlayRound');
  if(played[0]&&!played[0].stage)ok(played.length===21,'broken','fecha-regular-no-tiene-21-partidos',`${played.length}`,'autoPlayRound');
  for(const f of played){
   const m=f.match;
   ok(Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore)&&m.homeScore>=0&&m.awayScore>=0,'broken','marcador-invalido',f.id,'simulateFixture');
   ok(m.homeScore>=m.homeTries*5&&m.awayScore>=m.awayTries*5,'broken','puntos-menores-que-5-por-try',f.id,'simulateFixture');
   if(f.stage||true){ // lineups
    for(const [side,clubId,lineup] of [['L',f.homeId,m.homeLineup],['V',f.awayId,m.awayLineup]]){
     const club=preW.clubs.find(c=>c.id===clubId);const starters=lineup.slice(0,15);const pl0=preLineups[clubId];
     ok(starters.length===15&&new Set(starters).size===15,'broken','xv-del-partido-no-tiene-15-distintos',`${f.id} ${side}`,'simulateFixture');
     ok(new Set(lineup).size===lineup.length,'broken','jugador-repetido-entre-XV-y-banco',`${f.id} ${side}`,'simulateFixture');
     starters.forEach((id,i)=>{
      const q=prePlayers.get(id);
      if(!ok(q&&q.club===clubId,'broken','titular-que-no-es-del-club',`${f.id} ${side} ${id}`,'simulateFixture'))return;
      ok(!preInjured.has(id),'broken','titular-lesionado-jugo',`${f.id} ${side} ${id} dorsal ${i+1}`,'simulateFixture/effectiveLineup');
      ok(q.p.squad==='Plantel superior','broken','titular-no-es-del-plantel-superior',`${f.id} ${id} ${q.p.squad}`,'simulateFixture');
      ok(E.canPlay(q.p,POS[i]),'broken','titular-fuera-de-puesto',()=>{const avail=club.players.filter(p=>p.squad==='Plantel superior'&&!p.injury&&E.canPlay(p,POS[i])).length,all=club.players.filter(p=>p.squad==='Plantel superior'&&E.canPlay(p,POS[i])).length;return `${f.id} ${side} dorsal ${i+1} ${POS[i]}: ${q.p.name} (${q.p.position}/${q.p.positions}); en el club juegan ese puesto ${all} (disponibles ${avail}), lesionados del plantel ${club.players.filter(p=>p.squad==='Plantel superior'&&p.injury).length}, XV guardado=${!!pl0.saved}`;},'simulateFixture/effectiveLineup (selection: relleno con cualquiera si no queda nadie del puesto)');
     });
     lineup.slice(15).forEach((id,bi)=>{if(id===''){bad('suspicious','banco-con-hueco-sin-suplente-de-ese-puesto',`${f.id} ${side} banco[${bi}] vacío (no hay otro jugador disponible de ${POS[bi===0?0:3]}); disponibles del club=${club.players.filter(p=>p.squad==='Plantel superior'&&!p.injury).length}`,'simulateFixture (bench = [slot 0, slot 3] por puesto)');return;}const q=prePlayers.get(id);ok(q&&q.club===clubId&&!preInjured.has(id),'broken','suplente-lesionado-o-ajeno',`${f.id} ${side} banco[${bi}] ${id}: ${!q?'no existe':q.club!==clubId?'es de '+q.club:'lesionado: '+JSON.stringify(q.p.injury)} squad=${q?.p.squad} pos=${q?.p.position} lineupLen=${lineup.length}`,'simulateFixture (selección del banco)');});
     const L=lineup.length;rec.benchSizes??={};rec.benchSizes[L]=(rec.benchSizes[L]??0)+1;
     // el XV guardado por el manager (si es válido y todos disponibles) debe respetarse
     const pl=preLineups[clubId];
     if(pl.saved?.length===15&&new Set(pl.saved).size===15&&pl.saved.every(id=>prePlayers.get(id)?.club===clubId&&!preInjured.has(id)))
      ok(JSON.stringify(starters)===JSON.stringify(pl.saved),'broken','xv-guardado-no-respetado',`${f.id} ${clubId}`,'simulateFixture/selection');
    }
   }
   const last=m.events?.at(-1);
   if(!m.slim)ok(last?.type==='fullTime'&&last.homeScore===m.homeScore&&last.awayScore===m.awayScore,'broken','evento-fullTime-no-coincide',f.id,'simulateFixture');
   ok(m.slim===undefined?KEEP.some(k=>k===f.homeId||k===f.awayId):(m.slim===true&&!KEEP.includes(f.homeId)&&!KEEP.includes(f.awayId)),'suspicious','slim-mal-aplicado',`${f.id} slim=${m.slim}`,'slimMatches');
  }
  // paralelas: solo fechas regulares, y las cinco categorías en cada una
  if(played[0]&&!played[0].stage)for(const f of played){const r=next.parallel?.results?.[f.id];ok(r&&D.PARALLEL_CATEGORIES.every(cat=>Array.isArray(r[cat])&&r[cat].length===4&&r[cat].every(Number.isInteger)),'broken','categorias-paralelas-incompletas',f.id,'playParallelRound');}
  if(played[0]?.stage)ok(played.every(f=>!next.parallel?.results?.[f.id]),'broken','paralelas-jugaron-playoffs',played[0].id,'playParallelRound');
  // jugadores
  const seen=checkPlayers(next,`fecha ${roundNum}`);
  checkXV(next,`fecha ${roundNum}`);
  // ningún jugador cambió de club ni apareció/desapareció durante una fecha
  ok(seen.size===prePlayers.size&&[...seen.keys()].every(id=>prePlayers.has(id)&&prePlayers.get(id).club===seen.get(id)),'broken','jugadores-aparecen-desaparecen-o-cambian-de-club-en-una-fecha',`${seen.size} vs ${prePlayers.size}`,'advanceWorld');
  // lesionados nuevos: bounded, y estado físico
  const injuredNow=next.clubs.reduce((n,c)=>n+c.players.filter(p=>p.injury).length,0);
  (rec.injuredPerRound??=[]).push(injuredNow);
  // stats
  checkStatsArchive(next,`fecha ${roundNum}`,false);
  // idempotencia de recordPlayerStats tras ida y vuelta (sin doble conteo)
  {const again=Stats.recordPlayerStats(rt(next));
   ok(JSON.stringify(again.playerStats)===JSON.stringify(next.playerStats),'broken','stats-se-duplican-tras-ida-y-vuelta',`fecha ${roundNum}`,'recordPlayerStats');}
  // stats de temporadas anteriores intactas
  for(const [k,h] of Object.entries(archiveHashes)){if(+k<next.season){const nowH=md5(JSON.stringify(next.playerStats.seasons[k]??null));ok(nowH===h,'broken','stats-de-temporada-anterior-cambiaron',`temporada ${k}`,'recordPlayerStats');}}
  // noticias
  ok((next.news??[]).length<=2000,'broken','news-sin-limite',`${next.news.length}`,'varios');
  world=next;lastRound=roundNum;
  if(roundNum===13)rec.sizes.mid=mb(jsonSize(world));
  if(roundNum===26){
   rec.sizes.afterRegular=mb(jsonSize(world));
   rec.regular=checkRegularSeason(world);
  }
  // Los de tabla completa a mitad de temporada.
  if(roundNum===13)rec.fieldable.mid=checkFieldable(world,`fecha 13 ${world.season}`);
 }
 // --- fin de temporada: playoffs, estadísticas, mudanza de divisiones
 ctx.round='fin';
 rec.news=(world.news??[]).length;
 const po=checkPlayoffs(world);rec.playoffs=po;
 const rolloverStats=checkStatsArchive(world,`fin ${world.season}`,true);
 archiveHashes[world.season]=md5(JSON.stringify(world.playerStats.seasons[world.season]));
 rec.sizes.end=mb(jsonSize(world));
 rec.sizes.parts=Object.fromEntries(Object.entries(world).map(([k,v])=>[k,mb(Buffer.byteLength(JSON.stringify(v)??''))]).filter(([,v])=>v>=.05));
 rec.nonFinite=deepNonFinite(world);
 if(rec.nonFinite.length)bad('broken','NaN-o-undefined-en-el-mundo',rec.nonFinite.join(' | '),'varios');
 checkFieldable(world,`fin ${world.season}`);
 rec.fieldable.end=checkFieldable(world,`fin ${world.season}`);
 const exp=expectedMoves(world,po);
 const before=world;
 const preAll=new Map(before.clubs.flatMap(c=>c.players.map(p=>[p.id,{club:c.id,p}])));
 const preOverseas=new Set((before.overseasCareers??[]).map(o=>o.player.id));
 // campeones esperados
 const expHonours=DIVS.map(d=>({division:d,clubId:d==='Top 14'?po[d].champion:po[d].table[0]}));
 const tr=Date.now();
 // avanzar la temporada desde el mundo recargado (liga guardada)
 let rolled;
 try{rolled=D.advanceSeasonWorld(rt(before));}catch(e){bad('broken','advanceSeasonWorld-lanza',e.message,'advanceSeasonWorld');report.crash={season:before.season,round:'fin',msg:e.stack};break;}
 rec.timing.rolloverMs=Date.now()-tr;
 {const direct=D.advanceSeasonWorld(before);ok(JSON.stringify(direct)===JSON.stringify(rolled),'broken','json-ida-y-vuelta-cambia-el-cambio-de-temporada',`temporada ${before.season}`,'advanceSeasonWorld');}
 ctx={season:rolled.season,round:'inicio'};
 // ... divisiones
 for(const d of DIVS)ok(rolled.clubs.filter(c=>c.division===d).length===14,'broken','division-sin-14-clubes-tras-el-ascenso',`${d}: ${rolled.clubs.filter(c=>c.division===d).length}`,'seasonMoves/advanceSeason');
 ok(rolled.clubs.length===42,'broken','cantidad-de-clubes-cambio',`${rolled.clubs.length}`,'advanceSeason');
 const wrong=[];
 for(const c of before.clubs){const want=exp[c.id]??c.division,got=rolled.clubs.find(x=>x.id===c.id).division;if(want!==got)wrong.push(`${c.id}: ${c.division}→${got}, esperado ${want}`);}
 ok(!wrong.length,'broken','club-movido-incorrectamente',wrong.join('; '),'seasonMoves/advanceSeason');
 rec.moves=Object.entries(exp).map(([id,d])=>`${id}→${d}`);
 ok(rolled.season===before.season+1&&rolled.fixtures.length===546&&rolled.fixtures.every(f=>!f.match&&!f.stage&&f.round>=1&&f.round<=26),'broken','calendario-nuevo-mal-armado',`${rolled.fixtures.length} fixtures`,'advanceSeason/createFixtures');
 ok(Math.max(...rolled.fixtures.map(f=>f.round))===26,'broken','calendario-no-llega-a-26-fechas','','createFixtures');
 // palmarés y campeones paralelos
 const hon=rolled.honours??[];
 ok(hon.length===3*(s+1),'broken','honours-no-suma-3-por-temporada',`${hon.length} tras ${s+1} temporadas`,'advanceSeasonWorld');
 for(const e of expHonours){const h=hon.find(x=>x.season===before.season&&x.division===e.division);ok(h&&h.clubId===e.clubId,'broken','campeon-archivado-incorrecto',`${e.division} ${before.season}: ${h?.clubId} vs ${e.clubId}`,'advanceSeasonWorld');}
 const pc=rolled.parallel?.champions??[];
 ok(pc.filter(x=>x.season===before.season).length===15,'broken','campeones-paralelos-no-son-15',`${pc.filter(x=>x.season===before.season).length}`,'advanceSeasonWorld');
 ok(Object.keys(rolled.parallel?.results??{}).length===0&&rolled.parallel.season===rolled.season,'broken','paralelas-no-se-reinician',`${Object.keys(rolled.parallel.results).length}`,'advanceSeasonWorld');
 ok(pc.length<=300,'broken','campeones-paralelos-sin-limite',`${pc.length}`,'advanceSeasonWorld');
 // campeones paralelos correctos
 for(const division of DIVS)for(const cat of D.PARALLEL_CATEGORIES){const top=D.parallelStandings(before,division,cat)[0]?.clubId;const h=pc.find(x=>x.season===before.season&&x.division===division&&x.category===cat);ok(h?.clubId===top,'broken','campeon-paralelo-incorrecto',`${division} ${cat}`,'advanceSeasonWorld');}
 // estadísticas: la temporada vieja sigue, la nueva está vacía
 ok(rolled.playerStats&&JSON.stringify(Object.keys(rolled.playerStats.seasons).sort())===JSON.stringify(Object.keys(before.playerStats.seasons).sort()),'broken','archivo-de-stats-pierde-o-agrega-temporadas-al-cambiar',`${Object.keys(rolled.playerStats?.seasons??{})}`,'advanceSeasonWorld');
 ok(md5(JSON.stringify(rolled.playerStats.seasons[before.season]))===archiveHashes[before.season],'broken','stats-de-la-temporada-cerrada-cambiaron-al-cambiar','','advanceSeasonWorld');
 // jugadores: edades, potencial, atributos
 const post=new Map(rolled.clubs.flatMap(c=>c.players.map(p=>[p.id,{club:c.id,p}])));
 const ageStat={both:0,knownPlus1:0,knownOther:[],unknownStays:0,unknownBecame:[],estimatedChanged:0,nullAgeButEstimated:0,fictionalAge:{plus1:0,other:[]}};
 const potStat={same:0,up:0,down:0,downExamples:[]},attrStat={up:0,down:0,overPotential:0,potentialBelowMax:0,total:0};
 let kept=0,gone=[],newIds=[],retiredNews=0;
 for(const [id,b] of preAll){
  const a=post.get(id);
  if(!a){gone.push(id);continue;}
  kept++;
  const pb=b.p,pa=a.p;
  ageStat.both++;
  if(pb.age==null){if(pa.age==null)ageStat.unknownStays++;else ageStat.unknownBecame.push(`${id}: null→${pa.age}`);}
  else{
   if(pa.age===pb.age+1){if(pb.fictional)ageStat.fictionalAge.plus1++;else ageStat.knownPlus1++;}
   else (pb.fictional?ageStat.fictionalAge.other:ageStat.knownOther).push(`${id}: ${pb.age}→${pa.age}`);
  }
  for(const f of ['estimatedBirthDate','birthDate','ageKnown','ageEstimated'])if((pb[f]??(typeof pb[f]==='boolean'?false:null))!==(pa[f]??null)&&(pb[f]??false)!==(pa[f]??false)){ageStat.estimatedChanged++;(ageStat.changedFields??={})[f]=(ageStat.changedFields[f]??0)+1;if(!ageStat.changedEx)ageStat.changedEx=`${id}.${f}: ${pb[f]} → ${pa[f]} (fictional=${pb.fictional})`;}
  if(pa.potential===pb.potential)potStat.same++;else if(pa.potential>pb.potential)potStat.up++;else{potStat.down++;if(potStat.downExamples.length<3)potStat.downExamples.push(`${id}: ${pb.potential}→${pa.potential} (edad ${pa.age})`);}
  const maxA=Math.max(...Object.values(pa.attributes));
  attrStat.total++;if(maxA>pa.potential)attrStat.potentialBelowMax++;
  for(const k of ATTRS){if(pa.attributes[k]>pb.attributes[k])attrStat.up++;else if(pa.attributes[k]<pb.attributes[k])attrStat.down++;}
 }
 for(const [id] of post)if(!preAll.has(id))newIds.push(id);
 rec.ages={...ageStat,changedEx:undefined,knownOther:ageStat.knownOther.length,knownOtherExamples:ageStat.knownOther.slice(0,4),unknownBecame:ageStat.unknownBecame.length,unknownBecameExamples:ageStat.unknownBecame.slice(0,3),fictionalAge:{plus1:ageStat.fictionalAge.plus1,other:ageStat.fictionalAge.other.length,examples:ageStat.fictionalAge.other.slice(0,4)}};
 ok(ageStat.knownOther.length===0,'broken','edad-conocida-no-suma-1',ageStat.knownOther.slice(0,5).join('; ')+` (${ageStat.knownOther.length})`,'advanceSeasonWorld/ageFields');
 ok(ageStat.unknownBecame.length===0,'broken','edad-desconocida-deja-de-serlo',ageStat.unknownBecame.slice(0,5).join('; ')+` (${ageStat.unknownBecame.length})`,'advanceSeasonWorld');
 ok(ageStat.fictionalAge.other.length===0,'broken','edad-ficticia-no-suma-1',ageStat.fictionalAge.other.slice(0,5).join('; ')+` (${ageStat.fictionalAge.other.length})`,'advanceSeason');
 ok(ageStat.estimatedChanged===0,'broken','fecha-acreditada-o-estimada-cambio',`${ageStat.estimatedChanged} ${JSON.stringify(ageStat.changedFields)} ej: ${ageStat.changedEx}`,'advanceSeasonWorld');
 rec.potential={...potStat,attrsUp:attrStat.up,attrsDown:attrStat.down,playersWithAttrAbovePotential:attrStat.potentialBelowMax,of:attrStat.total};
 ok(potStat.down===0,'suspicious','potencial-baja-al-cambiar-de-temporada',`${potStat.down} jugadores; ${potStat.downExamples.join('; ')}`,'reviewDevelopment/advanceSeason');
 ok(attrStat.potentialBelowMax===0,'suspicious','atributo-por-encima-del-potencial',`${attrStat.potentialBelowMax} de ${attrStat.total} jugadores`,'developPlayer/reviewDevelopment');
 // altas y bajas
 const newsNow=(rolled.news??[]).filter(n=>n.season===before.season&&n.round===0);
 const goneAbroad=gone.filter(id=>(rolled.overseasCareers??[]).some(o=>o.player.id===id)).length;
 const retiredOrOut=gone.length-goneAbroad;
 const squadNews=(rolled.news??[]).filter(n=>n.kind==='squad'&&n.season===rolled.season&&n.round===0).length;
 rec.turnover={gone:gone.length,abroad:goneAbroad,retiredOrDropped:retiredOrOut,news:squadNews,newPlayers:newIds.length,kept};
 ok(squadNews>=retiredOrOut,'suspicious','bajas-sin-aviso-en-novedades',`${retiredOrOut} bajas, ${squadNews} avisos`,'squadTurnover');
 // ¿se reutilizan ids de jugadores que ya estaban en el archivo de stats?
 const reused=newIds.filter(id=>!preOverseas.has(id)&&Object.hasOwn(rolled.playerStats.playerIds,id));
 ok(!reused.length,'broken','id-de-jugador-nuevo-reutiliza-uno-del-archivo-de-stats',`${reused.slice(0,4).join(',')} (${reused.length})`,'addAcademyIntake/createReturnCandidates');
 rec.newIdSamples=newIds.slice(0,3);
 // jugadores duplicados y XV con el mundo nuevo
 const seenR=checkPlayers(rolled,`inicio ${rolled.season}`);
 checkXV(rolled,`inicio ${rolled.season}`);
 // limpieza de estado entre temporadas
 rec.carry={transfersLog:rolled.transfers?.log?.length??0,refusedPairs:Object.values(rolled.transfers?.refused??{}).reduce((n,a)=>n+a.length,0),contacts:Object.keys(rolled.transfers?.contacts??{}).length,trainingRounds:Object.keys(rolled.trainingRounds??{}).length};
 ok(rec.carry.refusedPairs===0,'suspicious','vetos-de-mercado-no-se-limpian-al-cambiar-de-temporada',`${rec.carry.refusedPairs} pares siguen vetados`,'advanceSeasonWorld (transfers.refused persiste)');
 {const c=rolled.transfers?.contacts??{};if(Object.keys(c).length)ok(false,'suspicious','contacts-de-mercado-persisten-entre-temporadas',`${JSON.stringify(c)} (un número de fecha viejo puede bloquear el primer contacto de la fecha igual)`,'contactPlayer/advanceSeasonWorld');}
 ok(Object.keys(rolled.trainingRounds??{}).length===0,'broken','trainingRounds-no-se-reinicia',`${JSON.stringify(rolled.trainingRounds)}`,'advanceSeason');
 // clubes: movidos y su fuerza
 rec.movedStrength=Object.keys(exp).map(id=>{const c=rolled.clubs.find(x=>x.id===id);const cs=rolled.clubs.filter(x=>x.division===c.division);
  const rank=cs.sort((a,b)=>b.strength-a.strength).findIndex(x=>x.id===id)+1;
  const xvs=cs.map(x=>[x.id,mean(E.autoLineup(x).map(i=>E.overall(x.players.find(p=>p.id===i))))]).sort((a,b)=>b[1]-a[1]);
  return {id,division:c.division,strength:Math.round(c.strength*10)/10,rankByStrength:rank,rankByXV:xvs.findIndex(x=>x[0]===id)+1,objective:D.clubObjective(rolled,id).level};});
 rec.timing.seasonMs=Date.now()-seasonStart;
 rec.timing.avgRoundMs=Math.round(mean(rec.timing.rounds));rec.timing.maxRoundMs=Math.max(...rec.timing.rounds);delete rec.timing.rounds;
 rec.injuredAvg=Math.round(mean(rec.injuredPerRound)*10)/10;rec.injuredMax=Math.max(...rec.injuredPerRound);delete rec.injuredPerRound;
 rec.keepClubs=KEEP.map(id=>{const c=before.clubs.find(x=>x.id===id);const i=myStandings(before,c.division).findIndex(r=>r.clubId===id)+1;return `${id}:${c.division}#${i}`;});
 rec.champions=Object.fromEntries(DIVS.map(d=>[d,po[d].champion??po[d].table[0]]));
 rec.market={...marketCheck};
 seasonSnap.push(rec);
 world=rolled;
 // el rolled se valida otra vez al empezar la próxima vuelta (sin acciones previas)
}
report.seasons=seasonSnap;
report.actions=actionLog;
report.totalMs=Date.now()-t00;
report.violations=[...violations.values()].sort((a,b)=>(a.sev==='broken'?0:1)-(b.sev==='broken'?0:1)||b.count-a.count);
report.finalSize=mb(jsonSize(world));
await writeFile(arg('out'),JSON.stringify(report,null,1));
console.log(`seed ${SEED}: ${report.violations.length} tipos de violación, ${Math.round(report.totalMs/1000)} s, ${report.finalSize} MB`);
