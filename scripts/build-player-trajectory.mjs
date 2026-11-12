#!/usr/bin/env node
/**
 * Cruza research/history/urba-lineups.json (formaciones 2016–2025) con research/catalog.json y escribe
 * research/history/player-trajectory.json: temporadas registradas en el máximo torneo URBA por jugador del catálogo.
 * 2026 cuenta si el jugador tiene apariciones 2026 en el catálogo o figura en un plantel Ovalados 2026.
 *
 * Identidad: misma lógica que samePerson de scripts/import-ovalados-2026.mjs (copiada, ese módulo ejecuta la
 * importación al importarse), más resguardos: nombre de pila compatible, preferencia por el mismo club,
 * ambigüedades descartadas, iniciales solo en el mismo club, cruces con otro club solo con nombre completo idéntico.
 * Además clasifica cada temporada por tipo de fuente (oficial = URBA/ESPN, prensa = Rugby Champagne, catálogo = 2026) y revisa
 * temporadas solo de prensa contra la planilla oficial del mismo partido (seasonsDisputed; ver identityReview).
 * Uso: node scripts/build-player-trajectory.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const catalog = await read('research/catalog.json');
const lineups = await read('research/history/urba-lineups.json');
const results = await read('research/history/urba-results.json');

/* --- copiado de scripts/import-ovalados-2026.mjs --- */
const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'del', 'y', 'debut']);
const toks = s => n(String(s).replace(/\(debut\)|\*/g, '')).split(' ').filter(t => t && !STOP.has(t));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const close = (a, b) => a === b || (a.length === 1 || b.length === 1 ? a[0] === b[0] : lev(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
const samePerson = (x, y) => { const A = toks(x), B = toks(y); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; if (s.length < 2) return false; return s.every(t => l.some(u => close(t, u))) && s.some(t => t.length >= 5 && l.some(u => u.length >= 5 && close(t, u))); };
/* --- fin de la copia --- */

/** Fuerza del vínculo: exact (mismos tokens, admite erratas), subset (un nombre tiene tokens extra), initial (usa iniciales). */
function strength(x, y) {
  x = String(x).replace(/['’´`]/g, ''); y = String(y).replace(/['’´`]/g, ''); // D'Amorim = Damorim
  if (!samePerson(x, y)) return null;
  const A = toks(x), B = toks(y);
  if (A.some(t => t.length === 1) || B.some(t => t.length === 1)) return 'initial';
  // Nombre de pila: el primer token de cada uno debe tener un par cercano en el otro (evita hermanos/padres).
  if (!A.slice(0, 1).every(t => B.some(u => close(t, u))) || !B.slice(0, 1).every(t => A.some(u => close(t, u)))) return 'subset';
  return A.length === B.length ? 'exact' : 'subset';
}
const RANK = { exact: 3, subset: 2, initial: 1 };
const players = catalog.players;
const namesOf = p => [p.name, ...(p.nameAliases ?? [])];
const bestStrength = (p, name) => namesOf(p).map(a => strength(a, name)).filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
/** Tipo de fuente: oficial = URBA (urba.org.ar / WordPress anterior / urbaweb) y ESPN (planillas jugadas); prensa = Rugby Champagne (formaciones anunciadas). */
const srcType = u => /rugbychampagne/i.test(u) ? 'prensa' : 'oficial';
const surname = s => toks(s).slice(1);

/* --- Apariciones en formaciones (todas las fuentes de cada partido) --- */
const entries = new Map(); // key season|club|normName -> {season, clubId, name, matches:Set, sources:Set}
for (const m of lineups.matches) {
  const lists = [{ url: m.homeSource, side: 'home', list: m.home }, { url: m.awaySource, side: 'away', list: m.away },
    ...m.otherSources.flatMap(o => [{ url: o.url, side: 'home', list: o.home }, { url: o.url, side: 'away', list: o.away }])];
  for (const { url, side, list } of lists) for (const p of list ?? []) {
    const clubId = side === 'home' ? m.homeId : m.awayId;
    const k = `${m.season}|${clubId}|${n(p.name)}`;
    if (!entries.has(k)) entries.set(k, { season: m.season, clubId, name: p.name, matches: new Set(), sources: new Set(), numbers: {} });
    entries.get(k).matches.add(m.matchId); entries.get(k).sources.add(url);
    // Shirt number per match: an official sheet wins over an announced press line-up.
    if (Number.isInteger(p.number) && (!(m.matchId in entries.get(k).numbers) || srcType(url) === 'oficial')) entries.get(k).numbers[m.matchId] = p.number;
  }
}

const hits = new Map(players.map(p => [p.id, []]));
const unmatched = [];
let unmatchedPlain = 0;
for (const e of entries.values()) {
  if (toks(e.name).length < 2) { unmatched.push({ name: e.name, clubId: e.clubId, season: e.season, reason: 'nombre incompleto' }); continue; }
  const cands = players.map(p => ({ p, s: bestStrength(p, e.name) })).filter(c => c.s);
  if (!cands.length) {
    // Cercanía por apellido en el mismo club: posible errata de nombre de pila o familiar.
    const fam = players.filter(p => p.clubId === e.clubId && namesOf(p).some(a => { const A = surname(a), B = surname(e.name); return A.length && B.length && A.join(' ') === B.join(' '); }));
    if (fam.length && e.season >= 2016) unmatched.push({ name: e.name, clubId: e.clubId, season: e.season, reason: 'mismo apellido y club, nombre de pila distinto (familiar u otra persona)', candidates: fam.map(p => p.id) });
    else unmatchedPlain++;
    continue;
  }
  const same = cands.filter(c => c.p.clubId === e.clubId);
  let pick = null, note = null;
  if (same.length) {
    const top = Math.max(...same.map(c => RANK[c.s]));
    const best = same.filter(c => RANK[c.s] === top);
    if (best.length === 1) pick = best[0];
    else { unmatched.push({ name: e.name, clubId: e.clubId, season: e.season, reason: 'ambiguo entre jugadores del mismo club', candidates: best.map(c => c.p.id) }); continue; }
    if (pick.s === 'initial') note = 'inicial';
  } else {
    const exact = cands.filter(c => c.s === 'exact' && namesOf(c.p).some(a => toks(a).join(' ') === toks(e.name).join(' ')));
    if (exact.length === 1 && cands.length === 1) { pick = exact[0]; note = 'otro club'; }
    else { unmatched.push({ name: e.name, clubId: e.clubId, season: e.season, reason: cands.length > 1 ? 'coincide con varios jugadores de otros clubes' : 'coincidencia parcial con jugador de otro club (no se acepta)', candidates: cands.map(c => c.p.id) }); continue; }
  }
  hits.get(pick.p.id).push({ season: e.season, clubId: e.clubId, name: e.name, strength: pick.s, note, matchIds: [...e.matches], sources: [...e.sources], numbers: e.numbers });
}

/* --- Otro club: si el jugador figura en su club esa temporada, o el mismo nombre figura en dos clubes, no se cuenta --- */
for (const [id, h] of hits) {
  const own = new Set(h.filter(x => x.note !== 'otro club').map(x => x.season));
  const kept = [];
  for (const x of h) {
    if (x.note === 'otro club') {
      // Temporadas en que ese nombre figura en el otro club: si alguna coincide con las del jugador en su club, es otra persona.
      const there = [...entries.values()].filter(e => e.clubId === x.clubId && toks(e.name).join(' ') === toks(x.name).join(' ')).map(e => e.season);
      const clash = there.some(y => own.has(y)) || [...entries.values()].some(e => e.season === x.season && e.clubId !== x.clubId && toks(e.name).join(' ') === toks(x.name).join(' '));
      if (clash) { unmatched.push({ name: x.name, clubId: x.clubId, season: x.season, reason: 'mismo nombre que un jugador del catálogo que esa temporada figura en otro club (homónimo probable)', candidates: [id] }); continue; }
    }
    kept.push(x);
  }
  hits.set(id, kept);
}

/* --- Revisión de identidades con planillas oficiales (mismo partido y lado) ---
 * Para una temporada que viene SOLO de prensa se compara, partido a partido, la formación de prensa con la
 * oficial (URBA/ESPN) del mismo partido y club. Un partido «contradice» si la oficial no incluye al jugador y en
 * su mismo número figura otra persona con el mismo apellido y otro nombre de pila (familiar). La temporada pasa a
 * seasonsDisputed solo si hay >= 3 partidos contradichos y TODOS los partidos con planilla oficial la contradicen
 * (la ausencia en una planilla aislada no contradice). Variantes del mismo nombre (Pablo/Paul, Alejandro/Alejo)
 * no se consideran otra persona. */
/** Observaciones de la revisión manual (no modifican seasons): variantes de nombre y posibles duplicados del catálogo. */
const MANUAL_NOTES = [
  { ids: ['newman-pablo-cardinal', 'newman-paul-cardinal'], type: 'posible duplicado', text: 'Pablo y Paul Cardinal son probablemente la misma persona: en los mismos partidos de 2024 prensa dice «Paul Cardinal» y ESPN «Pablo Cardinal» en el mismo número (#4/#5), y en la semifinal 2023 URBA figura «Paul Cardinal» (#19). El catálogo los tiene como dos registros (segunda línea y ala); no se fusionan aquí.', evidence: ['https://www.espn.com/rugby/match/_/gameId/598485/league/289279', 'https://urba.org.ar/urba/formaciones-confirmadas-para-la-semifinal-entre-newman-vs-alumni'] },
  { ids: ['sic-alejandro-daireaux'], type: 'variante de nombre', text: 'ESPN y URBA escriben «Alejo Daireaux» donde prensa escribe «Alejandro Daireaux» (mismo número en los mismos partidos 2024–2025 y suplente #19 en las semifinales/final 2021): misma persona. El vínculo automático no une Alejo con Alejandro, por lo que esas temporadas se clasifican como solo prensa aunque la planilla oficial las respalda.', evidence: ['https://www.espn.com/rugby/match/_/gameId/598440/league/289279', 'https://urba.org.ar/urba/formaciones-para-la-final-del-urba-top-12-copa-directv-presentada-por-zurich'] },
  { ids: ['champagnat-santos-panelo'], type: 'conflicto entre fuentes', text: 'En 5 partidos de 2024 prensa pone a Santos Panelo de apertura (#10) y ESPN a Benjamín Panelo (no está en el catálogo). Santos figura en ESPN como #10 en otros 17 partidos, así que 2024 queda respaldada oficialmente.', evidence: ['https://www.espn.com/rugby/match/_/gameId/598472/league/289279'] },
  { ids: ['cuba-juan-pablo-garoby', 'cuba-juan-pedro-garoby'], type: 'posible duplicado', text: 'Las planillas oficiales (2021 y 2024) solo muestran a «Juan Pedro Garoby» (hooker/suplente); «Juan Pablo Garoby» no aparece en ninguna formación 2016–2025. Puede ser el mismo jugador con el nombre de pila mal cargado en el catálogo; no se toca.', evidence: [] },
];
const NICK = [['pablo', 'paul'], ['alejandro', 'alejo']];
const sameFirst = (a, b) => a === b || close(a, b) || NICK.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const lineupById = new Map(lineups.matches.map(m => [m.matchId, m]));
const samePersonLoose = (a, b) => strength(a, b) !== null || (() => {
  const A = toks(a), B = toks(b);
  return A.length >= 2 && B.length >= 2 && sameFirst(A[0], B[0]) && A.slice(1).join(' ') === B.slice(1).join(' ');
})();
function reviewPressSeason(p, xs) {
  const ids = [...new Set(xs.flatMap(x => x.matchIds))];
  const r = { pressMatches: 0, withOfficial: 0, confirmed: 0, contradicted: 0, details: [] };
  for (const id of ids) {
    const m = lineupById.get(id); if (!m) continue;
    const side = m.homeId === xs[0].clubId ? 'home' : 'away';
    const lists = [{ url: side === 'home' ? m.homeSource : m.awaySource, list: m[side] }, ...m.otherSources.map(o => ({ url: o.url, list: o[side] }))].filter(l => l.url && l.list?.length);
    const press = lists.find(l => srcType(l.url) === 'prensa'); const off = lists.find(l => srcType(l.url) === 'oficial');
    if (!press) continue;
    r.pressMatches++;
    if (!off) continue;
    r.withOfficial++;
    const pe = press.list.find(e => xs.some(x => samePersonLoose(x.name, e.name)));
    if (!pe) continue;
    if (off.list.some(e => samePersonLoose(e.name, pe.name))) { r.confirmed++; continue; }
    const at = off.list.find(e => e.number === pe.number);
    const pt = toks(pe.name), at_ = at ? toks(at.name) : [];
    // Otra persona del mismo apellido: otro nombre de pila (familiar) o mismo nombre con segundo apellido distinto (p. ej. Ramón Fernández Miranda / Ramón Fernández de Caleya).
    const family = at && at_.slice(1).some(t => t.length >= 4 && pt.slice(1).includes(t)) &&
      (!sameFirst(at_[0], pt[0]) || (at_.length >= 3 && pt.length >= 3 && at_.slice(1).some(t => !pt.includes(t)) && pt.slice(1).some(t => !at_.includes(t))));
    if (family) { r.contradicted++; r.details.push({ matchId: id, pressName: pe.name, number: pe.number, officialName: at.name, officialUrl: off.url }); }
  }
  return r;
}
const officialLists = new Map(); // season|club -> nº de partidos con planilla oficial
for (const m of lineups.matches) for (const [side, id] of [['home', m.homeId], ['away', m.awayId]]) {
  const urls = [side === 'home' ? m.homeSource : m.awaySource, ...m.otherSources.map(o => o.url)].filter(Boolean);
  if (urls.some(u => srcType(u) === 'oficial')) officialLists.set(`${m.season}|${id}`, (officialLists.get(`${m.season}|${id}`) ?? 0) + 1);
}
const identityReview = { disputed: [], partialConflicts: [], pressOnlySeasons: { total: 0, withOfficialListsForClubSeason: 0, withoutOfficialLists: 0 } };

/* --- Agregado por jugador --- */
const out = {};
const yearOf = d => d ? +String(d).slice(0, 4) : null;
for (const p of players) {
  const h = hits.get(p.id);
  const bySeason = {};
  for (const x of h) (bySeason[x.season] ??= []).push(x);
  const notes = [];
  const seasonConf = {}, srcBySeason = {}, disputed = [];
  // Solo la fecha acreditada descarta temporadas; la estimada (ESPN) puede estar mal cargada y solo genera aviso.
  const birthY = yearOf(p.birthDate), estY = yearOf(p.estimatedBirthDate);
  for (const [y, xs] of Object.entries(bySeason)) {
    if (!birthY && estY && +y - estY < 17) notes.push(`${y}: la fecha estimada (${p.estimatedBirthDate}) le daría ${+y - estY} años; se conserva porque la estimación no está acreditada`);
    if (birthY && +y - birthY < 17) { notes.push(`${y} descartada: con nacimiento ${birthY} tendría ${+y - birthY} años (homónimo probable: ${xs.map(x => `${x.name} en ${x.clubId}`).join(', ')})`); delete bySeason[y]; continue; }
    const strong = xs.some(x => x.strength === 'exact' && x.clubId === p.clubId);
    // Si la temporada tiene apariciones de ambos tipos cuenta como oficial.
    const src = xs.some(x => x.sources.some(u => srcType(u) === 'oficial')) ? 'oficial' : 'prensa';
    if (src === 'prensa') {
      identityReview.pressOnlySeasons.total++;
      identityReview.pressOnlySeasons[officialLists.get(`${y}|${xs[0].clubId}`) ? 'withOfficialListsForClubSeason' : 'withoutOfficialLists']++;
      const rv = reviewPressSeason(p, xs);
      if (rv.contradicted >= 3 && rv.contradicted === rv.withOfficial) {
        const ev = { id: p.id, name: p.name, clubId: xs[0].clubId, season: +y, pressMatches: rv.pressMatches, contradicted: rv.contradicted, evidence: rv.details };
        identityReview.disputed.push(ev); disputed.push(+y);
        notes.push(`${y} dudosa y no contada: en ${rv.contradicted} de ${rv.pressMatches} partidos la planilla oficial del mismo partido muestra a otra persona del mismo apellido en su número (${[...new Set(rv.details.map(d => `${d.officialName} #${d.number}`))].join(', ')}) y nunca al jugador`);
        delete bySeason[y]; continue;
      }
      if (rv.contradicted) identityReview.partialConflicts.push({ id: p.id, name: p.name, clubId: xs[0].clubId, season: +y, pressMatches: rv.pressMatches, withOfficial: rv.withOfficial, contradicted: rv.contradicted, evidence: rv.details });
    }
    seasonConf[y] = strong ? 'alta' : 'media';
    srcBySeason[y] = src;
    for (const x of xs) {
      if (x.note === 'otro club') notes.push(`${y}: «${x.name}» en ${x.clubId} (otro club; nombre idéntico)`);
      else if (x.strength === 'initial') notes.push(`${y}: vínculo por inicial («${x.name}»)`);
      else if (x.strength === 'subset') notes.push(`${y}: nombre parcial («${x.name}»)`);
    }
  }
  const apps2026 = new Set((p.appearances ?? []).map(a => a.round ?? a.matchDate)).size;
  const ova2026 = (p.sourceIds ?? []).some(s => s.startsWith('ovalados-plantel-2026'));
  const seasons = Object.keys(bySeason).map(Number);
  if (apps2026 || ova2026) { seasons.push(2026); seasonConf[2026] = 'alta'; if (!apps2026) notes.push('2026 por plantel Ovalados (sin planilla de partido en el catálogo)'); }
  seasons.sort((a, b) => a - b);
  const prev = seasons.filter(y => y < 2026);
  for (let i = 1; i < seasons.length; i++) {
    // 2020 no se jugó; cuenta como hueco natural.
    const gap = seasons[i] - seasons[i - 1] - (seasons[i - 1] < 2020 && seasons[i] > 2020 ? 1 : 0);
    if (gap > 3) notes.push(`sin registros entre ${seasons[i - 1]} y ${seasons[i]} (${gap - 1} temporadas jugadas sin formación vinculada: etapa en el exterior, otra categoría, falta de cobertura u homónimo)`);
  }
  const clubsBySeason = {}, appearancesBySeason = {};
  for (const y of prev) {
    const cs = [...new Set(bySeason[y].map(x => x.clubId))];
    clubsBySeason[y] = cs.length === 1 ? cs[0] : cs;
    appearancesBySeason[y] = new Set(bySeason[y].flatMap(x => x.matchIds)).size;
  }
  if (seasons.includes(2026)) { clubsBySeason[2026] = p.clubId; appearancesBySeason[2026] = apps2026; }
  out[p.id] = {
    name: p.name, clubId: p.clubId, seasons, seasonsCount: seasons.length, firstSeason: seasons[0] ?? null,
    seasonsBySource: {
      oficial: prev.filter(y => srcBySeason[y] === 'oficial'),
      prensa: prev.filter(y => srcBySeason[y] === 'prensa'),
      catalogo: seasons.includes(2026) ? [2026] : [],
    },
    officialSeasonsCount: prev.filter(y => srcBySeason[y] === 'oficial').length,
    pressOnlySeasonsCount: prev.filter(y => srcBySeason[y] === 'prensa').length,
    seasonsDisputed: disputed.sort((a, b) => a - b),
    clubsBySeason, appearancesBySeason,
    // Shirt numbers worn per season (1-15 starter, 16+ bench), one per match; 2026 from the catalogue sheets.
    numbersBySeason: Object.fromEntries([...prev.map(y => [y, Object.values(Object.assign({}, ...bySeason[y].map(x => x.numbers)))]),
      ...(apps2026 ? [[2026, [...new Map((p.appearances ?? []).filter(a => Number.isInteger(a.number)).map(a => [a.round ?? a.matchDate, a.number])).values()]]] : [])].filter(([, v]) => v.length)),
    confidence: Object.values(seasonConf).every(c => c === 'alta') ? 'alta' : 'media',
    notes: [...new Set(notes)].join(' · ') || null,
  };
}

/* --- Cobertura --- */
const coverage = { bySeason: {}, byClub: {} };
const lu = new Map(lineups.matches.map(m => [m.matchId, m]));
for (const m of results.matches.filter(m => m.season < 2026)) {
  const s = (coverage.bySeason[m.season] ??= { matches: 0, withLineup: 0, withBothSides: 0, sources: {} });
  s.matches++;
  const l = lu.get(m.id);
  if (l) {
    s.withLineup++; if (l.home.length && l.away.length) s.withBothSides++;
    for (const t of new Set([l.homeSource, l.awaySource].filter(Boolean).map(u => u.includes('espn.com') ? 'espn' : u.includes('urba.org.ar') ? 'urba' : 'champagne'))) s.sources[t] = (s.sources[t] ?? 0) + 1;
  }
  for (const [side, id] of [['home', m.homeId], ['away', m.awayId]]) {
    const c = ((coverage.byClub[id] ??= {})[m.season] ??= { matches: 0, withLineup: 0 });
    c.matches++; if (l?.[side]?.length) c.withLineup++;
  }
}
for (const s of Object.values(coverage.bySeason)) { s.pctWithLineup = +(100 * s.withLineup / s.matches).toFixed(1); s.pctBothSides = +(100 * s.withBothSides / s.matches).toFixed(1); }
coverage.bySeason[2026] = { note: 'Planillas 2026 de research/catalog.json (players[].appearances) y planteles Ovalados 2026; no se recalcula aquí.' };

const bucket = c => c >= 10 ? '10+' : c >= 7 ? '7-9' : c >= 4 ? '4-6' : c >= 2 ? '2-3' : '1';
const distribution = { '1': 0, '2-3': 0, '4-6': 0, '7-9': 0, '10+': 0 };
for (const p of Object.values(out)) distribution[bucket(p.seasonsCount)]++;

// Nombres no vinculados: se agrupan por nombre+club.
const um = new Map();
for (const u of unmatched) { const k = `${u.clubId}|${n(u.name)}|${u.reason}`; if (!um.has(k)) um.set(k, { ...u, seasons: [] }); um.get(k).seasons.push(u.season); }
const unmatchedNames = [...um.values()].map(({ season, ...u }) => ({ ...u, seasons: [...new Set(u.seasons)].sort() })).sort((a, b) => a.clubId.localeCompare(b.clubId) || a.name.localeCompare(b.name));

const result = {
  generatedAt: new Date().toISOString().slice(0, 10),
  description: 'Temporadas registradas en el máximo torneo URBA por jugador del catálogo: formaciones publicadas 2016–2025 (research/history/urba-lineups.json) más 2026 del catálogo. Es un piso: cuenta temporadas con al menos una formación publicada y vinculada, no la carrera completa.',
  window: { from: 2016, to: 2026, missing: [2020], note: '2020 sin torneo (pandemia). Temporadas con poca cobertura subestiman la trayectoria.' },
  matching: 'samePerson (scripts/import-ovalados-2026.mjs) + nombre de pila compatible; mismo club preferido; ambigüedades descartadas; otro club solo con nombre completo idéntico y único; iniciales solo en el mismo club; temporadas con edad < 17 según fecha de nacimiento (acreditada o estimada) descartadas.',
  distribution,
  sourceTypes: { oficial: 'URBA (urba.org.ar o su WordPress anterior) y ESPN (planillas jugadas)', prensa: 'Rugby Champagne (formaciones anunciadas antes del partido)', catalogo: '2026: planillas 2026 y planteles Ovalados del catálogo' },
  identityReview: { rule: 'seasonsDisputed: temporada solo de prensa contradicha por la planilla oficial del mismo partido (>= 3 partidos y todos los comparables); no se cuenta en seasons/seasonsCount. partialConflicts: contradicciones aisladas que no alcanzan el umbral (la temporada se conserva).', ...identityReview, manualNotes: MANUAL_NOTES },
  coverage,
  players: out,
  unmatchedSummary: { distinctNamesWithoutCatalogMatch: unmatchedPlain, listed: unmatchedNames.length, note: 'unmatchedNames lista solo casos dudosos (ambiguos, parciales, mismo apellido). Los demás nombres sin vínculo son jugadores ajenos al catálogo actual.' },
  unmatchedNames,
};
await writeFile(join(ROOT, 'research/history/player-trajectory.json'), JSON.stringify(result, null, 1) + '\n');
console.log('Distribución:', distribution);
console.log('Confianza:', Object.values(out).reduce((a, p) => (a[p.confidence] = (a[p.confidence] ?? 0) + 1, a), {}));
for (const [y, s] of Object.entries(coverage.bySeason)) if (s.matches) console.log(`  ${y}: ${s.withLineup}/${s.matches} (${s.pctWithLineup}%; ambos lados ${s.pctBothSides}%) ${JSON.stringify(s.sources)}`);
