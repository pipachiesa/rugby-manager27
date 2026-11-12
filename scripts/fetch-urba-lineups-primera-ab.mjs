#!/usr/bin/env node
/**
 * Relevamiento y recopilación de formaciones de Primera A y Primera B URBA (2019–2025).
 * Escribe research/history/urba-lineups-primera-a.json y urba-lineups-primera-b.json (mismo formato que
 * urba-lineups.json, con division/stage) e imprime el resumen que usa research/history/primera-ab-sources-report.md.
 *
 * Fuentes (solo lectura, pedidos espaciados, sin credenciales, respetando robots.txt):
 *  - URBA, sitio nuevo (urba.org.ar; robots.txt inexistente → sin restricciones): API pública del fixture que usa la
 *    propia web (/api/fixture/menu?seasonId=Y y /api/fixture/championship/ID). Trae resultados oficiales por fecha de
 *    «Primera A - Superior», «Primera B - Superior» y sus Play Off para 2021–2026 (2019 y 2020 vacíos). Sin formaciones;
 *    se usa como índice de partidos para asignar formaciones de prensa.
 *  - Rugby Champagne (robots: Allow /): notas de formaciones de los sitemaps de sección primera-division-a,
 *    primera-division-b, urba y urba/top-14.
 *  - Relevadas sin datos útiles (ver informe): ESPN API liga 2009 «URBA Primera A» (solo 2016 y sin planteles),
 *    ESPN/Datafactory canales urbagrupo2 (Primera A) y urbagrupo3 (Primera B) (2026, resultados sin jugadores y
 *    planteles vacíos), WordPress anterior de la URBA (sin formaciones de Primera A/B 2016–2025).
 * Excluidos: ovalados.com y aplenorugby.com.ar (robots.txt). No se consultan páginas de www.espn.com.ar (su robots.txt
 * excluye agentes de IA); la ruta de Datafactory se obtuvo de su propio main_header.
 *
 * Uso: node scripts/fetch-urba-lineups-primera-ab.mjs [--refresh]
 * Caché crudo fuera del repo (compartido con fetch-urba-lineups.mjs): URBA_LINEUPS_CACHE o $TMPDIR/rm26-urba-lineups-cache.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = process.env.URBA_LINEUPS_CACHE || join(tmpdir(), 'rm26-urba-lineups-cache');
const REFRESH = process.argv.includes('--refresh');
const UA = 'RM26-research/1.0 (analisis local no comercial)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FIRST_SEASON = 2019, LAST_SEASON = 2025;
const fetchedAt = new Map();

/* ---------- Descarga con caché (igual que scripts/fetch-urba-lineups.mjs) ---------- */
async function get(url, { json = true, delay = 1000 } = {}) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  if (!REFRESH && existsSync(file)) { const c = JSON.parse(await readFile(file, 'utf8')); fetchedAt.set(url, c.fetchedAt); return c.body; }
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(delay);
    let res;
    try { res = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'text/html' } }); }
    catch (e) { console.warn(`  red: ${e.message} en ${url}`); await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { const w = Number(res.headers.get('retry-after') || 15) * 1000; console.warn(`  ${res.status} ${url}; espero ${w / 1000}s`); await sleep(w); continue; }
    let body = null;
    if (res.ok) { const text = await res.text(); body = json ? JSON.parse(text) : text; }
    else console.warn(`  ${res.status} ${url}`);
    await mkdir(CACHE, { recursive: true });
    const at = new Date().toISOString();
    await writeFile(file, JSON.stringify({ url, status: res.status, fetchedAt: at, body }));
    fetchedAt.set(url, at);
    return body;
  }
  return null;
}

/* ---------- Clubes ---------- */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Alias de fetch-urba-lineups.mjs más clubes de Primera A/B. Los ids coinciden con research/catalog.json cuando el club existe.
const ALIASES = {
  'alumni': ['alumni', 'asociacionalumni'],
  'belgrano-athletic': ['bac', 'belgranoac', 'belgrano', 'belgranoathletic', 'belgranoathleticclub', 'belgranoath'],
  'casi': ['casi', 'clubatleticodesanisidro', 'clubatleticosanisidro'],
  'sic': ['sic', 'sanisidroclub'],
  'cuba': ['cuba', 'clubuniversitariodebuenosaires'],
  'hindu': ['hindu', 'hinduclub'],
  'newman': ['newman', 'clubnewman', 'cardenalnewman'],
  'pucara': ['pucara', 'clubpucara'],
  'regatas-bella-vista': ['regatasbellavista', 'regatas', 'regatasbv', 'clubregatasdebellavista', 'regatasdebellavista', 'crbv'],
  'san-luis': ['sanluis', 'clubsanluis'],
  'la-plata': ['laplatarugbyclub', 'laplata', 'laplatarc', 'lprc'],
  'atletico-del-rosario': ['clubatleticodelrosario', 'atleticodelrosario', 'atleticoderosario', 'atrosario', 'atldelrosario', 'atlrosario', 'atlderosario', 'atleticorosario'],
  'san-martin': ['sanmartin'],
  'lomas-athletic': ['lomas', 'lomasathletic', 'lomasathleticclub', 'lomasac'],
  'los-tilos': ['lostilos', 'clublostilos'],
  'buenos-aires-crc': ['bacrc', 'buenosairescrc', 'buenosaires', 'buenosairescricketrugbyclub', 'buenosairescricketandrugbyclub', 'bacyrc'],
  'champagnat': ['champagnat', 'clubchampagnat', 'champa'],
  'los-matreros': ['losmatreros', 'clublosmatreros', 'matreros'],
  'mariano-moreno': ['marianomoreno'],
  'san-cirano': ['sancirano'],
  'curupayti': ['curupayti'],
  'pueyrredon': ['pueyrredon'],
  'universitario-la-plata': ['universitariodelaplata', 'universitariolaplata', 'unidelaplata', 'udelaplata', 'ulaplata', 'universitario', 'ulp'],
  'geba': ['geba', 'gimnasiayesgrima', 'gimnasiayesgrimadebuenosaires', 'gimnasiayesgrimabuenosaires'],
  'deportiva-francesa': ['deportivafrancesa', 'depfrancesa', 'deportiva', 'francesa'],
  'san-fernando': ['sanfernando'],
  'hurling': ['hurling', 'hurlingclub'],
  'olivos': ['olivos', 'olivosrugbyclub'],
  'san-andres': ['sanandres'],
  'san-albano': ['sanalbano'],
  'banco-nacion': ['banconacion', 'clubbanconacion'],
  'cu-quilmes': ['cuq', 'cuquilmes', 'cudequilmes', 'clubuniversitariodequilmes', 'universitariodequilmes', 'circulouniversitariodequilmes'],
  'liceo-naval': ['liceonaval'],
  'liceo-militar': ['liceomilitar'],
  'don-bosco': ['donbosco'],
  'manuel-belgrano': ['manuelbelgrano'],
  'san-patricio': ['sanpatricio'],
  'italiano': ['italiano', 'clubitaliano'],
  'argentino': ['argentino', 'argentinoderugby'],
  'delta': ['delta', 'deltarc', 'deltarugbyclub'],
  'monte-grande': ['montegrande'],
  'vicentinos': ['vicentinos'],
  'sitas': ['sitas'],
  'gei': ['gei'],
  'banco-hipotecario': ['bancohipotecario'],
  'ciudad-de-buenos-aires': ['ciudaddebuenosaires', 'ciudaddebsas', 'ciudad'],
  'lanus': ['lanus'],
  'san-carlos': ['sancarlos'],
  'old-georgian': ['oldgeorgian'],
  'floresta': ['floresta'],
  'los-cedros': ['loscedros'],
  'tigre': ['tigre'],
  'virreyes': ['virreyes'],
  'centro-naval': ['centronaval'],
  'albatros': ['albatros'],
  'la-salle': ['lasalle'],
  'st-brendans': ['stbrendans', 'saintbrendans'],
  'el-retiro': ['elretiro'],
  'areco': ['areco'],
  'los-pinos': ['lospinos'],
  'sociedad-hebraica': ['hebraica', 'sociedadhebraica'],
  'daom': ['daom'],
};
// «Universitario» a secas es ambiguo con CUBA/CUQ: se acepta solo como nombre completo, no como subcadena.
const NO_SUBSTR = new Set(['universitario', 'deportiva', 'francesa', 'ciudad', 'argentino', 'delta', 'regatas', 'buenosaires', 'belgrano']);
const ALIAS = new Map(Object.entries(ALIASES).flatMap(([id, l]) => l.map(a => [a, id])));
let SUBSTR = [];
const rebuildSubstr = () => { SUBSTR = [...ALIAS.keys()].filter(a => a.length >= 5 && !NO_SUBSTR.has(a)).sort((a, b) => b.length - a.length); };
rebuildSubstr();
function clubOf(label) {
  const k = norm(label);
  if (!k) return null;
  if (ALIAS.has(k)) return ALIAS.get(k);
  const hit = SUBSTR.find(a => k.includes(a));
  return hit ? ALIAS.get(hit) : null;
}

/* ---------- Texto y parseo de formaciones (copiado de scripts/fetch-urba-lineups.mjs, que ejecuta al importarse) ---------- */
const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ordm: 'º', ordf: 'ª', deg: '°', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'" };
const decode = s => s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? (n.length > 1 ? (decodeNamed(n) ?? m) : m));
function decodeNamed(n) {
  const m = /^([a-zA-Z])(acute|grave|tilde|uml|circ|cedil)$/.exec(n);
  if (!m) return null;
  const mark = { acute: '́', grave: '̀', tilde: '̃', uml: '̈', circ: '̂', cedil: '̧' }[m[2]];
  return (m[1] + mark).normalize('NFC');
}
const htmlToText = h => decode(String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
  .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|p|li)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ').replace(/\n\s*/g, '\n');
const MARK = /(?<![\p{L}\d])(\d{1,2})\s*(?:[-–—.)°º]\s*|\s(?=\p{Lu}))/gu;
const STOPWORDS = /\b(suplentes?|banco|cambios|entrenador(?:es)?|head coach|dt|árbitro|arbitro|en vivo|cancha|estadio|hora|hs)\b.*$/iu;
/** Entradas «N- Nombre». Se admiten nombres de una sola palabra (apellido) porque la nota los numera; se marcan surnameOnly. */
function parseEntries(s) {
  s = s.replace(/\((?:c|cap\.?|capit[áa]n)\)|©/giu, ' ').replace(/\s+/g, ' ');
  const marks = [...s.matchAll(MARK)];
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const n = +marks[i][1];
    let name = s.slice(marks[i].index + marks[i][0].length, i + 1 < marks.length ? marks[i + 1].index : s.length);
    name = name.split(/[,;|]| y (?=\d)/)[0].replace(STOPWORDS, '').replace(/\s+y$/u, '').replace(/[.\s]+$/u, '').replace(/^[.\s-]+/u, '').trim();
    if (n < 1 || n > 30) continue;
    const toks = name.split(' ').filter(Boolean);
    if (toks.length < 1 || toks.length > 6 || !/^[\p{L}][\p{L}.'´`’\- ]+$/u.test(name) || name.length < 3) continue;
    out.push(toks.length === 1 ? { number: n, name, surnameOnly: true } : { number: n, name });
  }
  return out;
}
/** Formato sin números (2019): «Club: a, b, c; d, e; f, g, h; i, j; k, l, m, n; o.» → 15 nombres en orden de camiseta 1–15. */
function parsePositional(s) {
  const items = s.replace(/\((?:c|cap\.?|capit[áa]n)\)|©/giu, ' ').replace(/[.\s]+$/u, '').split(/[,;]/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (items.length !== 15 || !items.every(x => /^[\p{L}][\p{L}.'´`’\- ]{1,40}$/u.test(x))) return null;
  return items.map((name, i) => {
    const t = name.split(' ').filter(Boolean), ini = t.filter(x => /^\p{L}\.$/u.test(x)), rest = t.filter(x => !/^\p{L}\.$/u.test(x));
    if (ini.length && rest.length) return { number: i + 1, name }; // «L. Quercia»: inicial + apellido (se cruza solo en el mismo club)
    if (rest.length >= 2) return { number: i + 1, name, ambiguous: 'apellido compuesto sin nombre de pila' };
    return { number: i + 1, name, surnameOnly: true };
  });
}
const countMarks = s => [...s.matchAll(MARK)].length;
const HEADING = /\b(top ?1[2-4]|primera ?[abc]|segunda|tercera|desarrollo|repechaje|promoci[oó]n)\b/i;
/** Bloques {label, clubId, players[], heading, placeholder}. «Club: Sin confirmar» queda como bloque vacío para no romper los pares. */
function parseBlocks(text) {
  // «Primera A/Primera B: San Albano : 1- …» → se quita el encabezado delante de la etiqueta del club.
  text = text.replace(/^([^:\n]{2,40}):\s*(?=[^:\n]{2,48}\s*:\s*1\s*[-.)])/gmu, (m, h) => `${h}\n`);
  const lines = text.replace(/[–—]/g, '-').split('\n').map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let cur = null, prevShort = null, heading = null;
  for (const line of lines) {
    const lab = /^([^:\d]{2,48}?)\s*:\s*(.*)$/u.exec(line);
    const bench = /^(suplentes?|banco|cambios|reservas?)\b\s*:?\s*(.*)$/iu.exec(line);
    if (bench && cur) { if (cur.positional) cur.bench = bench[2]; else cur.players.push(...parseEntries(bench[2])); prevShort = null; continue; }
    if (lab && /^sin confirmar\.?$/iu.test(lab[2].trim()) && clubOf(lab[1])) { cur = null; blocks.push({ label: lab[1].trim(), clubId: clubOf(lab[1]), players: [], heading, placeholder: true }); continue; }
    if (lab && countMarks(lab[2]) >= 5) {
      const full = lab[1].trim(), last = full.split(/[!?]\s+|(?<=\p{Ll}{3,})\.\s+/u).pop().trim();
      const clubId = clubOf(last) ?? clubOf(full.split(/\.\s+/).slice(-2).join(' '));
      cur = { label: last, clubId, players: parseEntries(lab[2]), heading };
      if (clubId) blocks.push(cur); else { unknownLabels.push(last); cur = null; }
      prevShort = null; continue;
    }
    const pos = lab && clubOf(lab[1]) ? parsePositional(lab[2]) : null;
    if (pos) { cur = { label: lab[1].trim(), clubId: clubOf(lab[1]), players: pos, heading, positional: true }; blocks.push(cur); prevShort = null; continue; }
    if (!lab && countMarks(line) >= 5 && prevShort && clubOf(prevShort)) {
      cur = { label: prevShort, clubId: clubOf(prevShort), players: parseEntries(line), heading };
      blocks.push(cur); prevShort = null; continue;
    }
    if (cur && countMarks(line) >= 3 && /^\s*(1[6-9]|2\d)\s*[-.)]/.test(line)) { cur.players.push(...parseEntries(line)); continue; }
    if (line.length <= 90 && HEADING.test(line) && !lab?.[2]?.includes(',')) heading = line;
    prevShort = line.length <= 48 ? line.replace(/:$/, '') : null;
    if (line.length > 48) cur = null;
  }
  // Un bloque válido trae al menos 10 titulares distintos; los vacíos («sin confirmar») se conservan para emparejar.
  return blocks.map(b => ({ ...b, players: dedupe(b.players) })).filter(b => b.placeholder || b.players.filter(p => p.number <= 15).length >= 10)
    .map(b => b.players.filter(p => p.number <= 15).length >= 10 ? b : { ...b, players: [], placeholder: true });
}
function dedupe(list) { const seen = new Set(); return list.filter(p => { const k = p.number + '|' + norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.number - b.number); }
const unknownLabels = [];

/* ---------- 1. Índice oficial de partidos: API del fixture de urba.org.ar ---------- */
const URBA_API = 'https://urba.org.ar/api/fixture';
const DIVISIONS = { 'primera-a': /^primera a - (superior|play ?off)$/i, 'primera-b': /^primera b - (superior|play ?off)$/i };
const STANDINGS = [];
const playoffRe = /play ?off/i;
const MATCHES = []; // {id, season, division, stage, round, date, homeId, awayId, homeName, awayName, homeScore, awayScore, source}
const indexLog = {};
for (let season = FIRST_SEASON; season <= LAST_SEASON + 1; season++) {
  const menu = await get(`${URBA_API}/menu?seasonId=${season}`, { delay: 1200 });
  const champs = (menu?.championships ?? []).map(c => ({ ...c, name: c.name.replace(/\s+/g, ' ').trim() }));
  indexLog[season] = { championships: champs.length, used: [] };
  for (const [division, re] of Object.entries(DIVISIONS)) {
    for (const c of champs.filter(c => re.test(c.name))) {
      const body = await get(`${URBA_API}/championship/${c.id}`, { delay: 1200 });
      const rounds = body?.championship?.rounds ?? [];
      // Tabla oficial: da clubes y partidos jugados aun cuando la API no publica las fechas (2022).
      if (!playoffRe.test(c.name)) for (const t of body?.standings ?? []) {
        const nm = (t.team?.name ?? '').trim(); if (!nm) continue;
        if (!clubOf(nm)) { ALIAS.set(norm(nm), slug(nm)); rebuildSubstr(); }
        STANDINGS.push({ season, division, clubId: clubOf(nm), name: nm, played: t.played, position: t.position, source: `${URBA_API}/championship/${c.id}` });
      }
      const playoff = /play ?off/i.test(c.name);
      indexLog[season].used.push({ id: c.id, name: c.name, division, rounds: rounds.length, url: `${URBA_API}/championship/${c.id}` });
      for (const r of rounds) for (const m of r.matches ?? []) {
        // Se usa el nombre del equipo: el vínculo team→club de la API es erróneo para San Andrés (figura como club San Albano).
        const hn = (m.local_team?.name ?? m.local_team?.club?.name ?? '').trim(), an = (m.visit_team?.name ?? m.visit_team?.club?.name ?? '').trim();
        for (const nm of [hn, an]) if (!clubOf(nm)) { ALIAS.set(norm(nm), slug(nm)); rebuildSubstr(); }
        const roundNo = /fecha\s*(\d+)/i.exec(r.name)?.[1];
        MATCHES.push({
          id: `urba-${m.id}`, urbaMatchId: m.id, season, division,
          // «Play Off» de la API = promoción entre divisiones (2025: Primera A - Play Off = San Albano/San Martín vs CUQ/Liceo Naval).
          stage: (playoff ? 'promocion-' : '') + (/semi/i.test(r.name) ? 'semifinal' : /final/i.test(r.name) ? 'final' : /cuarto/i.test(r.name) ? 'quarterfinal' : roundNo ? 'regular' : 'playoff'),
          round: roundNo ? +roundNo : null, roundName: r.name, date: String(r.playdate ?? '').slice(0, 10) || null,
          homeId: clubOf(hn), awayId: clubOf(an), homeName: hn, awayName: an,
          homeScore: m.local_team_score ?? null, awayScore: m.visit_team_score ?? null, fulfilled: !!m.fulfilled, suspended: !!m.suspended,
          source: `${URBA_API}/championship/${c.id}`,
        });
      }
    }
  }
}
console.log(`Índice URBA: ${MATCHES.length} partidos de Primera A/B (${Object.entries(indexLog).map(([y, l]) => `${y}: ${l.used.map(u => u.name).join(' + ') || '—'}`).join('; ')})`);

/* ---------- Clubes del máximo torneo por temporada (para no contar como Primera A un lado de Top 12/14) ---------- */
const topResults = JSON.parse(await readFile(join(ROOT, 'research/history/urba-results.json'), 'utf8'));
const TOP_CLUBS = {};
for (const m of topResults.matches) for (const id of [m.homeId, m.awayId]) (TOP_CLUBS[m.season] ??= new Set()).add(id);
const divisionOfClub = (id, season) => TOP_CLUBS[season]?.has(id) ? 'top' : STANDINGS.find(t => t.season === season && t.clubId === id)?.division ?? MATCHES.find(m => m.season === season && (m.homeId === id || m.awayId === id) && m.stage === 'regular')?.division ?? null;

/* ---------- Asignación a partidos (como fetch-urba-lineups.mjs, sobre el índice de Primera A/B) ---------- */
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
// Las notas se publican antes del partido: se prefiere el partido de los 8 días siguientes.
const dateScore = (matchDate, noteDate) => { const d = dayDiff(matchDate, noteDate); return d >= -1 && d <= 8 ? d : 100 + Math.abs(d); };
const looseOf = (b, extra = {}) => ({ label: b.label, clubId: b.clubId, players: b.players.length, ...extra });
function assign(blocks, date, maxDays = 12) {
  const out = [], loose = [];
  const season = +date.slice(0, 4);
  const pool = MATCHES.filter(m => m.season === season && m.date && Math.abs(dayDiff(m.date, date)) <= maxDays);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], next = blocks[i + 1];
    const cands = pool.filter(m => m.homeId === b.clubId || m.awayId === b.clubId).sort((x, y) => dateScore(x.date, date) - dateScore(y.date, date));
    const paired = next && next.clubId !== b.clubId && cands.find(m => m.homeId === next.clubId || m.awayId === next.clubId);
    if (paired) { for (const blk of [b, next]) out.push({ match: paired, side: paired.homeId === blk.clubId ? 'home' : 'away', players: blk.players, label: blk.label }); i++; continue; }
    // Promoción entre el máximo torneo y Primera A (no está en ningún índice): dos bloques seguidos, uno de cada división.
    const dv = next && [divisionOfClub(b.clubId, season), divisionOfClub(next.clubId, season)];
    if (next && next.clubId !== b.clubId && ((dv[0] === 'top' && dv[1] === 'primera-a') || (dv[0] === 'primera-a' && dv[1] === 'top')) && /top|promoci|repechaje|play ?off|final/i.test(b.heading ?? '')) {
      out.push(...promotion(b, next, season, b.heading)); i++; continue;
    }
    loose.push(looseOf(b, { next: next?.clubId ?? null }));
  }
  return { out, loose };
}
function promotion(a, b, season, heading) {
  const m = { id: `${season}-promocion-top-${a.clubId}-${b.clubId}`, season, division: 'primera-a', stage: 'promocion-top', round: null, date: null, homeId: a.clubId, awayId: b.clubId, homeName: a.label, awayName: b.label, unindexed: true, sideOrder: 'orden de la nota (local/visitante no verificado)', heading };
  return [{ match: m, side: 'home', players: a.players, label: a.label }, { match: m, side: 'away', players: b.players, label: b.label }];
}
/** Temporadas sin índice oficial (2019, 2020, 2022): pares consecutivos de la nota. Local/visitante = orden de la nota (no verificado). */
function assignFromNote(blocks, date, url, title) {
  const out = [], loose = [];
  const season = +date.slice(0, 4);
  const urlDivision = /primera-division-b|primera-b/i.test(url + title) ? 'primera-b' : /primera-division-a|primera-a/i.test(url + title) ? 'primera-a' : null;
  const round = /fecha[- ](\d+)/i.exec(url + ' ' + title)?.[1];
  for (let i = 0; i + 1 < blocks.length; i += 2) {
    const [a, b] = [blocks[i], blocks[i + 1]];
    if (a.clubId === b.clubId) { loose.push(looseOf(a)); i--; continue; }
    const h = a.heading ?? '';
    // Encabezado de la nota de repechajes: «Repechaje Top 12: CUBA vs Olivos», «Repechaje Primera A: SITAS vs San Patricio».
    let division = urlDivision, stage = 'regular';
    if (/repechaje|promoci/i.test(h + url)) {
      stage = /top/i.test(h) ? 'promocion-top' : 'promocion';
      division = /top|primera ?a/i.test(h) ? 'primera-a' : /primera ?b/i.test(h) ? 'primera-b' : null;
      if (h && !/top|primera ?[ab]/i.test(h)) division = null; // Primera C, Segunda…
    }
    if (!division) { loose.push(looseOf(a, { reason: `fuera de Primera A/B (${h || 'sin encabezado'})` }), looseOf(b, { reason: 'fuera de Primera A/B' })); continue; }
    const m = { id: `${season}-${division}-${stage === 'regular' ? (round ? 'r' + round : 'nota') : stage}-${a.clubId}-${b.clubId}`, season, division, stage, round: stage === 'regular' && round ? +round : null, date: null, homeId: a.clubId, awayId: b.clubId, homeName: a.label, awayName: b.label, unindexed: true, sideOrder: 'orden de la nota (local/visitante no verificado)', ...(h ? { heading: h } : {}) };
    out.push({ match: m, side: 'home', players: a.players, label: a.label }, { match: m, side: 'away', players: b.players, label: b.label });
  }
  if (blocks.length % 2) loose.push(looseOf(blocks.at(-1)));
  return { out, loose };
}

const lineups = new Map();
function record(match, side, players, src) {
  if (!lineups.has(match.id)) lineups.set(match.id, { match, sources: [] });
  const e = lineups.get(match.id);
  let s = e.sources.find(x => x.url === src.url);
  if (!s) { s = { ...src, home: null, away: null }; e.sources.push(s); }
  if (!s[side]) s[side] = players;
}
const articleLog = [];

/* ---------- 2. Rugby Champagne ---------- */
const CH = 'https://www.rugbychampagneweb.com';
const chUrls = new Set();
const sitemapCounts = {};
for (const s of ['urba/primera-division-a', 'urba/primera-division-b', 'urba', 'urba/top-14']) {
  const xml = await get(`${CH}/sitemap-section/${s}/`, { json: false, delay: 1500 });
  const locs = [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  sitemapCounts[s] = locs.length;
  for (const u of locs) chUrls.add(u);
}
const LINEUP = /formaci|alineaci|equipos-confirmados|con-los-equipos|titulares|los-xv|planteles-confirmados/;
const OTHER = /primera-division-c\/|segunda-division\/|tercera-division\/|desarrollo|juvenil|m19|m17|m16|m15|femenin|seven|intermedia|pre-?[ab]\b|interior|nacional-de-clubes|pumas|seleccion/;
const chCands = [...chUrls].filter(u => LINEUP.test(u) && !OTHER.test(u) && !/formaciones-fijas|conformacion|formacion-integral|staff/.test(u)).sort();
console.log(`Rugby Champagne: ${chUrls.size} URLs en sitemaps, ${chCands.length} candidatas (todas las secciones URBA; se conservan solo partidos de Primera A/B)`);
for (const url of chCands) {
  const html = await get(url, { json: false, delay: 2000 });
  if (!html) { articleLog.push({ source: 'champagne', url, error: 'sin respuesta' }); continue; }
  const date = /"datePublished":"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? /article:published_time" content="(\d{4}-\d{2}-\d{2})/.exec(html)?.[1];
  const title = decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '').replace(/\s*\|\s*Rugby Champagne\s*$/, '');
  if (!date) { articleLog.push({ source: 'champagne', url, title, error: 'sin fecha' }); continue; }
  const season = +date.slice(0, 4);
  if (season < FIRST_SEASON || season > LAST_SEASON) continue;
  const text = htmlToText(html);
  const body = text.slice(Math.max(0, text.indexOf(title.slice(0, 30))), text.indexOf('Recomendadas') > 0 ? text.indexOf('Recomendadas') : undefined);
  const blocks = parseBlocks(body);
  if (!blocks.length) continue;
  const indexed = MATCHES.some(m => m.season === season && m.date);
  const ab = /primera-division-[ab]\/|primera-[ab]\b|repechaje/.test(url);
  let res;
  if (indexed) res = assign(blocks, date);
  else if (ab) res = assignFromNote(blocks, date, url, title);
  else continue; // nota del máximo torneo sin índice de Primera A/B: ya la procesa fetch-urba-lineups.mjs
  const kept = [], skipped = [];
  for (const a of res.out) {
    if (!a.players.length) continue; // «sin confirmar»
    // Un lado de un club que esa temporada jugó el máximo torneo no es una temporada de Primera A/B.
    if (TOP_CLUBS[season]?.has(a.match[a.side + 'Id'])) { skipped.push({ clubId: a.match[a.side + 'Id'], matchId: a.match.id, reason: 'club del máximo torneo esa temporada' }); continue; }
    record(a.match, a.side, a.players, { type: 'champagne', url, publishedAt: date });
    kept.push(a);
  }
  if (kept.length || ab) articleLog.push({ source: 'champagne', url, date, title, blocks: blocks.length, placeholders: blocks.filter(b => b.placeholder).length, assigned: kept.length, skippedTopSides: skipped, unassigned: res.loose.filter(l => l.players) });
}

/* ---------- Salida ---------- */
const catalog = JSON.parse(await readFile(join(ROOT, 'research/catalog.json'), 'utf8'));
const TOP14_2026 = new Set(catalog.clubs.filter(c => c.competitionId === 'top14').map(c => c.id));
const PRIORITY_CLUBS = ['la-plata', 'los-tilos', 'atletico-del-rosario', 'champagnat', 'los-matreros'];
const today = new Date().toISOString().slice(0, 10);
const results = {};
for (const division of ['primera-a', 'primera-b']) {
  const matchesOut = [];
  for (const { match: m, sources } of [...lineups.values()].filter(x => x.match.division === division).sort((a, b) => (a.match.date ?? `${a.match.season}`).localeCompare(b.match.date ?? `${b.match.season}`) || a.match.id.localeCompare(b.match.id))) {
    const best = side => sources.find(s => s[side]?.length);
    const h = best('home'), a = best('away');
    matchesOut.push({
      matchId: m.id, season: m.season, division, round: m.round, stage: m.stage, date: m.date, homeId: m.homeId, awayId: m.awayId,
      homeName: m.homeName, awayName: m.awayName, homeScore: m.homeScore ?? null, awayScore: m.awayScore ?? null,
      indexSource: m.unindexed ? null : m.source, ...(m.unindexed ? { unindexed: true, sideOrder: m.sideOrder } : {}),
      source: (h ?? a).url, homeSource: h?.url ?? null, awaySource: a?.url ?? null,
      home: h?.home ?? [], away: a?.away ?? [],
      otherSources: sources.filter(s => s !== h && s !== a).map(s => ({ type: s.type, url: s.url, home: s.home ?? [], away: s.away ?? [] })),
    });
  }
  const seasons = {};
  for (let y = FIRST_SEASON; y <= LAST_SEASON; y++) {
    if (y === 2020) { seasons[y] = { note: 'Sin torneo (pandemia).' }; continue; }
    const idx = MATCHES.filter(m => m.season === y && m.division === division && !m.suspended);
    const got = matchesOut.filter(x => x.season === y);
    const table = STANDINGS.filter(t => t.season === y && t.division === division);
    const regularFromTable = table.length ? table.reduce((a, t) => a + (t.played ?? 0), 0) / 2 : null;
    seasons[y] = {
      indexedMatches: idx.length || null, withBothSides: got.filter(x => x.home.length && x.away.length).length, withOneSide: got.filter(x => !(x.home.length && x.away.length)).length,
      regularMatchesFromStandings: regularFromTable, clubs: table.map(t => t.clubId),
      ...(idx.length ? {} : { note: regularFromTable ? 'La API de urba.org.ar publica la tabla pero no las fechas: no hay índice de partidos para asignar formaciones.' : 'Sin índice oficial (la API de urba.org.ar no tiene esta temporada); formaciones tomadas de la nota sin verificar fecha ni localía.' }),
    };
    if (idx.length) seasons[y].pctWithLineup = +(100 * got.filter(x => !x.unindexed).length / idx.length).toFixed(1);
    const clubs = {};
    for (const t of table) if (TOP14_2026.has(t.clubId)) clubs[t.clubId] ??= { matches: idx.length ? 0 : t.played, withLineup: 0 };
    for (const m of idx) for (const id of [m.homeId, m.awayId]) if (TOP14_2026.has(id)) { const c = (clubs[id] ??= { matches: 0, withLineup: 0 }); c.matches++; if (got.some(x => x.matchId === m.id && x[(m.homeId === id ? 'home' : 'away')].length)) c.withLineup++; }
    if (!idx.length) for (const x of got) for (const side of ['home', 'away']) { const id = x[side + 'Id']; if (TOP14_2026.has(id) && x[side].length) (clubs[id] ??= { matches: null, withLineup: 0 }).withLineup++; }
    if (Object.keys(clubs).length) seasons[y].clubsNowInTop14 = clubs;
  }
  results[division] = { matchesOut, seasons };
}

/* ---------- Cruce con el catálogo (mismo criterio estricto que scripts/build-player-trajectory.mjs) ---------- */
const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'del', 'y', 'debut']);
const toks = s => n(String(s).replace(/\(debut\)|\*/g, '')).split(' ').filter(t => t && !STOP.has(t));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const close = (a, b) => a === b || (a.length === 1 || b.length === 1 ? a[0] === b[0] : lev(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
const samePerson = (x, y) => { const A = toks(x), B = toks(y); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; if (s.length < 2) return false; return s.every(t => l.some(u => close(t, u))) && s.some(t => t.length >= 5 && l.some(u => u.length >= 5 && close(t, u))); };
function strength(x, y) {
  x = String(x).replace(/['’´`]/g, ''); y = String(y).replace(/['’´`]/g, '');
  if (!samePerson(x, y)) return null;
  const A = toks(x), B = toks(y);
  if (A.some(t => t.length === 1) || B.some(t => t.length === 1)) return 'initial';
  if (!A.slice(0, 1).every(t => B.some(u => close(t, u))) || !B.slice(0, 1).every(t => A.some(u => close(t, u)))) return 'subset';
  return A.length === B.length ? 'exact' : 'subset';
}
const RANK = { exact: 3, subset: 2, initial: 1 };
const players = catalog.players;
const namesOf = p => [p.name, ...(p.nameAliases ?? [])];
const bestStrength = (p, name) => namesOf(p).map(a => strength(a, name)).filter(Boolean).sort((a, b) => RANK[b] - RANK[a])[0] ?? null;
let trajectory = null;
try { trajectory = JSON.parse(await readFile(join(ROOT, 'research/history/player-trajectory.json'), 'utf8')).players; } catch { /* opcional */ }

const entries = new Map();
let surnameOnlySkipped = 0;
for (const division of ['primera-a', 'primera-b']) for (const m of results[division].matchesOut) {
  const lists = [{ url: m.homeSource, side: 'home', list: m.home }, { url: m.awaySource, side: 'away', list: m.away },
    ...m.otherSources.flatMap(o => [{ url: o.url, side: 'home', list: o.home }, { url: o.url, side: 'away', list: o.away }])];
  for (const { url, side, list } of lists) for (const p of list ?? []) {
    if (p.surnameOnly || p.ambiguous) { surnameOnlySkipped++; continue; } // sin nombre de pila: no se cruza
    const clubId = side === 'home' ? m.homeId : m.awayId;
    const k = `${division}|${m.season}|${clubId}|${n(p.name)}`;
    if (!entries.has(k)) entries.set(k, { division, season: m.season, clubId, name: p.name, matches: new Set(), sources: new Set() });
    entries.get(k).matches.add(m.matchId); entries.get(k).sources.add(url);
  }
}
const links = [], doubtful = [];
for (const e of entries.values()) {
  if (toks(e.name).length < 2) continue;
  const cands = players.map(p => ({ p, s: bestStrength(p, e.name) })).filter(c => c.s);
  if (!cands.length) continue;
  const same = cands.filter(c => c.p.clubId === e.clubId);
  let pick = null;
  if (same.length) {
    const top = Math.max(...same.map(c => RANK[c.s]));
    const best = same.filter(c => RANK[c.s] === top);
    if (best.length !== 1) { doubtful.push({ ...e, reason: 'ambiguo entre jugadores del mismo club', candidates: best.map(c => c.p.id) }); continue; }
    pick = best[0];
  } else {
    const exact = cands.filter(c => c.s === 'exact' && namesOf(c.p).some(a => toks(a).join(' ') === toks(e.name).join(' ')));
    if (exact.length === 1 && cands.length === 1) pick = { ...exact[0], otherClub: true };
    else { doubtful.push({ ...e, reason: cands.length > 1 ? 'coincide con varios jugadores de otros clubes' : 'coincidencia parcial con jugador de otro club (no se acepta)', candidates: cands.map(c => c.p.id) }); continue; }
  }
  // Fecha acreditada: descarta temporadas con < 17 años (homónimo probable).
  const by = pick.p.birthDate ? +String(pick.p.birthDate).slice(0, 4) : null;
  if (by && e.season - by < 17) { doubtful.push({ ...e, reason: `edad < 17 con nacimiento ${by}`, candidates: [pick.p.id] }); continue; }
  links.push({ playerId: pick.p.id, catalogName: pick.p.name, catalogClubId: pick.p.clubId, division: e.division, season: e.season, clubId: e.clubId, name: e.name, strength: pick.s, otherClub: !!pick.otherClub, matches: [...e.matches], sources: [...e.sources] });
}
// Otro club con nombre idéntico: si esa temporada el jugador figura en su club (máximo torneo o Primera A/B), es otra persona.
const linkKept = links.filter(l => {
  if (!l.otherClub) return true;
  const t = trajectory?.[l.playerId];
  const ownSeasons = new Set([...(t?.seasons ?? []), ...links.filter(x => x.playerId === l.playerId && !x.otherClub).map(x => x.season)]);
  if (ownSeasons.has(l.season)) { doubtful.push({ ...l, reason: 'mismo nombre en otro club la misma temporada (homónimo probable)', candidates: [l.playerId] }); return false; }
  return true;
});
const byPlayer = {};
for (const l of linkKept) {
  const p = (byPlayer[l.playerId] ??= { name: l.catalogName, clubId: l.catalogClubId, seasons: {}, existingTopSeasons: trajectory?.[l.playerId]?.seasons ?? [] });
  const s = (p.seasons[l.season] ??= { division: l.division, clubs: new Set(), matches: new Set(), names: new Set(), strength: l.strength });
  s.clubs.add(l.clubId); l.matches.forEach(x => s.matches.add(x)); s.names.add(l.name);
  if (RANK[l.strength] < RANK[s.strength]) s.strength = l.strength;
}
const crossmatch = Object.entries(byPlayer).map(([id, p]) => {
  const seasons = Object.entries(p.seasons).map(([y, s]) => ({ season: +y, division: s.division, clubs: [...s.clubs], matches: s.matches.size, names: [...s.names], strength: s.strength, alreadyInTopTrajectory: p.existingTopSeasons.includes(+y) }));
  return { playerId: id, name: p.name, clubId: p.clubId, seasons, newSeasons: seasons.filter(s => !s.alreadyInTopTrajectory).map(s => s.season) };
}).sort((a, b) => a.clubId.localeCompare(b.clubId) || a.name.localeCompare(b.name));

/* ---------- Escritura ---------- */
const sourcesPolicy = {
  urbaApi: 'Índice oficial de partidos: API pública del fixture de urba.org.ar (/api/fixture/menu y /api/fixture/championship). 2021–2026; 2019 y 2020 sin datos. Solo resultados, sin formaciones.',
  champagne: 'Rugby Champagne: notas de formaciones anunciadas (prensa) de sus sitemaps de sección URBA. Única fuente con formaciones de Primera A/B encontrada; cobertura mínima.',
  surveyedWithoutLineups: [
    'ESPN API (site.api.espn.com, liga 2009 «URBA Primera A»): temporadas hasta 2016 y partidos 2026/2027 sin jugar; 2016 trae 984 partidos de todas las divisiones URBA y los summaries no traen rosters. Sin 2017–2025.',
    'ESPN/Datafactory (espn.datafactory.la, canales urbagrupo2 = Primera A, urbagrupo3 = Primera B): solo temporada 2026; fichas de partido con resultado y sin jugadores; página de planteles con equipos vacíos.',
    'WordPress anterior de la URBA (urbaweb.azurewebsites.net/wp-json): sin notas de formaciones de Primera A/B entre 2016 y 2025.',
  ],
  excluded: ['ovalados.com y aplenorugby.com.ar: excluidos por robots.txt', 'www.espn.com.ar: su robots.txt excluye agentes de IA; no se consultó (la ruta de Datafactory se obtuvo de espn.datafactory.la)'],
};
for (const division of ['primera-a', 'primera-b']) {
  const { matchesOut, seasons } = results[division];
  if (!matchesOut.length) { console.log(`${division}: sin formaciones; no se escribe archivo`); continue; }
  const out = {
    generatedAt: today, division,
    description: `Formaciones publicadas (titulares y suplentes cuando la fuente los informa) de partidos de ${division === 'primera-a' ? 'Primera A' : 'Primera B'} URBA ${FIRST_SEASON}–${LAST_SEASON}. Mismo formato que urba-lineups.json más division, nombres de club del índice y marcador oficial. Todas las formaciones son de prensa (Rugby Champagne, anunciadas antes del partido). Los nombres se transcriben tal como los publica la fuente.`,
    sourcesPolicy, coverage: { seasons },
    matches: matchesOut,
    articles: articleLog.filter(a => a.unassigned || a.assigned),
    catalogCrossmatch: crossmatch.filter(c => c.seasons.some(s => s.division === division)).map(c => ({ ...c, seasons: c.seasons.filter(s => s.division === division) })),
  };
  await writeFile(join(ROOT, `research/history/urba-lineups-${division}.json`), JSON.stringify(out, null, 1) + '\n');
}

/* ---------- Resumen para el informe ---------- */
console.log('\nCobertura (partidos con formación / partidos del índice):');
for (const division of ['primera-a', 'primera-b']) for (const [y, s] of Object.entries(results[division].seasons)) console.log(`  ${division} ${y}: ${s.note && !s.indexedMatches && s.withBothSides === undefined ? s.note : `${s.withBothSides + s.withOneSide}/${s.indexedMatches ?? '?'} (ambos lados ${s.withBothSides})${s.clubsNowInTop14 ? ' · clubes Top14-2026: ' + Object.entries(s.clubsNowInTop14).map(([c, v]) => `${c} ${v.withLineup}/${v.matches}`).join(', ') : ''}`}`);
console.log('\nArtículos con bloques de Primera A/B:');
for (const a of articleLog.filter(a => a.blocks)) console.log(`  ${a.date} ${a.url.replace(CH, '')} bloques=${a.blocks} asignados=${a.assigned} sueltos=${a.unassigned.map(u => u.clubId).join(',')}`);
console.log(`\nCruce con catálogo: ${crossmatch.length} jugadores vinculados; ${crossmatch.filter(c => c.newSeasons.length).length} ganan temporadas nuevas (${crossmatch.reduce((s, c) => s + c.newSeasons.length, 0)} temporadas)`);
for (const c of crossmatch) console.log(`  ${c.clubId} ${c.name}: ${c.seasons.map(s => `${s.season}${s.division === 'primera-b' ? 'B' : 'A'}(${s.matches}p,${s.strength}${s.alreadyInTopTrajectory ? ',ya' : ''}${s.clubs[0] !== c.clubId ? ',' + s.clubs.join('/') : ''})`).join(' ')}`);
console.log(`Entradas solo con apellido (no cruzadas): ${surnameOnlySkipped}`);
console.log(`Dudosos no vinculados: ${doubtful.length}`);
for (const d of doubtful) console.log(`  ${d.season} ${d.clubId} «${d.name}»: ${d.reason} → ${d.candidates?.join(', ')}`);
if (unknownLabels.length) console.log(`Etiquetas de bloque sin club reconocido: ${[...new Set(unknownLabels)].slice(0, 30).join(' | ')}`);
console.log('\nTop14-2026 por temporada en Primera A según el índice:');
for (let y = 2021; y <= LAST_SEASON; y++) console.log(`  ${y}: ${[...new Set(MATCHES.filter(m => m.season === y && m.division === 'primera-a').flatMap(m => [m.homeId, m.awayId]))].filter(id => TOP14_2026.has(id)).join(', ')}`);
console.log(`Clubes prioritarios: ${PRIORITY_CLUBS.join(', ')}`);
