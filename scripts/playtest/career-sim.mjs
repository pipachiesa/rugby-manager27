#!/usr/bin/env node
/**
 * Career playtest: one managed club, several seasons chained with advanceSeasonWorld (playoffs included).
 * Usage: node scripts/playtest/career-sim.mjs <clubId> <passive|active|market|training> <seedFrom> <seedTo> <seasons> <out.jsonl>
 * (requires npm run build). One JSON line per career.
 *
 * POLICIES
 *  passive: never acts; the club keeps its AI defaults (best XV is picked automatically, default tactics).
 *  active (a sensible human manager, simple on purpose), every round, before advancing:
 *   - lineup: sets the best available XV (autoLineup), after training / signings;
 *   - youth plan (round 1): Contacto if most M17/M19 are forwards, else Tecnica;
 *   - promotion (round 1): up to 2 best M19 whose level is at least that of the 3rd best senior in his position;
 *   - market: ONE contact per round (the maximum allowed). Target = player of a club without manager who would
 *     improve the XV by >= 1.5 points at a slot he can play; ranked by (gain x interest chance offering 'XV');
 *     needs chance >= 0.2; skips refused players and a full squad (130);
 *   - training: ONE individual session per round (the maximum). Candidates: XV starters with fitness >= 90 (the
 *     session costs 10) and the 6 best non-starters; picks the player/attribute with the greatest rating weight that
 *     can still develop (below potential); injured players excluded;
 *   - tactics (round 1 and after signings): forwards stronger than backs -> Defensiva/Presion/Competir; backs
 *     stronger -> Ofensiva/2-4-2; otherwise defaults. Never uses retraining (kept simple).
 */
import {readFile,appendFile} from 'node:fs/promises';
const R=new URL('../..',import.meta.url).pathname;
const E=await import(R+'web/engine.js');const D=await import(R+'web/domain.js');
const j=async p=>JSON.parse(await readFile(R+p,'utf8'));
const [cat,ret,youth,names]=await Promise.all(['research/catalog.json','research/returns.json','research/youth.json','research/names.json'].map(j));
const [clubId,policy,s0,s1,SEASONS,out]=[process.argv[2],process.argv[3],+process.argv[4],+process.argv[5],+(process.argv[6]||5),process.argv[7]];
const ov=p=>E.overall(p),FWD=new Set(E.POSITIONS.slice(0,8));
const club=w=>w.clubs.find(c=>c.id===clubId);
const sen=c=>c.players.filter(p=>p.squad==='Plantel superior');
const xvAvg=c=>{const ids=E.autoLineup(c),m=new Map(c.players.map(p=>[p.id,p]));return ids.reduce((n,i)=>n+ov(m.get(i)),0)/ids.length;};
const tryDo=(w,f)=>{try{return f(w);}catch(e){return w;}};
const stats={contacts:0,accepted:0,trained:0,promoted:0};
function setBest(w){return tryDo(w,w=>D.applyClubAction(w,clubId,'lineup',{ids:E.autoLineup(club(w))}));}
function tactics(w){
 const c=club(w),m=new Map(c.players.map(p=>[p.id,p])),ids=E.autoLineup(c);
 const f=ids.filter((_,i)=>FWD.has(E.POSITIONS[i])).map(i=>ov(m.get(i))),b=ids.filter((_,i)=>!FWD.has(E.POSITIONS[i])).map(i=>ov(m.get(i)));
 const avg=a=>a.reduce((x,y)=>x+y,0)/a.length,d=avg(f)-avg(b);
 const t={...E.DEFAULT_TACTICS};
 if(d>=2)Object.assign(t,{mentality:'Defensiva',scrum:'Presión',lineout:'Competir'});
 else if(d<=-2)Object.assign(t,{mentality:'Ofensiva',attack:'2-4-2'});
 return tryDo(w,w=>D.applyClubAction(w,clubId,'tactics',{tactics:t}));
}
function youthPlan(w){
 const j=club(w).players.filter(p=>p.squad==='M19'||p.squad==='M17'),fw=j.filter(p=>FWD.has(p.position)).length;
 return tryDo(w,w=>D.applyClubAction(w,clubId,'youth-training',{plan:fw*2>j.length?'Contacto':'Técnica'}));
}
function promote(w){
 const c=club(w),s=sen(c);let n=0;
 const ranked=c.players.filter(p=>p.squad==='M19'&&!p.injury).sort((a,b)=>ov(b)-ov(a));
 for(const p of ranked){if(n>=2)break;
  const peers=s.filter(q=>q.position===p.position).map(ov).sort((a,b)=>b-a),bar=peers[2]??0;
  if(ov(p)>=bar){w=tryDo(w,w=>D.applyClubAction(w,clubId,'promote',{playerId:p.id}));n++;stats.promoted++;}}
 return w;
}
function market(w){
 const round=D.roundOf(w);if(!Number.isFinite(round))return w;
 const c=club(w);if(sen(c).length>=D.SQUAD_LIMIT)return w;
 const m=new Map(c.players.map(p=>[p.id,p])),xv=E.autoLineup(c).map(i=>m.get(i));
 const refused=new Set(w.transfers?.refused?.[clubId]??[]),managed=new Set(w.managedClubs??[]);
 let best=null;
 for(const o of w.clubs){if(o.id===clubId||managed.has(o.id))continue;
  for(const p of sen(o)){if(refused.has(p.id)||p.injury)continue;
   let gain=-99;for(let i=0;i<15;i++)if(E.canPlay(p,E.POSITIONS[i]))gain=Math.max(gain,ov(p)-ov(xv[i]));
   if(gain<1.5)continue;
   const ti=D.transferInterest(w,clubId,o.id,p,'XV');if(ti.chance<.2)continue;
   const score=gain*ti.chance;if(!best||score>best.score)best={score,id:p.id,gain};}}
 if(!best)return w;
 const before=w;stats.contacts++;
 w=tryDo(w,w=>D.applyClubAction(w,clubId,'contact-player',{playerId:best.id,offer:'XV'}));
 if(w!==before&&sen(club(w)).some(p=>p.id===best.id))stats.accepted++;
 return w;
}
function train(w){
 const c=club(w),xv=new Set(E.autoLineup(c)),s=sen(c).filter(p=>!p.injury);
 const cand=[...s.filter(p=>xv.has(p.id)&&p.fitness>=90),...s.filter(p=>!xv.has(p.id)).sort((a,b)=>ov(b)-ov(a)).slice(0,6)];
 let best=null;
 for(const p of cand){const wts=E.ratingWeights[p.position]??{};
  for(const [a,wt] of Object.entries(wts))if(E.canDevelopAttribute(p,a,w.season)&&(!best||wt>best.wt))best={wt,p:p.id,a};}
 if(!best)return w;
 const before=w;w=tryDo(w,w=>D.applyClubAction(w,clubId,'train-player',{playerId:best.p,attribute:best.a}));if(w!==before)stats.trained++;return w;
}
function snapshot(w,startDivision){
 const c=club(w),d=c.division;
 const table=E.getStandings(w,d),pos=table.findIndex(r=>r.clubId===clubId)+1,n=table.length;
 const top=E.getStandings(w,'Top 14');
 const top14=w.clubs.filter(x=>x.division==='Top 14').map(x=>({id:x.id,xv:xvAvg(x)})).sort((a,b)=>b.xv-a.xv);
 const st=D.playoffState(w,d),po=d==='Top 14'?st.seeds.includes(clubId):st.seeds.includes(clubId)||pos===1;
 const champ=d==='Top 14'&&st.winner===clubId,finalist=d==='Top 14'&&st.final?.match&&[st.final.homeId,st.final.awayId].includes(clubId);
 return {season:w.season,division:d,pos,n,playoffs:po,champion:champ,finalist:!!finalist,divisionTitle:d!=='Top 14'&&(pos===1||st.winner===clubId),
  xv:+xvAvg(c).toFixed(2),top4xv:+(top14.slice(0,4).reduce((a,b)=>a+b.xv,0)/4).toFixed(2),
  divXv:Object.fromEntries(['Top 14','Primera A','Primera B'].map(dv=>{const l=w.clubs.filter(x=>x.division===dv).map(xvAvg);return [dv,+(l.reduce((a,b)=>a+b,0)/l.length).toFixed(2)];})),
  big:Object.fromEntries(['newman','casi','sic','alumni','hindu'].map(id=>[id,+xvAvg(w.clubs.find(x=>x.id===id)).toFixed(2)])),
  squad:sen(c).length,moved:w.clubs.find(x=>x.id===clubId).division,pointsFor:table[pos-1].points};
}
for(let seed=s0;seed<=s1;seed++){
 let w=D.initialWorld(cat,seed*101,ret,youth,names);const keep=new Set([clubId]);
 for(const k of Object.keys(stats))stats[k]=0;
 const seasons=[];seasons.push({season:2026,start:+xvAvg(club(w)).toFixed(2),startDivision:club(w).division});
 let first=true;
 for(let s=0;s<SEASONS;s++){
  const startDiv=club(w).division,startXv=+xvAvg(club(w)).toFixed(2);
  const A=policy==='active',M=A||policy==='market',T=A||policy==='training';
  if(M||T){if(T){w=youthPlan(w);w=promote(w);}if(M)w=market(w);w=setBest(w);w=tactics(w);}
  while(w.fixtures.some(f=>!f.match)){
   if(M||T){if(M)w=market(w);if(T)w=train(w);w=setBest(w);}
   w=D.advanceWorld(w,keep);
  }
  const snap=snapshot(w,startDiv);snap.startDivision=startDiv;snap.startXv=startXv;snap.stats={...stats};
  const nextDivs=D.seasonMoves(w);snap.nextDivision=nextDivs[clubId]??snap.division;
  seasons.push(snap);
  if(s<SEASONS-1)w=D.advanceSeasonWorld(w);
 }
 await appendFile(out,JSON.stringify({clubId,policy,seed,seasons:seasons.slice(1)})+'\n');
}
