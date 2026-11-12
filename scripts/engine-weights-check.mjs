#!/usr/bin/env node
/**
 * How much each factor moves a match in the REAL built engine (web/engine.js; run `npm run build` first).
 * Factors: home (HOME_EDGE), day form (DAY_FORM), squad level (attributes), club level (catalogue strength / division),
 * tactics, fitness, injuries, and the residual randomness. HOME_EDGE and DAY_FORM are constants, so the "off" cases
 * use copies of web/engine.js with the constant set to 0 (written to the OS temp dir; web/ is never touched).
 *
 * Uso: node scripts/engine-weights-check.mjs [--n 3000] [--seasons 40] [--out research/history/engine-weights.json]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mergeResearch } from './merge-research.mjs';
import { mean, sd, r1, r2 } from './history-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv, arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const N = Number(arg('--n', 3000)), SEASONS = Number(arg('--seasons', 40)), OUT = arg('--out', 'research/history/engine-weights.json');
const j = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const src = await readFile(join(ROOT, 'web/engine.js'), 'utf8');
const dir = join(tmpdir(), 'rm26-engine-variants'); await mkdir(dir, { recursive: true });
const variant = async (name, home, form) => { const p = join(dir, `engine-${name}.mjs`);
  await writeFile(p, src.replace(/^export const HOME_EDGE = [^;]+;/m, `export const HOME_EDGE = ${home};`).replace(/^export const DAY_FORM = [^;]+;/m, `export const DAY_FORM = ${form};`)); return import(p); };
const E = await import(join(ROOT, 'web/engine.js'));
const E_nohome = await variant('nohome', 0, E.DAY_FORM), E_noform = await variant('noform', E.HOME_EDGE, 0), E_none = await variant('none', 0, 0);
const { initialWorld } = await import(join(ROOT, 'web/domain.js'));
const returns = await j('research/returns.json');
const catalog = mergeResearch(await j('research/catalog.json'), await j('research/age-verification.json'), returns);
const world = initialWorld(catalog, 2026, returns, await j('research/youth.json'), await j('research/names.json'));
const byId = Object.fromEntries(world.clubs.map(c => [c.id, c]));
const T = (o = {}) => ({ ...E.DEFAULT_TACTICS, ...o });
const clone = (c, tag = 'c') => ({ ...c, id: c.id + '-' + tag, players: c.players.map(p => ({ ...p, id: p.id + '-' + tag, attributes: { ...p.attributes } })) });
const xvOverall = c => mean(c.players.filter(p => p.squad === 'Plantel superior' && !p.injury).sort((a, b) => E.overall(b) - E.overall(a)).slice(0, 15).map(p => E.overall(p)));

/** N seeded matches home vs away. Win probability counts draws as half. */
function run(eng, home, away, th = T(), ta = T(), n = N, seed0 = 0) {
  const m = []; for (let s = 0; s < n; s++) { const r = eng.generateMatch(home, away, th, ta, seed0 + s, false); m.push(r.homeScore - r.awayScore); }
  const w = m.filter(x => x > 0).length, d = m.filter(x => x === 0).length;
  return { margin: mean(m), sd: sd(m), winPct: 100 * (w + d / 2) / n, se: sd(m) / Math.sqrt(n) };
}
const fmt = (x, base) => ({ margin: r2(x.margin), deltaMargin: base ? r2(x.margin - base.margin) : 0, winPct: r1(x.winPct), deltaWinPct: base ? r1(x.winPct - base.winPct) : 0, sd: r1(x.sd), se: r2(x.se) });
const out = { generatedAt: new Date().toISOString(), n: N, constants: { HOME_EDGE: E.HOME_EDGE, DAY_FORM: E.DAY_FORM, DIVISION_BASELINE: E.DIVISION_BASELINE, TACTIC_TUNING: E.TACTIC_TUNING } };

// ---- 0. Baseline: a club against its own clone, home side listed first.
const newman = byId.newman, twin = clone(newman);
const base = run(E, newman, twin), baseNeutral = run(E_none, newman, twin), noHome = run(E_nohome, newman, twin), noForm = run(E_noform, newman, twin);
out.baseline = { homeAndForm: fmt(base), noHome: fmt(noHome, base), noForm: fmt(noForm, base), neutralNoForm: fmt(baseNeutral, base) };
out.home = { pointsOfMargin: r2(base.margin - noHome.margin), winPctHome: r1(base.winPct), note: 'club contra su clon: la localía es la diferencia con HOME_EDGE = 0' };
out.dayForm = { sdWith: r2(base.sd), sdWithout: r2(noForm.sd), sdOfDayFormComponent: r2(Math.sqrt(Math.max(0, base.sd ** 2 - noForm.sd ** 2))), note: 'el desvío de la forma del día es la raíz de la diferencia de varianzas de margen (σ² con − σ² sin DAY_FORM)' };

// ---- 1. Squad level: every player of the home club +k attribute points (1..20 scale).
const shifted = (c, k) => ({ ...c, id: c.id + '-s', players: c.players.map(p => ({ ...p, id: p.id + '-s', attributes: Object.fromEntries(Object.entries(p.attributes).map(([a, v]) => [a, Math.max(1, Math.min(20, v + k))])) })) });
out.squadLevel = [-2, -1, 1, 2].map(k => { const c = shifted(newman, k), r = run(E, c, twin); return { attributeShift: k, xvOverallDelta: r1(xvOverall(c) - xvOverall(newman)), ...fmt(r, base) }; });
const slope = out.squadLevel.filter(x => Math.abs(x.attributeShift) === 1).map(x => x.deltaMargin / x.xvOverallDelta);
out.pointsPerOverall = r2(mean(slope));

// ---- 2. Club level: catalogue strength -> squad -> margin. Same strength gap, both venues averaged (no home edge).
const both = (a, b) => (run(E, a, b, T(), T(), N / 2).margin + -run(E, b, a, T(), T(), N / 2, 7e6).margin) / 2;
const bothWin = (a, b) => (run(E, a, b, T(), T(), N / 2).winPct + (100 - run(E, b, a, T(), T(), N / 2, 7e6).winPct)) / 2;
const pairRow = (a, b) => ({ a: a.id, b: b.id, xvOverallA: r1(xvOverall(a)), xvOverallB: r1(xvOverall(b)), margin: r1(both(a, b)), winPctA: r1(bothWin(a, b)) });
const division = d => world.clubs.filter(c => c.division === d).sort((a, b) => xvOverall(a) - xvOverall(b));
const median = d => { const l = division(d); return l[l.length >> 1]; };
out.clubLevel = { best_vs_worst_top14: pairRow(division('Top 14').at(-1), division('Top 14')[0]), best_vs_median_top14: pairRow(division('Top 14').at(-1), median('Top 14')),
  median_top14_vs_median_primeraA: pairRow(median('Top 14'), median('Primera A')), median_primeraA_vs_median_primeraB: pairRow(median('Primera A'), median('Primera B')),
  median_top14_vs_median_primeraB: pairRow(median('Top 14'), median('Primera B')),
  xvOverallByDivision: Object.fromEntries(['Top 14', 'Primera A', 'Primera B'].map(d => [d, { min: r1(xvOverall(division(d)[0])), median: r1(xvOverall(median(d))), max: r1(xvOverall(division(d).at(-1))) }])) };

// ---- 3. Tactics: each option on the home side against a default clone (default 'Según marcador' etc.).
const options = { mentality: ['Ofensiva', 'Defensiva'], penalty: ['Palos', 'Touch'], attack: ['2-4-2'], defense: ['Rush'], scrum: ['Presión'], lineout: ['Competir'], maul: ['Evitar'], kicking: ['Conservador'], ruck: ['Rápido'] };
out.tactics = {};
for (const [k, vals] of Object.entries(options)) for (const v of vals) { const r = run(E, newman, twin, T({ [k]: v }), T(), N * 2); out.tactics[`${k}=${v}`] = fmt(r, run(E, newman, twin, T(), T(), N * 2)); }
{ // spread if both managers picked each option at random (additive): per category the options incl. the default
  const cats = { mentality: ['Equilibrada', 'Ofensiva', 'Defensiva'], penalty: ['Según marcador', 'Palos', 'Touch'], attack: ['1-3-3-1', '2-4-2'], defense: ['Drift', 'Rush'], scrum: ['Estable', 'Presión'], lineout: ['Seguro', 'Competir'], maul: ['Usar', 'Evitar'], kicking: ['Territorial', 'Conservador'], ruck: ['Asegurar', 'Rápido'] };
  const dflt = E.DEFAULT_TACTICS; let v = 0;
  for (const [k, vals] of Object.entries(cats)) { const eff = vals.map(x => x === dflt[k] ? 0 : out.tactics[`${k}=${x}`].deltaMargin); const m = mean(eff); v += eff.reduce((s, e) => s + (e - m) ** 2, 0) / eff.length; }
  out.tacticsRandomPick = { sdOneSide: r2(Math.sqrt(v)), sdBothSides: r2(Math.sqrt(2 * v)), maxAbsSingle: r2(Math.max(...Object.values(out.tactics).map(x => Math.abs(x.deltaMargin)))) };
}

// ---- 4. Fitness: whole home XV at x % fitness against a fresh clone (fitness 100).
const withFitness = (c, f) => ({ ...c, id: c.id + '-f', players: c.players.map(p => ({ ...p, id: p.id + '-f', fitness: f })) });
const fit100 = run(E, withFitness(newman, 100), twin);
out.fitness = [100, 92, 85, 70, 50].map(f => ({ fitness: f, ...fmt(run(E, withFitness(newman, f), twin), fit100) }));
out.fitnessBothTeams92 = fmt(run(E, withFitness(newman, 92), withFitness(twin, 92)), fit100);

// ---- 5. Injuries: injured starters replaced by the best available of their position.
const xvIds = E.effectiveLineup(newman);
const hurt = (c, ids) => ({ ...c, id: c.id + '-i', players: c.players.map(p => ({ ...p, id: p.id + '-i', injury: ids.includes(p.id) ? { type: 'x', weeksOut: 4 } : p.injury })), lineup: undefined });
const ref = run(E, hurt(newman, []), twin, T(), T(), N);
const single = xvIds.map(id => run(E, hurt(newman, [id]), twin, T(), T(), 800).margin - ref.margin);
out.injuries = { oneStarter: { mean: r2(mean(single)), worst: r2(Math.min(...single)), best: r2(Math.max(...single)) } };
const rngLCG = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
const sample = k => { const pool = [...xvIds], pick = []; while (pick.length < k) pick.push(pool.splice(Math.floor(rngLCG() * pool.length), 1)[0]); return pick; };
for (const k of [3, 5]) { const ds = Array.from({ length: 25 }, () => run(E, hurt(newman, sample(k)), twin, T(), T(), 600).margin - ref.margin); out.injuries[`${k}Starters`] = { mean: r2(mean(ds)), sd: r2(sd(ds)) }; }
out.injuries.starterGapToReplacement = r1(mean(xvIds.map(id => { const p = newman.players.find(x => x.id === id); const rep = newman.players.filter(q => q.squad === 'Plantel superior' && q.id !== id && q.position === p.position && !xvIds.includes(q.id)).sort((a, b) => E.overall(b) - E.overall(a))[0]; return rep ? E.overall(p) - E.overall(rep) : NaN; }).filter(Number.isFinite)));

// ---- 6. Variance decomposition over Top 14 double round robins (same squads, SEASONS different match seeds).
const top = world.clubs.filter(c => c.division === 'Top 14'), fx = catalog.fixtures.filter(f => f.competitionId === 'top14');
const ids = top.map(c => c.id), idx = Object.fromEntries(ids.map((id, i) => [id, i]));
function seasonRows(eng, tactics) { const rows = []; for (let s = 0; s < SEASONS; s++) for (const f of fx) { const th = tactics ? tactics(s, f, 0) : T(), ta = tactics ? tactics(s, f, 1) : T();
  const r = eng.generateMatch(byId[f.homeClubId], byId[f.awayClubId], th, ta, 991000 + s * 1000 + f.round * 20 + idx[f.homeClubId], false); rows.push({ h: idx[f.homeClubId], a: idx[f.awayClubId], m: r.homeScore - r.awayScore }); } return rows; }
function fitRatings(rows, withHome) { // ridge LS: m = H + r_h - r_a
  const K = ids.length, P = K + (withHome ? 1 : 0), A = Array.from({ length: P }, () => Array(P).fill(0)), b = Array(P).fill(0), lam = .01;
  for (const { h, a, m } of rows) { const x = Array(P).fill(0); x[h] = 1; x[a] = -1; if (withHome) x[K] = 1; for (let i = 0; i < P; i++) { b[i] += x[i] * m; for (let k = 0; k < P; k++) A[i][k] += x[i] * x[k]; } }
  for (let i = 0; i < K; i++) A[i][i] += lam; for (let i = 0; i < K; i++) for (let k = 0; k < K; k++) A[i][k] += 1e-3; // sum-to-zero-ish anchor
  const n = P; for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let k = i + 1; k < n; k++) { const f = A[k][i] / A[i][i]; for (let c = i; c < n; c++) A[k][c] -= f * A[i][c]; b[k] -= f * b[i]; } }
  const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return { r: x.slice(0, K), H: withHome ? x[K] : 0 };
}
const rows = seasonRows(E, null), fitted = fitRatings(rows, true);
const pred = rows.map(x => fitted.H + fitted.r[x.h] - fitted.r[x.a]), ms = x => mean(x.map(v => v * v));
const resid = rows.map((x, i) => x.m - pred[i]), diff = rows.map(x => fitted.r[x.h] - fitted.r[x.a]);
const rowsNoForm = seasonRows(E_noform, null), fitNF = fitRatings(rowsNoForm, true);
const residNF = rowsNoForm.map((x, i) => x.m - (fitNF.H + fitNF.r[x.h] - fitNF.r[x.a]));
const noiseVar = mean(resid.map(v => v * v)), noiseVarNF = mean(residNF.map(v => v * v));
const tacticVar = out.tacticsRandomPick.sdBothSides ** 2, dayVar = Math.max(0, noiseVar - noiseVarNF);
const total = fitted.H ** 2 + mean(diff.map(v => v * v)) + noiseVar;
const share = v => r1(100 * v / total);
const xv = ids.map(id => xvOverall(byId[id])), rr = fitted.r, mx = mean(xv), mr = mean(rr);
const corr = rr.reduce((s, v, i) => s + (v - mr) * (xv[i] - mx), 0) / Math.sqrt(rr.reduce((s, v) => s + (v - mr) ** 2, 0) * xv.reduce((s, v) => s + (v - mx) ** 2, 0));
out.variance = { matches: rows.length, H: r2(fitted.H), sdTeamGap: r2(Math.sqrt(mean(diff.map(v => v * v)))), sdRatings: r2(sd(rr)), marginSD: r2(sd(rows.map(x => x.m))), residualSD: r2(Math.sqrt(noiseVar)), residualSDNoDayForm: r2(Math.sqrt(noiseVarNF)),
  ratingsVsXvOverall: { r: r2(corr), r2: r2(corr * corr), slope: r2(corr * sd(rr) / sd(xv)), sdXvOverall: r2(sd(xv)) },
  shareOfMeanSquareMargin: { home: share(fitted.H ** 2), teamQuality: share(mean(diff.map(v => v * v))), randomnessTotal: share(noiseVar), ofWhichDayForm: share(dayVar), ofWhichMatchLuck: share(noiseVar - dayVar), tacticsExtraIfRandomPicks: share(tacticVar) },
  explainedVarianceOfMargin: { teamQuality: r1(100 * mean(diff.map(v => v * v)) / (mean(diff.map(v => v * v)) + noiseVar)), randomness: r1(100 * noiseVar / (mean(diff.map(v => v * v)) + noiseVar)) } };

await writeFile(resolve(ROOT, OUT), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
