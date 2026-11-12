/**
 * Funciones estadísticas compartidas por history-analysis.mjs y history-sim-compare.mjs.
 * Sin dependencias: mínimos cuadrados con regularización, Elo, normal acumulada.
 */
export const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
export const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
export const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
export const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000;
export const pct = (n, d) => r1(100 * n / d);
export function erf(x) { // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
export const phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
export function wilson(k, n, z = 1.96) {
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [r1(100 * (c - h) / d), r1(100 * (c + h) / d)];
}

/** Resumen de una lista de partidos {homeScore, awayScore, homeTries?, awayTries?}. */
export function summarize(list) {
  const margins = list.map(m => m.homeScore - m.awayScore);
  const n = list.length, hw = margins.filter(x => x > 0).length, dr = margins.filter(x => x === 0).length;
  const withTries = list.filter(m => Number.isFinite(m.homeTries) && Number.isFinite(m.awayTries));
  const abs = margins.map(Math.abs);
  return {
    matches: n,
    homeWinPct: pct(hw, n), drawPct: pct(dr, n), awayWinPct: pct(n - hw - dr, n), homeWinCI95: wilson(hw, n),
    homePointsShare: r1(100 * (hw + dr / 2) / n),
    meanHomeMargin: r2(mean(margins)), marginSD: r2(sd(margins)),
    marginQuantiles: Object.fromEntries([.05, .1, .25, .5, .75, .9, .95].map(q => [`p${Math.round(q * 100)}`, r1(quantile(margins, q))])),
    absMarginMean: r1(mean(abs)), absMarginMedian: r1(quantile(abs, .5)),
    closeGamesPct: { le3: pct(abs.filter(x => x <= 3).length, n), le7: pct(abs.filter(x => x <= 7).length, n), ge21: pct(abs.filter(x => x >= 21).length, n), ge35: pct(abs.filter(x => x >= 35).length, n) },
    meanHomePoints: r1(mean(list.map(m => m.homeScore))), meanAwayPoints: r1(mean(list.map(m => m.awayScore))),
    meanTotalPoints: r1(mean(list.map(m => m.homeScore + m.awayScore))), totalPointsSD: r1(sd(list.map(m => m.homeScore + m.awayScore))),
    tries: withTries.length ? { matches: withTries.length, meanTotal: r2(mean(withTries.map(m => m.homeTries + m.awayTries))), meanHome: r2(mean(withTries.map(m => m.homeTries))), meanAway: r2(mean(withTries.map(m => m.awayTries))) } : null,
  };
}

/** Histograma del margen local en cubos de 7 puntos (−42 o menos … +42 o más). */
export function marginHistogram(list) {
  const edges = [-Infinity, -35, -28, -21, -14, -7, 0, 1, 8, 15, 22, 29, 36, Infinity];
  const labels = ['≤−36', '−35…−29', '−28…−22', '−21…−15', '−14…−8', '−7…−1', '0', '+1…+7', '+8…+14', '+15…+21', '+22…+28', '+29…+35', '≥+36'];
  const counts = labels.map(() => 0);
  for (const m of list) { const d = m.homeScore - m.awayScore; const i = edges.findIndex((e, k) => d >= e && d < edges[k + 1]); counts[i]++; }
  return Object.fromEntries(labels.map((l, i) => [l, pct(counts[i], list.length)]));
}

/**
 * Modelo de margen: margen_local = r_local − r_visitante + H + ε, ε ~ N(0, σ).
 * Mínimos cuadrados con penalización ridge λ (encoge hacia 0 a equipos con pocos partidos) y Σr = 0.
 * Devuelve ratings en puntos de margen, H, σ y la función de probabilidad de victoria.
 */
export function fitMarginModel(list, { lambda = 2, weight = () => 1, fixedHome = null } = {}) {
  const ids = [...new Set(list.flatMap(m => [m.homeId, m.awayId]))].sort();
  const idx = new Map(ids.map((id, i) => [id, i]));
  const p = ids.length + (fixedHome === null ? 1 : 0);
  const A = Array.from({ length: p }, () => new Float64Array(p)), b = new Float64Array(p);
  for (const m of list) {
    const w = weight(m), x = new Float64Array(p);
    x[idx.get(m.homeId)] = 1; x[idx.get(m.awayId)] = -1;
    let y = m.homeScore - m.awayScore;
    if (fixedHome === null) x[p - 1] = m.neutral ? 0 : 1; else if (!m.neutral) y -= fixedHome;
    for (let i = 0; i < p; i++) { if (!x[i]) continue; b[i] += w * x[i] * y; for (let j = 0; j < p; j++) if (x[j]) A[i][j] += w * x[i] * x[j]; }
  }
  for (let i = 0; i < ids.length; i++) A[i][i] += lambda;
  const sol = solve(A, b);
  const centre = mean(sol.slice(0, ids.length));
  const ratings = Object.fromEntries(ids.map((id, i) => [id, sol[i] - centre]));
  const H = fixedHome ?? sol[p - 1];
  const resid = list.map(m => (m.homeScore - m.awayScore) - (ratings[m.homeId] - ratings[m.awayId] + (m.neutral ? 0 : H)));
  const sigma = Math.sqrt(resid.reduce((s, e) => s + e * e, 0) / Math.max(1, list.length - p));
  const winProb = (h, a, neutral = false) => { const mu = ratings[h] - ratings[a] + (neutral ? 0 : H); return { mu, pHome: phi((mu - 0.5) / sigma), pDraw: phi((mu + 0.5) / sigma) - phi((mu - 0.5) / sigma), pAway: 1 - phi((mu + 0.5) / sigma) }; };
  return { ratings, H, sigma, ratingSD: sd(Object.values(ratings)), winProb, n: list.length };
}
function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Elo secuencial con multiplicador por margen (estilo World Rugby/538) y regresión a la media entre temporadas.
 * Devuelve predicciones previas a cada partido (para medir sorpresas) y ratings finales.
 */
export function runElo(matches, { K = 30, home = 60, carry = 0.75, newClub = 1450 } = {}) {
  const R = new Map(); let season = null; const preds = []; const bySeasonEnd = {};
  const expect = (d) => 1 / (1 + 10 ** (-d / 400));
  for (const m of matches) {
    if (m.season !== season) {
      if (season !== null) bySeasonEnd[season] = Object.fromEntries(R);
      for (const [id, r] of R) R.set(id, 1500 + (r - 1500) * carry);
      season = m.season;
    }
    for (const id of [m.homeId, m.awayId]) if (!R.has(id)) R.set(id, newClub);
    const rh = R.get(m.homeId), ra = R.get(m.awayId), h = m.neutral ? 0 : home;
    const e = expect(rh + h - ra), s = m.homeScore > m.awayScore ? 1 : m.homeScore < m.awayScore ? 0 : 0.5;
    preds.push({ m, e, s, diff: rh + h - ra });
    const margin = Math.abs(m.homeScore - m.awayScore);
    const mult = Math.log(margin + 1) * (2.2 / ((s === 1 ? 1 : -1) * (rh + h - ra) * 0.001 + 2.2));
    const delta = K * Math.max(0.5, mult) * (s - e);
    R.set(m.homeId, rh + delta); R.set(m.awayId, ra - delta);
  }
  bySeasonEnd[season] = Object.fromEntries(R);
  const ll = -mean(preds.map(p => p.s === 0.5 ? (Math.log(p.e) + Math.log(1 - p.e)) / 2 : Math.log(p.s ? p.e : 1 - p.e)));
  const brier = mean(preds.map(p => (p.e - p.s) ** 2));
  return { ratings: Object.fromEntries(R), bySeasonEnd, preds, logLoss: ll, brier };
}

/**
 * Modelo logístico de resultados (Bradley–Terry con localía): P(gana local) = 1/(1+e^−(θ_l − θ_v + h)).
 * Empate = medio punto. Penalización L2 (prior normal de desvío 1/√l2 logits). Ascenso de gradiente determinista.
 */
export function fitLogisticModel(list, { l2 = 1, iters = 6000, weight = () => 1 } = {}) {
  const ids = [...new Set(list.flatMap(m => [m.homeId, m.awayId]))].sort();
  const idx = new Map(ids.map((id, i) => [id, i]));
  const games = new Float64Array(ids.length);
  for (const m of list) { games[idx.get(m.homeId)] += weight(m); games[idx.get(m.awayId)] += weight(m); }
  const lr = 2 / (Math.max(...games) + l2); // paso estable: menor que 4/curvatura máxima
  const th = new Float64Array(ids.length); let h = 0;
  const totalW = list.reduce((s, m) => s + (m.neutral ? 0 : weight(m)), 0);
  for (let it = 0; it < iters; it++) {
    const g = new Float64Array(ids.length); let gh = 0;
    for (const m of list) {
      const w = weight(m), s = m.homeScore > m.awayScore ? 1 : m.homeScore < m.awayScore ? 0 : 0.5;
      const p = 1 / (1 + Math.exp(-(th[idx.get(m.homeId)] - th[idx.get(m.awayId)] + (m.neutral ? 0 : h))));
      g[idx.get(m.homeId)] += w * (s - p); g[idx.get(m.awayId)] -= w * (s - p); if (!m.neutral) gh += w * (s - p);
    }
    for (let i = 0; i < th.length; i++) th[i] += lr * (g[i] - l2 * th[i]);
    h += 4 * gh / totalW;
  }
  const ratings = Object.fromEntries(ids.map((id, i) => [id, th[i]]));
  return { ratings, h, pHome: (a, b) => 1 / (1 + Math.exp(-(ratings[a] - ratings[b] + h))) };
}

/** % de partidos decididos en que pierde el favorito según el modelo de margen (rating + localía). */
export function favouriteLossRate(list, model) {
  const dec = list.filter(m => m.homeScore !== m.awayScore);
  const lost = dec.filter(m => { const mu = model.ratings[m.homeId] - model.ratings[m.awayId] + (m.neutral ? 0 : model.H); return (mu >= 0) !== (m.homeScore > m.awayScore); }).length;
  return Math.round(1000 * lost / dec.length) / 10;
}
