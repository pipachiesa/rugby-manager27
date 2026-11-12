#!/usr/bin/env node
/**
 * Promoted and relegated clubs over two simulated seasons (first season in the new division), to compare with real
 * URBA promoted clubs 2018-2026 (26 % wins, -11 margin). Usage: node scripts/promotion-check.mjs [A] [B] [seeds]
 * (requires npm run build). A and B override DIVISION_BASELINE for Primera A and B.
 */
import {readFile} from 'node:fs/promises';
const R=new URL('..', import.meta.url).pathname;
const E=await import(R+'web/engine.js');const D=await import(R+'web/domain.js');
const j=async p=>JSON.parse(await readFile(R+p,'utf8'));
const [cat,ret,youth,names]=await Promise.all(['research/catalog.json','research/returns.json','research/youth.json','research/names.json'].map(j));
const [A,B,N]=[+(process.argv[2]||E.DIVISION_BASELINE['Primera A']),+(process.argv[3]||E.DIVISION_BASELINE['Primera B']),+(process.argv[4]||3)];
E.DIVISION_BASELINE['Primera A']=A;E.DIVISION_BASELINE['Primera B']=B;
const stats={upTop:[],downA:[],upA:[],downB:[]};
const rec=(w,c)=>{let n=0,win=0,m=0;for(const f of w.fixtures.filter(f=>f.homeId===c||f.awayId===c)){const d=(f.match.homeScore-f.match.awayScore)*(f.homeId===c?1:-1);n++;m+=d;if(d>0)win++;}return [win/n,m/n];};
for(let seed=1;seed<=N;seed++){
 let w=D.initialWorld(cat,seed*101,ret,youth,names);const keep=new Set();
 for(let r=0;r<26;r++)w=D.advanceWorld(w,keep);
 const prev=Object.fromEntries(w.clubs.map(c=>[c.id,c.division]));
 w=D.advanceSeasonWorld(w);for(let r=0;r<26;r++)w=D.advanceWorld(w,keep);
 for(const c of w.clubs){const was=prev[c.id];if(was===c.division)continue;const k=was==='Primera A'&&c.division==='Top 14'?'upTop':was==='Top 14'?'downA':was==='Primera B'?'upA':'downB';stats[k].push(rec(w,c.id));}
}
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
for(const [k,v] of Object.entries(stats))console.log(k.padEnd(6),'win%',Math.round(100*avg(v.map(x=>x[0]))),'margin',Math.round(avg(v.map(x=>x[1]))*10)/10,'n',v.length);
