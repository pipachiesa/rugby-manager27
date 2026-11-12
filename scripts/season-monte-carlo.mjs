#!/usr/bin/env node
/**
 * Monte Carlo of the 2026 season: each sample builds a fresh league (as tests/season.test.mjs does) with a different
 * seed, plays the 26 rounds with advanceWorld and records the final table of each division. Seasons are NOT chained.
 *
 * Uso: node scripts/season-monte-carlo.mjs [--seasons 1000] [--minutes 25] [--seed0 1000] [--out research/history/season-monte-carlo.json]
 * Requiere `npm run build` (web/engine.js). Stops early when --minutes is exhausted and reports how many seasons ran.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { mergeResearch } from './merge-research.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv, arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const SEASONS = Number(arg('--seasons', 1000)), MINUTES = Number(arg('--minutes', 25)), SEED0 = Number(arg('--seed0', 1000));
const OUT = arg('--out', 'research/history/season-monte-carlo.json');
const j = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const { initialWorld, advanceWorld } = await import(join(ROOT, 'web/domain.js'));
const E = await import(join(ROOT, 'web/engine.js'));
const returns = await j('research/returns.json');
const catalog = mergeResearch(await j('research/catalog.json'), await j('research/age-verification.json'), returns);
const youth = await j('research/youth.json'), names = await j('research/names.json');
const real = Object.fromEntries(catalog.clubs.filter(c => c.historical2026).map(c => [c.id, c.historical2026]));
const nameOf = Object.fromEntries(catalog.clubs.map(c => [c.id, c.name ?? c.shortName ?? c.id]));

const acc = {}; // division -> clubId -> {pos:[...counts], sumPos, sumPts, first, top4, bottom2}
let done = 0; const t0 = Date.now();
for (let s = 0; s < SEASONS; s++) {
  if ((Date.now() - t0) / 60000 > MINUTES) break;
  let w = initialWorld(catalog, SEED0 + s, returns, youth, names);
  while (w.fixtures.some(f => !f.match)) w = advanceWorld(w);
  for (const division of ['Top 14', 'Primera A', 'Primera B']) {
    const table = E.getStandings(w, division), n = table.length;
    table.forEach((r, i) => {
      const a = ((acc[division] ??= {})[r.clubId] ??= { n, hist: Array(n).fill(0), sumPos: 0, sumPts: 0, sumDiff: 0, first: 0, top4: 0, bottom2: 0 });
      a.hist[i]++; a.sumPos += i + 1; a.sumPts += r.points; a.sumDiff += r.pointsFor - r.pointsAgainst;
      a.first += i === 0; a.top4 += i < 4; a.bottom2 += i >= n - 2;
    });
  }
  done++;
  if (done % 50 === 0) console.error(`${done} temporadas, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = Array(a.length); idx.forEach(([, i], k) => r[i] = k + 1); return r; };
const spearman = (x, y) => { const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v) / n, mb = b.reduce((s, v) => s + v) / n;
  let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
const r1 = x => Math.round(x * 10) / 10, r3 = x => Math.round(x * 1000) / 1000;
const report = { generatedAt: new Date().toISOString(), seasons: done, minutes: r1((Date.now() - t0) / 60000), seed0: SEED0, divisions: {} };
for (const [division, clubs] of Object.entries(acc)) {
  const rows = Object.entries(clubs).map(([id, a]) => ({ id, name: nameOf[id], meanPos: r1(a.sumPos / done * 10) / 10, meanPoints: r1(a.sumPts / done), meanDiff: r1(a.sumDiff / done),
    pFirst: r1(100 * a.first / done), pTop4: r1(100 * a.top4 / done), pBottom2: r1(100 * a.bottom2 / done),
    realRank: real[id]?.rank ?? null, realPoints: real[id]?.tablePoints ?? null })).sort((a, b) => a.meanPos - b.meanPos);
  rows.forEach(r => r.meanPos = Math.round(r.meanPos * 100) / 100);
  const withReal = rows.filter(r => r.realRank);
  report.divisions[division] = { spearman: withReal.length > 2 ? r3(spearman(withReal.map(r => r.meanPos), withReal.map(r => r.realRank))) : null,
    pointsRMSE: r1(Math.sqrt(withReal.reduce((s, r) => s + (r.meanPoints - r.realPoints) ** 2, 0) / withReal.length)), rows };
}
await writeFile(resolve(ROOT, OUT), JSON.stringify(report, null, 1));
console.log(`${done} temporadas en ${report.minutes} min -> ${OUT}`);
for (const [d, v] of Object.entries(report.divisions)) { console.log(`\n${d}  Spearman ${v.spearman}  RMSE pts ${v.pointsRMSE}`);
  for (const r of v.rows) console.log(`${String(r.meanPos).padStart(5)} real ${String(r.realRank ?? '-').padStart(2)}  ${r.id.padEnd(24)} pts ${String(r.meanPoints).padStart(5)} (real ${r.realPoints})  1º ${r.pFirst}%  top4 ${r.pTop4}%  desc ${r.pBottom2}%`); }
