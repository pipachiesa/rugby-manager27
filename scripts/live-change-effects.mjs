#!/usr/bin/env node
/**
 * What a live change at half-time does to the second half (requires npm run build).
 * Usage: node scripts/live-change-effects.mjs [matches=1500]
 * Same matches (seed, squads) played with and without the change; second-half counts for the side that changes.
 */
import {readFile} from 'node:fs/promises';
const R=new URL('..',import.meta.url).pathname;
const E=await import(R+'web/engine.js'),D=await import(R+'web/domain.js');
const j=async p=>JSON.parse(await readFile(R+p,'utf8'));
const w=D.initialWorld(await j('research/catalog.json'),11,await j('research/returns.json'),await j('research/youth.json'),await j('research/names.json'));
const N=+(process.argv[2]||1500),top=w.clubs.filter(c=>c.division==='Top 14');
const pairs=Array.from({length:N},(_,i)=>[top[i%14],top[(i*5+3)%14===i%14?((i%14)+1)%14:(i*5+3)%14],7000+i]);
const half=2400;
function count(m,club,rival){const ev=m.events.filter(e=>e.second>=half);const mine=e=>e.teamId===club,theirs=e=>e.teamId===rival;
 return {triesFor:ev.filter(e=>e.type==='try'&&mine(e)).length,triesAgainst:ev.filter(e=>e.type==='try'&&theirs(e)).length,
  pointsFor:ev.filter(mine).reduce((n,e)=>n+(e.points??0),0),pointsAgainst:ev.filter(theirs).reduce((n,e)=>n+(e.points??0),0),
  penaltiesConceded:ev.filter(e=>e.type==='infringement'&&theirs(e)).length+ev.filter(e=>e.type==='penalty'&&theirs(e)).length,
  yellow:ev.filter(e=>(e.type==='yellowCard'||e.type==='redCard')&&mine(e)).length,knockOns:ev.filter(e=>e.type==='knockOn'&&mine(e)).length,
  turnoversLost:ev.filter(e=>e.type==='turnover'&&theirs(e)).length,win:Math.sign((m.homeId===club?m.homeScore-m.awayScore:m.awayScore-m.homeScore))};}
const scenarios={
 'Ofensiva':()=>({tactics:{mentality:'Ofensiva'}}),
 'Defensiva':()=>({tactics:{mentality:'Defensiva'}}),
 'Rush':()=>({tactics:{defense:'Rush'}}),
 '2-4-2':()=>({tactics:{attack:'2-4-2'}}),
 'Ruck rápido':()=>({tactics:{ruck:'Rápido'}}),
 'Entra un apertura +3':(c,inp)=>({swaps:[{out:inp.lineup[9],in:'better-10'}]}),
 'Ofensiva + apertura +3':(c,inp)=>({tactics:{mentality:'Ofensiva'},swaps:[{out:inp.lineup[9],in:'better-10'}]}),
};
const sum={},base={};
for(const [h,a,seed] of pairs){
 const inH=E.matchInputs(h),inA=E.matchInputs(a);
 const fly=inH.players[9],better={...fly,id:'better-10',name:'Mejor apertura',attributes:Object.fromEntries(Object.entries(fly.attributes).map(([k,v])=>[k,Math.min(20,v+3)]))};
 const H={...h,players:[...inH.players,better],lineup:inH.lineup,bench:[...inH.bench]},A={...a,players:inA.players,lineup:inA.lineup,bench:inA.bench};
 const m0=E.generateMatch(H,A,E.DEFAULT_TACTICS,E.DEFAULT_TACTICS,seed,false);const c0=count(m0,h.id,a.id);
 for(const [k,v] of Object.entries(c0))base[k]=(base[k]??0)+v;
 for(const [name,make] of Object.entries(scenarios)){const m=E.generateMatch(H,A,E.DEFAULT_TACTICS,E.DEFAULT_TACTICS,seed,false,false,[{second:half,clubId:h.id,...make(h,inH)}]);
  const c=count(m,h.id,a.id);sum[name]??={};for(const [k,v] of Object.entries(c))sum[name][k]=(sum[name][k]??0)+v;}
}
const per=(o)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,+(v/N).toFixed(3)]));
console.log('Segundo tiempo, por partido, del equipo que cambia (N='+N+')');
console.log('sin cambio',JSON.stringify(per(base)));
for(const [n,o] of Object.entries(sum)){const p=per(o),b=per(base);console.log(n.padEnd(24),Object.entries(p).map(([k,v])=>k+' '+(v-b[k]>=0?'+':'')+(v-b[k]).toFixed(2)).join(' · '));}
