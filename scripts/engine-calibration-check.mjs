#!/usr/bin/env node
/**
 * Measures the REAL built engine (web/engine.js, run `npm run build` first) against URBA 2016-2026 history.
 *
 * Uso: node scripts/engine-calibration-check.mjs [--seeds 20] [--pair-seeds 1000] [--fit] [--out path]
 *   --fit   proposes Top 14 club strengths as a monotone linear map of the real 2024-2026 ratings
 *           (strength = a + b × rating), fitted to what the engine produces. Order always follows the real ranking.
 * Output: research/history/engine-check.json (or --out). Deterministic per seed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { summarize, fitMarginModel, mean, r1, r2, wilson } from './history-lib.mjs';
import { mergeResearch } from './merge-research.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const argv = process.argv;
const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d; };
const SEEDS = Number(arg('--seeds', 20)), PAIR_SEEDS = Number(arg('--pair-seeds', 1000)), FIT = argv.includes('--fit');
const OUT = arg('--out', 'research/history/engine-check.json');
const read = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const [rawCatalog, analysis, ages, returns, youth] = await Promise.all(['research/catalog.json', 'research/history/analysis.json', 'research/age-verification.json', 'research/returns.json', 'research/youth.json'].map(read));
const names = await read('research/names.json').catch(() => ({}));
const E = await import(join(ROOT, 'web/engine.js'));
const { initialWorld } = await import(join(ROOT, 'web/domain.js'));

const TOP14 = rawCatalog.competitions.find(c => c.id === 'top14').clubIds;
const fixtures = rawCatalog.fixtures.filter(f => f.competitionId === 'top14');
const SIGMA_SCALE = 1.13; // engine σ / real σ: match win PROBABILITIES, not raw margins (see calibration-history-report §5)
const target = Object.fromEntries(analysis.ratings.table.map(r => [r.id, r.marginBlended2024to2026 * SIGMA_SCALE]));
const T = () => ({ ...E.DEFAULT_TACTICS });

function buildWorld(strengths) {
  const cat = structuredClone(rawCatalog);
  if (strengths) for (const c of cat.clubs) if (strengths[c.id] !== undefined) c.strength = strengths[c.id];
  return initialWorld(mergeResearch(cat, structuredClone(ages), returns), 2026, returns, youth, names);
}
function season(world) {
  const byId = Object.fromEntries(world.clubs.map(c => [c.id, c])), out = [];
  for (let s = 0; s < SEEDS; s++) for (const f of fixtures) {
    const m = E.generateMatch(byId[f.homeClubId], byId[f.awayClubId], T(), T(), 100000 * s + f.round * 100 + TOP14.indexOf(f.homeClubId), false);
    out.push({ season: s, homeId: f.homeClubId, awayId: f.awayClubId, homeScore: m.homeScore, awayScore: m.awayScore, homeTries: m.homeTries, awayTries: m.awayTries, neutral: false, stage: 'regular' });
  }
  return out;
}
const clone = c => ({ ...c, id: c.id + '-clone', players: c.players.map(p => ({ ...p, id: p.id + '-c' })) });
function pair(world, a, b, ta = T(), tb = T()) {
  const A = world.clubs.find(c => c.id === a), B = b === 'clone' ? clone(A) : world.clubs.find(c => c.id === b);
  let w = 0, d = 0, margin = 0;
  for (let s = 0; s < PAIR_SEEDS; s++) { const m = E.generateMatch(A, B, ta, tb, s, false); w += m.homeScore > m.awayScore; d += m.homeScore === m.awayScore; margin += m.homeScore - m.awayScore; }
  return { homeWinPct: r1(100 * w / PAIR_SEEDS), ci95: wilson(w, PAIR_SEEDS), drawPct: r1(100 * d / PAIR_SEEDS), meanMargin: r1(margin / PAIR_SEEDS) };
}
function measure(world, { pairs = true, tactics = false } = {}) {
  const sim = season(world), s = summarize(sim), model = fitMarginModel(sim, { lambda: 0.5 });
  const ids = TOP14.filter(id => target[id] !== undefined);
  const rmse = Math.sqrt(mean(ids.map(id => (model.ratings[id] - target[id]) ** 2)));
  const xv = Object.fromEntries(world.clubs.filter(c => TOP14.includes(c.id)).map(c => {
    const top = c.players.filter(p => p.squad === 'Plantel superior').slice(0, 15);
    return [c.id, r1(mean(top.map(p => E.overall(p))))];
  }));
  const out = { summary: s, model: { H: r2(model.H), sigma: r1(model.sigma), ratingSD: r1(model.ratingSD), ratingRMSE: r2(rmse),
    ratings: Object.fromEntries(ids.map(id => [id, { sim: r1(model.ratings[id]), target: r1(target[id]) }])) }, xvMeanOverall: xv };
  if (pairs) out.pairs = Object.fromEntries([['newman', 'clone'], ['newman', 'casi'], ['newman', 'regatas-bella-vista'], ['newman', 'hindu'], ['casi', 'regatas-bella-vista'], ['sic', 'casi'], ['newman', 'champagnat']].map(([a, b]) => [`${a}-${b}`, pair(world, a, b)]));
  if (tactics) {
    const base = pair(world, 'newman', 'clone');
    const variants = { 'attack 2-4-2': { attack: '2-4-2' }, 'defense Rush': { defense: 'Rush' }, 'scrum Presión': { scrum: 'Presión' }, 'lineout Competir': { lineout: 'Competir' }, 'maul Evitar': { maul: 'Evitar' }, 'kicking Conservador': { kicking: 'Conservador' }, 'ruck Rápido': { ruck: 'Rápido' }, 'mentality Ofensiva': { mentality: 'Ofensiva' }, 'mentality Defensiva': { mentality: 'Defensiva' }, 'penalty Palos': { penalty: 'Palos' }, 'penalty Touch': { penalty: 'Touch' } };
    out.tactics = Object.fromEntries(Object.entries(variants).map(([k, v]) => { const p = pair(world, 'newman', 'clone', { ...T(), ...v }, T()); return [k, { deltaWinPct: r1(p.homeWinPct - base.homeWinPct), deltaMargin: r1(p.meanMargin - base.meanMargin) }]; }));
    out.tactics.defaults = E.DEFAULT_TACTICS;
  }
  return out;
}

const report = { generatedAt: new Date().toISOString(), engine: { HOME_EDGE: E.HOME_EDGE, DAY_FORM: E.DAY_FORM }, seeds: SEEDS, pairSeeds: PAIR_SEEDS,
  empirical: { homeWinDrawLoss: [53.1, 2.7, 44.3], H: '2.0-2.8', sigma: 14.3, ratingSD: 8.1, within7: 41.9, over35: 6.5, points: 52.6, tries: 7.21,
    pairs: { 'newman-casi': '62-80 %, +5 a +6', 'newman-regatas-bella-vista': '82-96 %', 'newman-hindu': '63-81 %', 'casi-regatas-bella-vista': '74-88 %', 'sic-casi': '43-56 %', 'newman-champagnat': '97-99 %' } } };

const current = Object.fromEntries(rawCatalog.clubs.filter(c => TOP14.includes(c.id)).map(c => [c.id, c.strength]));
report.current = { strengths: current, ...measure(buildWorld(), { tactics: true }) };

if (FIT) {
  // Pass 0: monotone linear map strength = m + (target − mean)/β. Then damped per-club corrections for squad
  // composition (kickers, packs) that a mean overall cannot capture, projected back onto the real ranking order:
  // if club A is rated above club B in 2024-2026, A's strength is never set below B's.
  const ids = Object.keys(current).filter(id => target[id] !== undefined);
  const order = [...ids].sort((a, b) => target[b] - target[a]);
  const isotonic = st => { // pool-adjacent-violators on the real order, non-increasing
    const blocks = order.map(id => ({ ids: [id], v: st[id] }));
    for (let i = 0; i < blocks.length - 1;) {
      if (blocks[i].v < blocks[i + 1].v) { const m = blocks[i], n = blocks.splice(i + 1, 1)[0]; m.v = (m.v * m.ids.length + n.v * n.ids.length) / (m.ids.length + n.ids.length); m.ids.push(...n.ids); i = Math.max(0, i - 1); }
      else i++;
    }
    return Object.fromEntries(blocks.flatMap(b => b.ids.map(id => [id, b.v])));
  };
  let last = report.current, strengths = { ...current }, exact = { ...current };
  report.fit = [];
  for (let pass = 0; pass < 5; pass++) {
    const xs = ids.map(id => exact[id]), ys = ids.map(id => last.model.ratings[id].sim), mx = mean(xs), my = mean(ys);
    const beta = Math.max(.6, xs.reduce((n, x, i) => n + (x - mx) * (ys[i] - my), 0) / xs.reduce((n, x) => n + (x - mx) ** 2, 0));
    if (pass === 0) { const tm = mean(ids.map(id => target[id])); exact = Object.fromEntries(ids.map(id => [id, mx + (target[id] - tm) / beta])); }
    else exact = Object.fromEntries(ids.map(id => [id, exact[id] + .7 * (target[id] - last.model.ratings[id].sim) / beta]));
    exact = isotonic(exact);
    strengths = Object.fromEntries(ids.map(id => [id, Math.round(exact[id])]));
    const final = pass === 4;
    last = measure(buildWorld(strengths), { pairs: final, tactics: final });
    report.fit.push({ pass, beta: r2(beta), strengths, H: last.model.H, ratingSD: last.model.ratingSD, ratingRMSE: last.model.ratingRMSE });
    console.log('pass', pass, JSON.stringify(strengths), 'rmse', last.model.ratingRMSE);
  }
  report.proposed = { strengths, ...last };
}
await writeFile(join(ROOT, OUT), JSON.stringify(report, null, 1) + '\n');
const show = (label, m) => console.log(label, JSON.stringify({ HWD: [m.summary.homeWinPct, m.summary.drawPct], H: m.model.H, sigma: m.model.sigma, ratingSD: m.model.ratingSD, rmse: m.model.ratingRMSE, within7: m.summary.closeGamesPct.le7, over35: m.summary.closeGamesPct.ge35, pts: m.summary.meanTotalPoints, tries: m.summary.tries?.meanTotal }), m.pairs ? JSON.stringify(Object.fromEntries(Object.entries(m.pairs).map(([k, v]) => [k, `${v.homeWinPct}% ${v.meanMargin}`]))) : '', m.tactics ? JSON.stringify(Object.fromEntries(Object.entries(m.tactics).filter(([k]) => k !== 'defaults').map(([k, v]) => [k, `${v.deltaWinPct}pp ${v.deltaMargin}`]))) : '');
show('ACTUAL', report.current);
if (report.proposed) { console.log('FIT', JSON.stringify(report.fit)); show('PROPUESTO', report.proposed); }
