#!/usr/bin/env node
/**
 * Compares the spread of a single simulated season table with the real 2026 table: standard deviation of table
 * points and the points of the 1st, 4th, 13th and 14th. The average of many seasons is always flatter than one real
 * season (luck averages out), so this is the fair comparison. Usage: node scripts/season-spread-check.mjs [seasons] [seed0]
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mergeResearch } from './merge-research.mjs';
const ROOT = new URL('..', import.meta.url).pathname, j = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const N = Number(process.argv[2] || 40), SEED0 = Number(process.argv[3] || 7000);
const { initialWorld, advanceWorld } = await import(join(ROOT, 'web/domain.js')); const E = await import(join(ROOT, 'web/engine.js'));
const returns = await j('research/returns.json'), catalog = mergeResearch(await j('research/catalog.json'), await j('research/age-verification.json'), returns);
const youth = await j('research/youth.json'), names = await j('research/names.json');
const sd = xs => { const m = xs.reduce((a, b) => a + b) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };
const DIV = { 'Top 14': 'top14', 'Primera A': 'primera-a', 'Primera B': 'primera-b' }, acc = {};
for (let s = 0; s < N; s++) {
  let w = initialWorld(catalog, SEED0 + s, returns, youth, names);
  while (w.fixtures.some(f => !f.match && !f.stage)) w = advanceWorld(w);
  for (const d of Object.keys(DIV)) { const pts = E.getStandings(w, d).map(r => r.points); (acc[d] ??= []).push([sd(pts), pts[0], pts[3], pts[12], pts[13]]); }
}
for (const [d, rows] of Object.entries(acc)) {
  const real = catalog.clubs.filter(c => c.competitionId === DIV[d] && c.historical2026).map(c => c.historical2026.tablePoints).sort((a, b) => b - a);
  const m = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
  console.log(`${d}: SD de puntos sim ${m(0)} (real ${sd(real).toFixed(1)}) · 1º ${m(1)} (${real[0]}) · 4º ${m(2)} (${real[3]}) · 13º ${m(3)} (${real[12]}) · 14º ${m(4)} (${real[13]})`);
}
