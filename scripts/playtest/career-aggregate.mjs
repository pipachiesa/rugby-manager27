#!/usr/bin/env node
// Aggregates research/playtest/raw/*.jsonl into markdown tables on stdout.
import {readdirSync,readFileSync} from 'node:fs';
const dir=new URL('../../research/playtest/raw/',import.meta.url).pathname;
const runs=readdirSync(dir).filter(f=>f.endsWith('.jsonl')).flatMap(f=>readFileSync(dir+f,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)));
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN,f1=x=>Number.isFinite(x)?x.toFixed(1):'-',pct=x=>Math.round(x*100)+'%';
const by={};for(const r of runs)(by[r.clubId+'|'+r.policy]??=[]).push(r);
const nm={champagnat:'Champagnat (Top 14, 14º en fuerza)',geba:'GEBA (Primera A, 7º)',delta:'Delta (Primera B, 12º)'};
for(const club of ['champagnat','geba','delta'])for(const policy of ['passive','active']){
 const rs=by[club+'|'+policy];if(!rs)continue;const n=rs.length;
 console.log(`\n### ${nm[club]} — ${policy} (${n} carreras)\n`);
 console.log('| Temporada | Div. jugada (T14/PA/PB) | Puesto medio | % Top 14 | % playoffs | % título (Top 14) | XV del club | XV top-4 | XV propio - top-4 |\n|---|---|---|---|---|---|---|---|---|');
 for(let s=0;s<5;s++){const x=rs.map(r=>r.seasons[s]);
  const t14=x.filter(a=>a.division==='Top 14');
  console.log(`| ${2026+s} | T14 ${x.filter(a=>a.division==='Top 14').length} / PA ${x.filter(a=>a.division==='Primera A').length} / PB ${x.filter(a=>a.division==='Primera B').length} | ${f1(avg(x.map(a=>a.pos)))} | ${pct(t14.length/n)} | ${pct(x.filter(a=>a.division==='Top 14'&&a.playoffs).length/n)} | ${pct(x.filter(a=>a.champion).length/n)} | ${f1(avg(x.map(a=>a.xv)))} | ${f1(avg(x.map(a=>a.top4xv)))} | ${f1(avg(x.map(a=>a.xv-a.top4xv)))} |`);}
 const ever=p=>rs.filter(r=>r.seasons.some(p)).length/n;
 const top14ever=rs.filter(r=>r.seasons.some(a=>a.division==='Top 14')).length/n;
 const promoted=rs.map(r=>r.seasons.filter(a=>a.nextDivision!==a.division&&['Top 14','Primera A'].includes(a.nextDivision)&&(a.division!=='Top 14')).length);
 const relegated=rs.map(r=>r.seasons.filter(a=>a.nextDivision!==a.division&&(a.division==='Top 14'||(a.division==='Primera A'&&a.nextDivision==='Primera B'))).length);
 const lastTop=rs.filter(r=>r.seasons[4].nextDivision==='Top 14').length/n;
 // First Top 14 season within the 5 seasons (playing it) or promoted at end of season 5.
 const reachW5=rs.filter(r=>r.seasons.slice(0,5).some((a,i)=>a.division==='Top 14'||a.nextDivision==='Top 14')).length/n;
 console.log(`\nP(jugar Top 14 en alguna de las 5 temporadas) = ${pct(top14ever)}; P(estar en Top 14 en la 5ª o ascender al cierre) = ${pct(reachW5)}; P(Top 14 en la 5ª) = ${pct(rs.filter(r=>r.seasons[4].division==='Top 14').length/n)}`);
 console.log(`P(algún playoff del Top 14) = ${pct(ever(a=>a.division==='Top 14'&&a.playoffs))}; P(título URBA) = ${pct(ever(a=>a.champion))}; P(finalista) = ${pct(ever(a=>a.finalist))}; P(campeón/ascenso de A o B) = ${pct(ever(a=>a.divisionTitle))}`);
 console.log(`Ascensos medios por carrera = ${f1(avg(promoted))}; descensos medios = ${f1(avg(relegated))}; plantel superior al final = ${f1(avg(rs.map(r=>r.seasons[4].squad)))}; fichajes aceptados en 5 temporadas = ${f1(avg(rs.map(r=>r.seasons[4].stats.accepted)))} de ${f1(avg(rs.map(r=>r.seasons[4].stats.contacts)))} contactos; sesiones = ${f1(avg(rs.map(r=>r.seasons[4].stats.trained)))}; promovidos = ${f1(avg(rs.map(r=>r.seasons[4].stats.promoted)))}`);
}
// Drift of the league (same across clubs: use all runs, per policy).
console.log('\n### Deriva de la liga (XV medio por división y de los grandes, promedio de todas las carreras)\n');
console.log('| Política | Temporada | Top 14 | Primera A | Primera B | Newman | CASI | SIC | Alumni | Hindú |\n|---|---|---|---|---|---|---|---|---|---|');
for(const policy of ['passive','active'])for(let s=0;s<5;s++){const x=runs.filter(r=>r.policy===policy).map(r=>r.seasons[s]);
 console.log(`| ${policy} | ${2026+s} | ${f1(avg(x.map(a=>a.divXv['Top 14'])))} | ${f1(avg(x.map(a=>a.divXv['Primera A'])))} | ${f1(avg(x.map(a=>a.divXv['Primera B'])))} | ${['newman','casi','sic','alumni','hindu'].map(k=>f1(avg(x.map(a=>a.big[k])))).join(' | ')} |`);}
