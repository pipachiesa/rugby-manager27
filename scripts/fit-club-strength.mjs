#!/usr/bin/env node
/**
 * Fits catalogue club strengths so the expected season table matches the real 2026 table, discounting the luck of a
 * single season: target = division mean + R × (real points − mean), with R = 0.85 (about 10 table points of luck per
 * club and season against a 25-point spread). Iterates: simulate N seasons, move each strength by the gap / SLOPE.
 * Writes research/history/strength-fit.json; does not edit the catalogue. Usage: node scripts/fit-club-strength.mjs [iters] [seasons]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mergeResearch } from './merge-research.mjs';
const ROOT = new URL('..', import.meta.url).pathname, j = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const ITERS = Number(process.argv[2] || 4), N = Number(process.argv[3] || 40), R = .85, PTS_PER_STRENGTH = 2.6;
const { initialWorld, advanceWorld } = await import(join(ROOT, 'web/domain.js')); const E = await import(join(ROOT, 'web/engine.js'));
const returns = await j('research/returns.json'), base = mergeResearch(await j('research/catalog.json'), await j('research/age-verification.json'), returns);
const youth = await j('research/youth.json'), names = await j('research/names.json');
const DIV = { 'Top 14': 'top14', 'Primera A': 'primera-a', 'Primera B': 'primera-b' };
const clubs = base.clubs.filter(c => Object.values(DIV).includes(c.competitionId) && c.historical2026);
const target = {};
for (const comp of Object.values(DIV)) { const cs = clubs.filter(c => c.competitionId === comp), m = cs.reduce((a, c) => a + c.historical2026.tablePoints, 0) / cs.length;
  for (const c of cs) target[c.id] = m + R * (c.historical2026.tablePoints - m); }
const strength = Object.fromEntries(clubs.map(c => [c.id, c.strength])), start = { ...strength }, log = [];
for (let it = 0; it <= ITERS; it++) {
  const catalog = { ...base, clubs: base.clubs.map(c => c.id in strength ? { ...c, strength: strength[c.id] } : c) }, pts = {};
  for (let s = 0; s < N; s++) {
    let w = initialWorld(catalog, 9000 + s, returns, youth, names);
    while (w.fixtures.some(f => !f.match && !f.stage)) w = advanceWorld(w);
    for (const d of Object.keys(DIV)) for (const r of E.getStandings(w, d)) pts[r.clubId] = (pts[r.clubId] ?? 0) + r.points / N;
  }
  const gaps = clubs.map(c => target[c.id] - pts[c.id]), rmse = Math.sqrt(gaps.reduce((a, g) => a + g * g, 0) / gaps.length);
  log.push({ iteration: it, rmse: Math.round(rmse * 10) / 10 });
  console.log(`iteración ${it}: error medio ${rmse.toFixed(1)} puntos`);
  if (it === ITERS) { await writeFile(join(ROOT, 'research/history/strength-fit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), seasonsPerIteration: N, R, log,
    clubs: clubs.map(c => ({ id: c.id, division: c.competitionId, from: start[c.id], to: strength[c.id], simPoints: Math.round(pts[c.id] * 10) / 10, target: Math.round(target[c.id] * 10) / 10, real: c.historical2026.tablePoints })) }, null, 1)); break; }
  for (const c of clubs) strength[c.id] = Math.round(Math.max(42, Math.min(96, strength[c.id] + .8 * (target[c.id] - pts[c.id]) / PTS_PER_STRENGTH)));
}
for (const c of clubs) if (strength[c.id] !== start[c.id]) console.log(`${c.id.padEnd(24)} ${start[c.id]} → ${strength[c.id]}`);
