#!/usr/bin/env node
/**
 * Growth, decline and departures over several seasons with no manager (requires npm run build).
 * Usage: node scripts/season-growth-check.mjs [--seeds 3] [--seasons 4] [--out research/history/season-growth.json]
 *  - youth: overall change in one season of every M17/M19 player, by talent (potential tercile in his category);
 *  - seniors: overall change by age group, and for "grandes" (overall >= 72 at 30+);
 *  - Europe: players who leave abroad per season, and the share of the eligible (19-26, Primera level) who leave;
 *  - clubs: XV average per club each season (to see big clubs fading or not).
 */
import {readFile,writeFile} from 'node:fs/promises';
const R=new URL('..',import.meta.url).pathname;
const E=await import(R+'web/engine.js');const D=await import(R+'web/domain.js');
const j=async p=>JSON.parse(await readFile(R+p,'utf8'));
const [cat,ret,youth,names]=await Promise.all(['research/catalog.json','research/returns.json','research/youth.json','research/names.json'].map(j));
const argv=process.argv,arg=(k,d)=>{const i=argv.indexOf(k);return i>0?argv[i+1]:d;};
const SEEDS=+arg('--seeds',3),SEASONS=+arg('--seasons',4),OUT=arg('--out','research/history/season-growth.json');
const ov=p=>E.overall(p);
const xvAvg=c=>{const ids=E.autoLineup(c),m=new Map(c.players.map(p=>[p.id,p]));return ids.reduce((n,i)=>n+ov(m.get(i)),0)/ids.length;};
const q=(a,p)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(p*s.length))].toFixed(2);};
const mean=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):null;
const divXV={'Top 14':[],'Primera A':[],'Primera B':[]};
const careers=[];
const youthD={M17:{alto:[],medio:[],bajo:[]},M19:{alto:[],medio:[],bajo:[]}},ageD={},grandes=[],europe=[],clubs={};
const ageGroup=p=>p.age==null?(p.trajectory?.seasons>=7?'veterano sin edad':'sin edad'):p.age<=22?'19-22':p.age<=26?'23-26':p.age<=29?'27-29':p.age<=32?'30-32':'33+';
for(let seed=1;seed<=SEEDS;seed++){
 let w=D.initialWorld(cat,seed*7919,ret,youth,names);
 for(let s=0;s<SEASONS;s++){
  if(s===0)for(const c of w.clubs)for(const p of c.players.filter(p=>p.squad==='M17'))careers.push({seed,id:p.id,start:ov(p),room:E.developmentProfile(p).projection-ov(p)});
  const before=new Map(w.clubs.flatMap(c=>c.players.map(p=>[p.id,{...p,club:c.id,ov:ov(p)}])));
  for(const c of w.clubs)(clubs[c.id]??=[]).push(+xvAvg(c).toFixed(2));
  for(const d of Object.keys(divXV)){const l=w.clubs.filter(c=>c.division===d).map(xvAvg);(divXV[d][s]??=[]).push(l.reduce((a,b)=>a+b,0)/l.length);}
  // Eligible for Europe at the end of the season (same filter as overseasMove, minus match evidence).
  const target={'Top 14':73,'Primera A':75,'Primera B':77};
  const eligible=w.clubs.flatMap(c=>c.players.filter(p=>p.squad==='Plantel superior'&&p.age!=null&&p.age>=19&&p.age<=26&&ov(p)>=target[c.division]).map(p=>p.id));
  for(;;){try{w=D.advanceWorld(w,new Set());}catch(e){if(/terminó/.test(e.message))break;throw e;}}
  const abroadBefore=new Set((w.overseasCareers??[]).map(c=>c.player.id));
  w=D.advanceSeasonWorld(w);
  const left=(w.overseasCareers??[]).filter(c=>!abroadBefore.has(c.player.id));
  europe.push({seed,season:w.season-1,left:left.length,eligible:eligible.length,players:left.map(c=>({name:c.player.name,age:c.player.age,ov:ov(c.player),from:c.fromClubId,to:c.destination?.country}))});
  const after=new Map(w.clubs.flatMap(c=>c.players.map(p=>[p.id,p])));
  // Talent terciles per category, by potential.
  for(const cat of ['M17','M19']){
   // Talent tercile: the room the projection gives him at the start of the season.
   const room=p=>E.developmentProfile(p).projection-p.ov;
   const list=[...before.values()].filter(p=>p.squad===cat&&after.has(p.id)).sort((a,b)=>room(b)-room(a)||b.ov-a.ov);
   list.forEach((p,i)=>{const t=i<list.length/3?'alto':i<2*list.length/3?'medio':'bajo';youthD[cat][t].push(ov(after.get(p.id))-p.ov);});
  }
  for(const p of before.values()){
   if(p.squad!=='Plantel superior'||!after.has(p.id))continue;
   const d=ov(after.get(p.id))-p.ov;(ageD[ageGroup(p)]??=[]).push(d);
   if(p.ov>=72&&(p.age??(p.trajectory?.seasons>=6?31:0))>=30)grandes.push(d);
  }
 }
 const end=new Map(w.clubs.flatMap(c=>c.players.map(p=>[p.id,p])));
 for(const k of careers.filter(k=>k.seed===seed)){const p=end.get(k.id);if(p){k.end=ov(p);k.projection=E.developmentProfile(p).projection;}}
 console.error('seed',seed,'done');
}
const summary=a=>({n:a.length,media:mean(a),p10:q(a,.1),p50:q(a,.5),p90:q(a,.9)});
const report={seeds:SEEDS,seasons:SEASONS,
 juveniles:Object.fromEntries(Object.entries(youthD).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([t,a])=>[t,summary(a)]))])),
 plantelSuperiorPorEdad:Object.fromEntries(Object.entries(ageD).map(([k,a])=>[k,summary(a)])),
 grandes30mas:summary(grandes),
 europa:{porTemporada:summary(europe.map(e=>e.left)),elegibles:summary(europe.map(e=>e.eligible)),probabilidad:+(europe.reduce((n,e)=>n+e.left,0)/Math.max(1,europe.reduce((n,e)=>n+e.eligible,0))).toFixed(3),ejemplos:europe.flatMap(e=>e.players).slice(0,12)},
 divisionesXV:Object.fromEntries(Object.entries(divXV).map(([d,a])=>[d,a.map(x=>mean(x))])),
 carreraM17:(()=>{const l=careers.filter(k=>k.end!=null).sort((a,b)=>b.room-a.room),t=n=>l.slice(Math.floor(l.length*n/3),Math.floor(l.length*(n+1)/3));
  return Object.fromEntries(['alto','medio','bajo'].map((name,i)=>{const g=t(i);return [name,{n:g.length,margenInicial:mean(g.map(k=>k.room)),inicio:mean(g.map(k=>k.start)),fin:mean(g.map(k=>k.end)),crecimiento:summary(g.map(k=>k.end-k.start))}];}));})(),
 clubesXV:Object.fromEntries(['newman','casi','sic','alumni','hindu','regatas-bella-vista','champagnat'].map(id=>[id,clubs[id].map((x,i,a)=>x)]))};
await writeFile(R+OUT,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify(report,null,1));
