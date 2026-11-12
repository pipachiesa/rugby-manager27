#!/usr/bin/env node
/**
 * Compara el simulador con los datos históricos y prototipa una calibración SIN tocar src/engine, web/ ni el catálogo.
 *
 * Uso: node scripts/history-sim-compare.mjs [--seeds 20] [--quick]
 *  1. Construye el mundo inicial (semilla 2026) igual que la web y simula los 182 partidos del Top 14 2026 × N semillas.
 *  2. Mide localía, dispersión, tanteos, tries, ratings implícitos y pares concretos (Newman–CASI, etc.).
 *  3. Escribe una COPIA parametrizada del motor en un directorio temporal (reemplazos de texto documentados abajo),
 *     ajusta localía, forma del día, dispersión de fuerzas y fuerza por club, y vuelve a medir.
 * Resultado: research/history/sim-compare.json. Determinista por semilla.
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { summarize, marginHistogram, fitMarginModel, favouriteLossRate, mean, r1, r2, wilson } from './history-lib.mjs';
import { mergeResearch } from './merge-research.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const SEEDS = arg('--seeds', 20), PAIR_SEEDS = arg('--pair-seeds', 1000);
const read = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const returns = await read('research/returns.json'), youth = await read('research/youth.json');
const names = await read('research/names.json').catch(() => ({}));
const rawCatalog = await read('research/catalog.json');
const history = await read('research/history/urba-results.json');
const analysis = await read('research/history/analysis.json');
const ageVerification = await read('research/age-verification.json');

/* ---------- Copia parametrizada del motor ---------- */
// Cada reemplazo debe aplicarse exactamente una vez; si el motor cambia, el script falla en lugar de medir otra cosa.
const PATCHES = [
  ['const edge = (s        ) => team === home ? s + .16 : s;', 'const edge = (s) => team === home ? s + (globalThis.RM_CAL?.edge ?? .16) : s;'],
  ['const form = (rng() + rng() - 1) * .055;', 'const form = (rng() + rng() - 1) * (globalThis.RM_CAL?.form ?? .055);'],
  ['return baseline + (clamp(score, 42, 96) - 70) * .071;', 'return baseline + (clamp(score, 42, 96) - 70) * (globalThis.RM_CAL?.slope ?? .071);'],
];
const protoDir = join(tmpdir(), `rm26-engine-proto-${process.pid}`);
await mkdir(protoDir, { recursive: true });
let engineSrc = await readFile(join(ROOT, 'web/engine.js'), 'utf8');
for (const [from, to] of PATCHES) {
  const n = engineSrc.split(from).length - 1;
  if (n !== 1) throw new Error(`El reemplazo «${from}» aparece ${n} veces en web/engine.js; ejecutá npm run build o revisá el motor.`);
  engineSrc = engineSrc.replace(from, to);
}
await writeFile(join(protoDir, 'engine.js'), engineSrc);
await copyFile(join(ROOT, 'web/domain.js'), join(protoDir, 'domain.js'));
const E = await import(join(protoDir, 'engine.js'));
const { initialWorld } = await import(join(protoDir, 'domain.js'));

/* ---------- Mundo y simulación ---------- */
const TOP14 = rawCatalog.competitions.find(c => c.id === 'top14').clubIds;
const fixtures2026 = rawCatalog.fixtures.filter(f => f.competitionId === 'top14');
function buildWorld(strengthOverride = null) {
  const cat = structuredClone(rawCatalog);
  if (strengthOverride) for (const c of cat.clubs) if (strengthOverride[c.id] !== undefined) c.strength = strengthOverride[c.id];
  const catalog = mergeResearch(cat, structuredClone(ageVerification), returns);
  return initialWorld(catalog, 2026, returns, youth, names);
}
const clone = (club, id = 'clone') => ({ ...club, id, name: club.name + ' (clon)', players: club.players.map(p => ({ ...p, id: p.id + '-c' })) });
const T = () => ({ ...E.DEFAULT_TACTICS });

function season(world, seeds = SEEDS) {
  const byId = Object.fromEntries(world.clubs.map(c => [c.id, c]));
  const out = [];
  for (let s = 0; s < seeds; s++) for (const f of fixtures2026) {
    const m = E.generateMatch(byId[f.homeClubId], byId[f.awayClubId], T(), T(), 100000 * s + f.round * 100 + TOP14.indexOf(f.homeClubId), false);
    out.push({ season: s, homeId: f.homeClubId, awayId: f.awayClubId, homeScore: m.homeScore, awayScore: m.awayScore, homeTries: m.homeTries, awayTries: m.awayTries, neutral: false, stage: 'regular' });
  }
  return out;
}
function pair(world, a, b, seeds = PAIR_SEEDS, ta = T(), tb = T()) {
  const A = a === 'clone' ? clone(world.clubs.find(c => c.id === b)) : world.clubs.find(c => c.id === a);
  const B = b === 'clone' ? clone(world.clubs.find(c => c.id === a)) : world.clubs.find(c => c.id === b);
  const list = [];
  for (let s = 0; s < seeds; s++) { const m = E.generateMatch(A, B, ta, tb, s, false); list.push({ homeScore: m.homeScore, awayScore: m.awayScore, homeTries: m.homeTries, awayTries: m.awayTries }); }
  const w = list.filter(m => m.homeScore > m.awayScore).length, d = list.filter(m => m.homeScore === m.awayScore).length;
  return { wins: w, draws: d, losses: seeds - w - d, homeWinPct: r1(100 * w / seeds), ci95: wilson(w, seeds), meanMargin: r1(mean(list.map(m => m.homeScore - m.awayScore))), meanPoints: [r1(mean(list.map(m => m.homeScore))), r1(mean(list.map(m => m.awayScore)))] };
}
/** Mide un mundo: resumen de temporada, modelo de margen ajustado a los resultados simulados y pares. */
function measure(world, label, { pairs = true } = {}) {
  const sim = season(world);
  // Modelo con efectos de club comunes a todas las réplicas: cada réplica cuenta como una temporada más.
  const model = fitMarginModel(sim, { lambda: 0.5 });
  const emp = analysis.ratings.table;
  const ratingRMSE = Math.sqrt(mean(emp.map(r => (model.ratings[r.id] - r.marginBlended2024to2026) ** 2)));
  const s = summarize(sim);
  // σ por partido: residuo del modelo; comparable con el σ empírico por temporada.
  const res = {
    label, summary: s, histogram: marginHistogram(sim),
    model: { favouriteLossPct: favouriteLossRate(sim, model), H: r2(model.H), sigma: r1(model.sigma), ratingSD: r1(model.ratingSD), ratings: Object.fromEntries(Object.entries(model.ratings).map(([k, v]) => [k, r1(v)]).sort((a, b) => b[1] - a[1])), ratingRMSEvsBlended: r1(ratingRMSE) },
  };
  if (pairs) res.pairs = {
    'newman-clone': pair(world, 'newman', 'clone'),
    'newman-casi': pair(world, 'newman', 'casi'),
    'newman-regatas-bella-vista': pair(world, 'newman', 'regatas-bella-vista'),
    'newman-hindu': pair(world, 'newman', 'hindu'),
    'casi-regatas-bella-vista': pair(world, 'casi', 'regatas-bella-vista'),
    'newman-champagnat': pair(world, 'newman', 'champagnat'),
  };
  return res;
}
function tacticEffects(world) {
  const n = world.clubs.find(c => c.id === 'newman');
  const base = pair(world, 'newman', 'clone');
  const variants = { 'defensa Rush': { defense: 'Rush' }, 'ruck Rápido': { ruck: 'Rápido' }, 'ataque 2-4-2': { attack: '2-4-2' }, 'scrum Presión': { scrum: 'Presión' }, 'lineout Competir': { lineout: 'Competir' }, 'maul Evitar': { maul: 'Evitar' }, 'pie Conservador': { kicking: 'Conservador' } };
  return Object.fromEntries(Object.entries(variants).map(([k, v]) => { const p = pair(world, 'newman', 'clone', PAIR_SEEDS, { ...T(), ...v }, T()); return [k, { homeWinPct: p.homeWinPct, deltaWinPct: r1(p.homeWinPct - base.homeWinPct), deltaMargin: r1(p.meanMargin - base.meanMargin) }]; }));
}
const setCal = c => { globalThis.RM_CAL = c; };

/* ---------- 1. Motor actual ---------- */
setCal(null);
const world0 = buildWorld();
console.log('Midiendo motor actual…');
const baseline = measure(world0, 'motor actual (edge .16, forma ±5,5 %, slope .071, fuerzas del catálogo)');
baseline.tactics = tacticEffects(world0);

/* ---------- 2. Respuesta del motor a cada parámetro ---------- */
// Localía: margen medio del clon idéntico según edge.
// Forma del día: σ residual según amplitud (con fuerzas actuales).
const formSweep = [];
for (const form of [0, 0.02, 0.055, 0.1]) { setCal({ form }); const m = measure(world0, `forma ${form}`, { pairs: false }); formSweep.push({ form, sigma: m.model.sigma, marginSD: m.summary.marginSD, ratingSD: m.model.ratingSD, meanTotalPoints: m.summary.meanTotalPoints }); }
// Con forma 0 el σ del motor sigue por encima del empírico: la forma no puede llevarlo al nivel real.
// Se deja una forma pequeña (±2 %) para conservar algo de variación de día sin agregar ruido.
const cal = { edge: null, form: 0.02 };
// Localía: margen medio del clon idéntico (4.000 semillas por punto) según edge, con la forma elegida.
const edgeSweep = [];
for (const edge of [0.16, 0.3, 0.4, 0.5, 0.6]) { setCal({ edge, form: cal.form }); edgeSweep.push({ edge, ...pair(world0, 'newman', 'clone', 4000) }); }
setCal(null);
// Objetivo de localía: punto medio entre la estimación por pares ida/vuelta 2016–2026 y la de 2022–2026.
const Htarget = r2((analysis.homeAdvantage.doubleRoundPairs.meanH + analysis.regularSeason.since2022.meanHomeMargin) / 2);
{
  const xs = edgeSweep.map(e => e.edge), ys = edgeSweep.map(e => e.meanMargin), mx = mean(xs), my = mean(ys);
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  cal.edge = r2(mx + (Htarget - my) / slope);
  cal.edgeSlope = r2(slope);
}

/* ---------- 3. Fuerza por club: ajuste iterativo a los ratings empíricos ---------- */
// Objetivo: rating de margen 2024–2026 ponderado (analysis.json), reescalado por σ_motor/σ_empírico para que las
// PROBABILIDADES de victoria (no los márgenes) coincidan: P = Φ((Δ+H)/σ). Se mueve la fuerza del catálogo de cada club
// en proporción a la diferencia entre el rating simulado y el objetivo (β estimado por regresión en cada paso, paso amortiguado).
const empTarget = Object.fromEntries(analysis.ratings.table.map(r => [r.id, r.marginBlended2024to2026]));
const strength = Object.fromEntries(rawCatalog.clubs.filter(c => TOP14.includes(c.id)).map(c => [c.id, c.strength]));
let current = { ...strength }, iterations = [], scale = 1;
for (let it = 0; it < 6; it++) {
  setCal({ edge: cal.edge, form: cal.form });
  const w = buildWorld(Object.fromEntries(Object.entries(current).map(([k, v]) => [k, Math.round(v)])));
  const sim = season(w, Math.max(10, SEEDS));
  const model = fitMarginModel(sim, { lambda: 0.5 });
  scale = model.sigma / analysis.ratings.modelBlended.sigma;
  const ids = Object.keys(empTarget);
  const target = Object.fromEntries(ids.map(id => [id, empTarget[id] * scale]));
  const xs = ids.map(id => current[id]), ys = ids.map(id => model.ratings[id]);
  const mx = mean(xs), my = mean(ys);
  const beta = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const rmse = Math.sqrt(mean(ids.map(id => (model.ratings[id] - target[id]) ** 2)));
  iterations.push({ iteration: it, beta: r2(beta), sigmaScale: r2(scale), rmseVsScaledTarget: r1(rmse), sigma: r1(model.sigma), H: r2(model.H) });
  console.log('iteración', it, iterations.at(-1));
  if (it < 5) for (const id of ids) current[id] = Math.min(96, Math.max(42, current[id] + 0.7 * (target[id] - model.ratings[id]) / Math.max(0.5, beta)));
}
current = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, Math.round(v)]));
// Variante lineal (sin corrección por club): fuerza = a + b·rating empírico, ajustada por mínimos cuadrados a la calibrada.
const ids = Object.keys(empTarget), ex = ids.map(id => empTarget[id]), cy = ids.map(id => current[id]);
const bLin = ex.reduce((s, x, i) => s + (x - mean(ex)) * (cy[i] - mean(cy)), 0) / ex.reduce((s, x) => s + (x - mean(ex)) ** 2, 0);
const linear = Object.fromEntries(ids.map(id => [id, Math.round(mean(cy) + bLin * (empTarget[id] - mean(ex)))]));
setCal({ edge: cal.edge, form: cal.form });
const worldCal = buildWorld(current);
console.log('Midiendo prototipo calibrado…');
const calibrated = measure(worldCal, `prototipo (edge ${cal.edge}, forma ±${cal.form * 100} %, fuerzas recalibradas por club)`);
calibrated.tactics = tacticEffects(worldCal);
calibrated.strength = current;
const calibratedLinear = measure(buildWorld(linear), `prototipo lineal (edge ${cal.edge}, forma ±${cal.form * 100} %, fuerza = ${r1(mean(cy))} + ${r2(bLin)}·rating)`);
calibratedLinear.strength = linear;
setCal(null);

/* ---------- Empírico de referencia ---------- */
const empirical = {
  pooledRegular: analysis.regularSeason.pooled, since2022: analysis.regularSeason.since2022, season2026: analysis.regularSeason.bySeason['2026'],
  histogram: analysis.regularSeason.marginHistogram,
  model2026: analysis.ratings.model2026, modelBlended: analysis.ratings.modelBlended,
  pairs: Object.fromEntries(analysis.pairs.map(p => [p.pair, { model2026: p.model2026.pHomeWin, blended: p.modelBlended.pHomeWin, elo: p.elo.pHomeWinOrHalfDraw, logistic2026: p.logistic2026.pHomeWinOrHalfDraw, logisticBlended: p.logisticBlended.pHomeWinOrHalfDraw, h2h: p.headToHead2016to2026, homeRecord: p.aAtHome }])),
};
const result = { generatedAt: '2026-11-10', seedsPerFixture: SEEDS, pairSeeds: PAIR_SEEDS, patches: PATCHES.map(([a, b]) => ({ from: a, to: b })), empirical, baseline, sweeps: { edge: edgeSweep, form: formSweep }, calibration: { edge: cal.edge, edgeSlope: cal.edgeSlope, form: cal.form, Htarget, sigmaScale: r2(scale), iterations, strength: current, strengthLinear: linear, linearSlope: r2(bLin), strengthBefore: strength }, calibrated, calibratedLinear };
await writeFile(join(ROOT, 'research/history/sim-compare.json'), JSON.stringify(result, null, 1) + '\n');

const line = (k, r) => console.log(k.padEnd(12), JSON.stringify({ hw: r.summary.homeWinPct, dr: r.summary.drawPct, mm: r.summary.meanHomeMargin, sd: r.summary.marginSD, pts: r.summary.meanTotalPoints, tries: r.summary.tries?.meanTotal, H: r.model.H, sigma: r.model.sigma, rSD: r.model.ratingSD, rmse: r.model.ratingRMSEvsBlended }));
line('actual', baseline); line('prototipo', calibrated); line('lineal', calibratedLinear);
console.log('empírico', JSON.stringify({ hw: empirical.pooledRegular.homeWinPct, mm: empirical.pooledRegular.meanHomeMargin, sd: empirical.pooledRegular.marginSD, pts: empirical.pooledRegular.meanTotalPoints, tries: empirical.pooledRegular.tries.meanTotal, blended: empirical.modelBlended }));
for (const k of Object.keys(baseline.pairs)) console.log(k.padEnd(28), 'actual', baseline.pairs[k].homeWinPct, baseline.pairs[k].meanMargin, '| prototipo', calibrated.pairs[k].homeWinPct, calibrated.pairs[k].meanMargin, '| lineal', calibratedLinear.pairs[k].homeWinPct, calibratedLinear.pairs[k].meanMargin);
console.log('edge', JSON.stringify(edgeSweep.map(e => [e.edge, e.homeWinPct, e.meanMargin])), 'forma', JSON.stringify(formSweep));
console.log('tácticas actual', JSON.stringify(baseline.tactics)); console.log('tácticas prototipo', JSON.stringify(calibrated.tactics));
console.log('fuerzas', JSON.stringify(current)); console.log('lineal', JSON.stringify(linear), r2(bLin));
