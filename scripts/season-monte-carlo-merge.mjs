#!/usr/bin/env node
/**
 * Merges several runs of scripts/season-monte-carlo.mjs (different --seed0, run in parallel) into one report,
 * weighting each run by its number of seasons. Usage: node scripts/season-monte-carlo-merge.mjs out.json part1.json part2.json …
 */
import { readFile, writeFile } from 'node:fs/promises';
const [out, ...parts] = process.argv.slice(2);
const runs = await Promise.all(parts.map(async p => JSON.parse(await readFile(p, 'utf8'))));
const total = runs.reduce((n, r) => n + r.seasons, 0);
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = Array(a.length); idx.forEach(([, i], k) => r[i] = k + 1); return r; };
const spearman = (x, y) => { const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v) / n, mb = b.reduce((s, v) => s + v) / n;
  let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
const report = { generatedAt: new Date().toISOString(), seasons: total, runs: runs.map(r => ({ seed0: r.seed0, seasons: r.seasons })), divisions: {} };
for (const division of Object.keys(runs[0].divisions)) {
  const ids = runs[0].divisions[division].rows.map(r => r.id);
  const rows = ids.map(id => { const rs = runs.map(r => [r.seasons, r.divisions[division].rows.find(x => x.id === id)]), w = k => rs.reduce((s, [n, x]) => s + n * x[k], 0) / total, base = rs[0][1];
    return { id, name: base.name, meanPos: r2(w('meanPos')), meanPoints: r1(w('meanPoints')), meanDiff: r1(w('meanDiff')), pFirst: r1(w('pFirst')), pTop4: r1(w('pTop4')), pBottom2: r1(w('pBottom2')), realRank: base.realRank, realPoints: base.realPoints }; })
    .sort((a, b) => a.meanPos - b.meanPos);
  const real = rows.filter(r => r.realRank);
  report.divisions[division] = { spearman: Math.round(spearman(real.map(r => r.meanPos), real.map(r => r.realRank)) * 1000) / 1000,
    pointsRMSE: r1(Math.sqrt(real.reduce((s, r) => s + (r.meanPoints - r.realPoints) ** 2, 0) / real.length)), rows };
}
await writeFile(out, JSON.stringify(report, null, 1));
for (const [d, v] of Object.entries(report.divisions)) {
  console.log(`\n${d}  Spearman ${v.spearman}  RMSE pts ${v.pointsRMSE}  (${total} temporadas)`);
  for (const r of v.rows) console.log(`${String(r.meanPos).padStart(5)} real ${String(r.realRank).padStart(2)}  ${r.id.padEnd(24)} pts ${String(r.meanPoints).padStart(5)} (real ${r.realPoints})  1º ${r.pFirst}%  top4 ${r.pTop4}%  últimos2 ${r.pBottom2}%`);
}
