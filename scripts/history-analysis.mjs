#!/usr/bin/env node
/**
 * Análisis empírico de research/history/urba-results.json.
 * Uso: node scripts/history-analysis.mjs  → escribe research/history/analysis.json e imprime un resumen.
 * Determinista: no usa azar ni red.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { summarize, marginHistogram, fitMarginModel, fitLogisticModel, favouriteLossRate, runElo, mean, r1, r2, r3, pct, wilson } from './history-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const data = JSON.parse(await readFile(ROOT + 'research/history/urba-results.json', 'utf8'));
const all = data.matches.map(m => ({ ...m, homeTries: m.components?.home.tries, awayTries: m.components?.away.tries }))
  .sort((a, b) => a.season - b.season || (a.date ?? '').localeCompare(b.date ?? ''));
const isRegular = m => m.stage === 'regular' || m.stage === 'second-phase';
const regular = all.filter(m => isRegular(m) && !m.neutral);
const playoffs = all.filter(m => !isRegular(m));
const seasons = [...new Set(all.map(m => m.season))];

/* 1. Localía, dispersión, tanteos */
const bySeason = Object.fromEntries(seasons.map(s => [s, summarize(regular.filter(m => m.season === s))]));
const pooled = summarize(regular);
const recent = summarize(regular.filter(m => m.season >= 2022));
const histogram = marginHistogram(regular);

/* Localía «pura»: H del modelo de margen por temporada (controla la fuerza de cada club) */
const perSeasonModels = Object.fromEntries(seasons.map(s => [s, fitMarginModel(all.filter(m => m.season === s && isRegular(m)), { lambda: 2 })]));
const homeEdge = {
  rawMeanMargin: pooled.meanHomeMargin,
  modelHBySeason: Object.fromEntries(seasons.map(s => [s, r2(perSeasonModels[s].H)])),
  modelHPooledMean: r2(mean(seasons.map(s => perSeasonModels[s].H))),
  sigmaBySeason: Object.fromEntries(seasons.map(s => [s, r1(perSeasonModels[s].sigma)])),
  ratingSDBySeason: Object.fromEntries(seasons.map(s => [s, r1(perSeasonModels[s].ratingSD)])),
};
// Ventaja local en el mismo par: (margen en casa de A vs B) + (margen en casa de B vs A) = 2H + ruido.
const pairHome = [];
for (const s of seasons) {
  const list = regular.filter(m => m.season === s && m.stage === 'regular');
  for (const m of list) {
    const back = list.find(x => x.homeId === m.awayId && x.awayId === m.homeId);
    if (back && m.homeId < m.awayId) pairHome.push(((m.homeScore - m.awayScore) + (back.homeScore - back.awayScore)) / 2);
  }
}
homeEdge.doubleRoundPairs = { pairs: pairHome.length, meanH: r2(mean(pairHome)), se: r2(Math.sqrt(pairHome.reduce((s, x) => s + (x - mean(pairHome)) ** 2, 0) / (pairHome.length - 1)) / Math.sqrt(pairHome.length)) };

/* 2. Tabla final y sorpresas */
function table(list) {
  const t = {};
  for (const m of list) for (const [id, f, a, o] of [[m.homeId, m.homeScore, m.awayScore, m.awayId], [m.awayId, m.awayScore, m.homeScore, m.homeId]]) {
    const r = t[id] ??= { id, played: 0, wins: 0, draws: 0, losses: 0, pf: 0, pa: 0, tableish: 0 };
    r.played++; r.pf += f; r.pa += a; if (f > a) r.wins++; else if (f < a) r.losses++; else r.draws++;
  }
  // Orden por % de puntos de partido (4/2/0) y diferencia; los bonus no se reconstruyen porque no hay tries en todas las temporadas.
  return Object.values(t).map(r => ({ ...r, winPct: (r.wins + r.draws / 2) / r.played, diff: r.pf - r.pa })).sort((a, b) => b.winPct - a.winPct || b.diff - a.diff).map((r, i) => ({ ...r, rank: i + 1 }));
}
const tables = Object.fromEntries(seasons.map(s => [s, table(regular.filter(m => m.season === s).concat(all.filter(m => m.season === s && isRegular(m) && m.neutral)))]));
let upTable = 0, upTableN = 0, upTableGap = { small: [0, 0], large: [0, 0] };
for (const m of regular) {
  if (m.homeScore === m.awayScore) continue;
  const t = tables[m.season], rh = t.find(r => r.id === m.homeId).rank, ra = t.find(r => r.id === m.awayId).rank;
  const better = rh < ra ? m.homeId : m.awayId, winner = m.homeScore > m.awayScore ? m.homeId : m.awayId;
  upTableN++; const up = winner !== better; if (up) upTable++;
  const bucket = Math.abs(rh - ra) >= 6 ? 'large' : 'small'; upTableGap[bucket][1]++; if (up) upTableGap[bucket][0]++;
}

/* Elo: búsqueda en grilla de K, ventaja local y arrastre entre temporadas, minimizando log-loss secuencial (fuera de muestra). */
const eloInput = all.filter(m => isRegular(m) || true);
let best = null;
for (const K of [16, 20, 24, 30, 36, 44]) for (const home of [0, 20, 40, 50, 60, 70, 80, 100]) for (const carry of [0.5, 0.65, 0.8, 0.9]) {
  const r = runElo(eloInput, { K, home, carry });
  if (!best || r.logLoss < best.logLoss) best = { K, home, carry, logLoss: r.logLoss, brier: r.brier };
}
const elo = runElo(eloInput, best);
const eloRegular = elo.preds.filter(p => isRegular(p.m) && p.s !== 0.5);
const upElo = eloRegular.filter(p => (p.diff > 0) !== (p.s === 1)).length;
const favBands = [[0, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9], [0.9, 1.01]].map(([lo, hi]) => {
  const g = elo.preds.filter(p => isRegular(p.m) && Math.max(p.e, 1 - p.e) >= lo && Math.max(p.e, 1 - p.e) < hi);
  const favWon = g.filter(p => (p.e >= 0.5 ? p.s : 1 - p.s)).reduce((s, p) => s + (p.e >= 0.5 ? p.s : 1 - p.s), 0);
  return { band: `${Math.round(lo * 100)}–${Math.min(100, Math.round(hi * 100))} %`, matches: g.length, predicted: r1(100 * mean(g.map(p => Math.max(p.e, 1 - p.e)))), observed: pct(favWon, g.length) };
});
const surprises = {
  byFinalTable: { decisiveMatches: upTableN, lowerRankedWins: upTable, pct: pct(upTable, upTableN), rankGapLt6: pct(...upTableGap.small), rankGapGe6: pct(...upTableGap.large) },
  byInSampleMarginModel: { pct: r1(mean(seasons.map(s => favouriteLossRate(all.filter(m => m.season === s && isRegular(m)), perSeasonModels[s])))), note: 'Favorito según el modelo de margen de la misma temporada (conoce el resultado final): cota inferior de la tasa de sorpresas.' },
  byPreMatchElo: { decisiveMatches: eloRegular.length, underdogWins: upElo, pct: pct(upElo, eloRegular.length), calibration: favBands },
};

/* 3. Ratings vigentes al 10/11/2026 */
const SNAP = '2026-11-10';
const seasonWeight = { 2026: 1, 2025: 0.5, 2024: 0.25 };
const current2026 = fitMarginModel(all.filter(m => m.season === 2026 && isRegular(m)), { lambda: 2 });
const blended = fitMarginModel(all.filter(m => seasonWeight[m.season] && isRegular(m)), { lambda: 3, weight: m => seasonWeight[m.season] });
const logistic2026 = fitLogisticModel(all.filter(m => m.season === 2026 && isRegular(m)), { l2: 1 });
const logisticBlended = fitLogisticModel(all.filter(m => seasonWeight[m.season] && isRegular(m)), { l2: 1, weight: m => seasonWeight[m.season] });
// Control de calibración del modelo de margen: victorias esperadas vs reales en 2026 (el modelo normal subestima a quien gana partidos cerrados).
const s26all = all.filter(m => m.season === 2026 && isRegular(m));
const expectedVsActual2026 = Object.fromEntries([...new Set(s26all.flatMap(m => [m.homeId, m.awayId]))].map(id => {
  let e = 0, a = 0;
  for (const m of s26all) if (m.homeId === id || m.awayId === id) { const p = current2026.winProb(m.homeId, m.awayId); e += m.homeId === id ? p.pHome + p.pDraw / 2 : p.pAway + p.pDraw / 2; const d = m.homeId === id ? m.homeScore - m.awayScore : m.awayScore - m.homeScore; a += d > 0 ? 1 : d === 0 ? 0.5 : 0; }
  return [id, { expectedWins: r1(e), actualWins: a }];
}));
const top14 = ['newman', 'casi', 'hindu', 'alumni', 'sic', 'los-tilos', 'belgrano-athletic', 'regatas-bella-vista', 'cuba', 'atletico-del-rosario', 'la-plata', 'buenos-aires-crc', 'los-matreros', 'champagnat'];
const ratingTable = top14.map(id => ({ id, margin2026: r1(current2026.ratings[id]), marginBlended2024to2026: blended.ratings[id] === undefined ? null : r1(blended.ratings[id]), elo: Math.round(elo.ratings[id]) }))
  .sort((a, b) => b.margin2026 - a.margin2026);

/* 4. Pares concretos */
const PAIRS = [['newman', 'casi'], ['newman', 'regatas-bella-vista'], ['newman', 'hindu'], ['newman', 'champagnat'], ['casi', 'regatas-bella-vista'], ['sic', 'casi'], ['regatas-bella-vista', 'cuba']];
const pairs = PAIRS.map(([a, b]) => {
  const h2h = all.filter(m => [m.homeId, m.awayId].includes(a) && [m.homeId, m.awayId].includes(b));
  const aWins = h2h.filter(m => (m.homeId === a ? m.homeScore - m.awayScore : m.awayScore - m.homeScore) > 0).length;
  const draws = h2h.filter(m => m.homeScore === m.awayScore).length;
  const aHome = h2h.filter(m => m.homeId === a && isRegular(m));
  // Rivales comunes en 2026: margen de A contra X menos margen de B contra X, misma condición de localía.
  const s26 = all.filter(m => m.season === 2026 && isRegular(m));
  const marginVs = (t, x, home) => s26.filter(m => home ? (m.homeId === t && m.awayId === x) : (m.awayId === t && m.homeId === x)).map(m => home ? m.homeScore - m.awayScore : m.awayScore - m.homeScore);
  const common = [];
  for (const x of top14.filter(x => x !== a && x !== b)) for (const home of [true, false]) {
    const ma = marginVs(a, x, home), mb = marginVs(b, x, home);
    if (ma.length && mb.length) common.push(ma[0] - mb[0]);
  }
  const p26 = current2026.winProb(a, b), pBl = blended.winProb(a, b);
  const eloP = 1 / (1 + 10 ** (-(elo.ratings[a] + best.home - elo.ratings[b]) / 400));
  return {
    pair: `${a} (local) – ${b}`,
    headToHead2016to2026: { matches: h2h.length, aWins, draws, bWins: h2h.length - aWins - draws, list: h2h.map(m => `${m.season} ${m.stage} ${m.homeId} ${m.homeScore}-${m.awayScore} ${m.awayId}`) },
    aAtHome: { matches: aHome.length, aWins: aHome.filter(m => m.homeScore > m.awayScore).length },
    commonOpponents2026: { comparisons: common.length, meanMarginDiff: r1(mean(common)), aBetterIn: common.filter(x => x > 0).length },
    model2026: { expectedMargin: r1(p26.mu), pHomeWin: r1(100 * p26.pHome), pDraw: r1(100 * p26.pDraw), pAwayWin: r1(100 * p26.pAway) },
    modelBlended: { expectedMargin: r1(pBl.mu), pHomeWin: r1(100 * pBl.pHome) },
    elo: { pHomeWinOrHalfDraw: r1(100 * eloP) },
    logistic2026: { pHomeWinOrHalfDraw: r1(100 * logistic2026.pHome(a, b)) },
    logisticBlended: { pHomeWinOrHalfDraw: r1(100 * logisticBlended.pHome(a, b)) },
  };
});

const result = {
  generatedAt: SNAP,
  input: { file: 'research/history/urba-results.json', matches: all.length, regularNonNeutral: regular.length, playoffs: playoffs.length, seasons },
  homeAdvantage: { pooled: { homeWinPct: pooled.homeWinPct, drawPct: pooled.drawPct, awayWinPct: pooled.awayWinPct, ci95: pooled.homeWinCI95, meanHomeMargin: pooled.meanHomeMargin }, ...homeEdge },
  regularSeason: { pooled, since2022: recent, bySeason, marginHistogram: histogram },
  playoffs: { ...summarize(playoffs), note: 'Semifinales y finales: varias en cancha neutral (CASI); no se usan para localía.' },
  surprises,
  elo: { params: best, logLoss: r3(elo.logLoss), brier: r3(elo.brier), baselineLogLossHomeRate: r3(-mean(elo.preds.map(p => p.s === 0.5 ? Math.log(0.5) : Math.log(p.s ? pooled.homeWinPct / 100 : 1 - pooled.homeWinPct / 100)))) },
  ratings: {
    asOf: SNAP,
    note: 'margin2026: puntos de margen esperados frente a un rival medio en cancha neutral (modelo normal, ridge λ=2, Σ=0). Blended: 2026 peso 1, 2025 0,5, 2024 0,25 (Los Matreros sin datos previos). Elo: K, localía y arrastre elegidos por log-loss.',
    expectedVsActual2026,
    logistic2026: { homeLogit: r2(logistic2026.h), cloneHomeWinPct: r1(100 / (1 + Math.exp(-logistic2026.h))) },
    model2026: { H: r2(current2026.H), sigma: r1(current2026.sigma), ratingSD: r1(current2026.ratingSD) },
    modelBlended: { H: r2(blended.H), sigma: r1(blended.sigma), ratingSD: r1(blended.ratingSD) },
    table: ratingTable,
    eloBySeasonEnd: Object.fromEntries(Object.entries(elo.bySeasonEnd).map(([s, r]) => [s, Object.fromEntries(Object.entries(r).filter(([id]) => all.some(m => m.season === +s && (m.homeId === id || m.awayId === id))).map(([id, v]) => [id, Math.round(v)]))])),
    marginBySeason: Object.fromEntries(seasons.map(s => [s, Object.fromEntries(Object.entries(perSeasonModels[s].ratings).map(([id, v]) => [id, r1(v)]).sort((a, b) => b[1] - a[1]))])),
  },
  pairs,
};
await writeFile(ROOT + 'research/history/analysis.json', JSON.stringify(result, null, 1) + '\n');

console.log(`Partidos: ${all.length} (regulares no neutrales ${regular.length}, playoffs ${playoffs.length})`);
console.log('Localía:', JSON.stringify(result.homeAdvantage));
console.log('Total pooled:', JSON.stringify(pooled));
console.log('Desde 2022:', JSON.stringify(recent));
console.log('Histograma:', JSON.stringify(histogram));
console.log('Sorpresas:', JSON.stringify(surprises));
console.log('Elo:', JSON.stringify(result.elo));
console.log('Modelo 2026:', JSON.stringify(result.ratings.model2026), 'mezcla', JSON.stringify(result.ratings.modelBlended));
console.table(ratingTable);
for (const p of pairs) console.log(p.pair, JSON.stringify({ h2h: [p.headToHead2016to2026.matches, p.headToHead2016to2026.aWins, p.headToHead2016to2026.draws, p.headToHead2016to2026.bWins], home: p.aAtHome, common: p.commonOpponents2026, m26: p.model2026, bl: p.modelBlended, elo: p.elo, lg: p.logistic2026, lgb: p.logisticBlended }));
console.log(JSON.stringify(result.ratings.expectedVsActual2026));
for (const s of seasons) console.log(s, JSON.stringify({ n: bySeason[s].matches, hw: bySeason[s].homeWinPct, mm: bySeason[s].meanHomeMargin, sd: bySeason[s].marginSD, pts: bySeason[s].meanTotalPoints, H: homeEdge.modelHBySeason[s], sig: homeEdge.sigmaBySeason[s], rsd: homeEdge.ratingSDBySeason[s] }));
