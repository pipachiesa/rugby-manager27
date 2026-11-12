#!/usr/bin/env node
/**
 * Reúne formaciones (titulares y suplentes) del máximo torneo URBA (Top 14 2016, Top 12 2017–2025, Top 13 2022)
 * y escribe research/history/urba-lineups.json. Índice de partidos: research/history/urba-results.json.
 *
 * Fuentes (solo lectura, pedidos espaciados, sin credenciales, respetando robots.txt):
 *  - ESPN: API pública de partido (site.web.api.espn.com/.../summary?event=ID). Ese host no publica robots.txt
 *    (responde 403), lo que según RFC 9309 equivale a sin restricciones. Trae planteles de 23 desde 2024.
 *  - URBA: WordPress histórico (urbaweb.azurewebsites.net, wp-json; sin robots.txt). Informes de partido y
 *    formaciones, sobre todo de playoffs.
 *  - Rugby Champagne: notas «formaciones confirmadas» listadas en su sitemap de sección URBA (robots: Allow /).
 * Excluidas a propósito: A Pleno Rugby (robots.txt «Disallow: /» para agentes genéricos), Entre Palos
 * (robots.txt pide 60 s entre pedidos y 3–6 documentos por hora; inviable para un barrido) y ovalados.com.
 *
 * Uso: node scripts/fetch-urba-lineups.mjs [--refresh]
 * Caché crudo fuera del repo: URBA_LINEUPS_CACHE o $TMPDIR/rm26-urba-lineups-cache.
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
const LAST_SEASON = 2025; // 2026 ya está en research/catalog.json (players[].appearances)

async function get(url, { json = true, delay = 1000 } = {}) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.json');
  if (!REFRESH && existsSync(file)) return JSON.parse(await readFile(file, 'utf8')).body;
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
    await writeFile(file, JSON.stringify({ url, status: res.status, fetchedAt: new Date().toISOString(), body }));
    return body;
  }
  return null;
}

/* ---------- Clubes ---------- */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
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
};
const ALIAS = new Map(Object.entries(ALIASES).flatMap(([id, l]) => l.map(a => [a, id])));
const SUBSTR = [...ALIAS.keys()].filter(a => a.length >= 5).sort((a, b) => b.length - a.length);
function clubOf(label) {
  const k = norm(label);
  if (!k) return null;
  if (ALIAS.has(k)) return ALIAS.get(k);
  const hit = SUBSTR.find(a => k.includes(a));
  return hit ? ALIAS.get(hit) : null;
}

/* ---------- Texto y parseo de formaciones ---------- */
const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ordm: 'º', ordf: 'ª', deg: '°', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'" };
const decode = s => s.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? (n.length > 1 ? (decodeNamed(n) ?? m) : m));
function decodeNamed(n) { // á, ñ, ü…
  const m = /^([a-zA-Z])(acute|grave|tilde|uml|circ|cedil)$/.exec(n);
  if (!m) return null;
  const mark = { acute: '́', grave: '̀', tilde: '̃', uml: '̈', circ: '̂', cedil: '̧' }[m[2]];
  return (m[1] + mark).normalize('NFC');
}
const htmlToText = h => decode(String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
  .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|p|li)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ').replace(/\n\s*/g, '\n');

const MARK = /(?<![\p{L}\d])(\d{1,2})\s*(?:[-–—.)°º]\s*|\s(?=\p{Lu}))/gu;
const STOPWORDS = /\b(suplentes?|banco|cambios|entrenador(?:es)?|head coach|dt|árbitro|arbitro|en vivo|cancha|estadio|hora|hs)\b.*$/iu;
function parseEntries(s) {
  s = s.replace(/\((?:c|cap\.?|capit[áa]n)\)/giu, ' ').replace(/\s+/g, ' ');
  const marks = [...s.matchAll(MARK)];
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const n = +marks[i][1];
    let name = s.slice(marks[i].index + marks[i][0].length, i + 1 < marks.length ? marks[i + 1].index : s.length);
    name = name.split(/[,;|]| y (?=\d)/)[0].replace(STOPWORDS, '').replace(/\s+y$/u, '').replace(/[.\s]+$/u, '').replace(/^[.\s-]+/u, '').trim();
    if (n < 1 || n > 30) continue;
    const toks = name.split(' ').filter(Boolean);
    if (toks.length < 2 || toks.length > 6 || !/^[\p{L}][\p{L}.'´`’\- ]+$/u.test(name) || name.length < 5) continue;
    out.push({ number: n, name });
  }
  return out;
}
const countMarks = s => [...s.matchAll(MARK)].length;
/** Bloques {label, clubId, players[]} de un texto con formaciones «CLUB: 1- Nombre, 2- Nombre…». */
function parseBlocks(text) {
  const lines = text.replace(/[–—]/g, '-').split('\n').map(l => l.trim()).filter(Boolean);
  const blocks = [];
  let cur = null, prevShort = null;
  for (const line of lines) {
    const lab = /^([^:\d]{2,48}?)\s*:\s*(.*)$/u.exec(line);
    const bench = /^(suplentes?|banco|cambios|reservas?)\b\s*:?\s*(.*)$/iu.exec(line);
    if (bench && cur) { cur.players.push(...parseEntries(bench[2])); prevShort = null; continue; }
    if (lab && countMarks(lab[2]) >= 5) {
      const full = lab[1].trim(), last = full.split(/[!?]\s+|(?<=\p{Ll}{3,})\.\s+/u).pop().trim();
      const clubId = clubOf(last) ?? clubOf(full.split(/\.\s+/).slice(-2).join(' '));
      const label = last;
      cur = { label, clubId, players: parseEntries(lab[2]) };
      if (clubId) blocks.push(cur); else cur = null;
      prevShort = null; continue;
    }
    if (!lab && countMarks(line) >= 5 && prevShort && clubOf(prevShort)) {
      cur = { label: prevShort, clubId: clubOf(prevShort), players: parseEntries(line) };
      blocks.push(cur); prevShort = null; continue;
    }
    if (cur && countMarks(line) >= 3 && /^\s*(1[6-9]|2\d)\s*[-.)]/.test(line)) { cur.players.push(...parseEntries(line)); continue; }
    prevShort = line.length <= 48 ? line.replace(/:$/, '') : null;
    if (line.length > 48) cur = null;
  }
  // Un bloque válido trae al menos 10 titulares distintos.
  return blocks.map(b => ({ ...b, players: dedupe(b.players) })).filter(b => b.players.filter(p => p.number <= 15).length >= 10);
}
function dedupe(list) { const seen = new Set(); return list.filter(p => { const k = p.number + '|' + norm(p.name); if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.number - b.number); }

/* ---------- Asignación a partidos ---------- */
const results = JSON.parse(await readFile(join(ROOT, 'research/history/urba-results.json'), 'utf8'));
const MATCHES = results.matches.filter(m => m.season <= LAST_SEASON);
const dayDiff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
/** Empareja bloques consecutivos con partidos de la temporada; devuelve asignaciones y bloques sin partido. */
function assign(blocks, date, maxDays = 12) {
  const out = [], loose = [];
  const season = +date.slice(0, 4);
  const pool = MATCHES.filter(m => m.season === season && Math.abs(dayDiff(m.date, date)) <= maxDays);
  const used = new Set();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i], next = blocks[i + 1];
    const cands = pool.filter(m => m.homeId === b.clubId || m.awayId === b.clubId)
      .sort((x, y) => Math.abs(dayDiff(x.date, date)) - Math.abs(dayDiff(y.date, date)));
    const paired = next && cands.find(m => (m.homeId === next.clubId || m.awayId === next.clubId) && next.clubId !== b.clubId);
    // Solo se asignan pares de rivales: un bloque suelto no permite saber a qué partido corresponde.
    const m = paired ?? null;
    if (!m) { loose.push({ label: b.label, clubId: b.clubId, players: b.players.length }); continue; }
    for (const blk of paired ? [b, next] : [b]) {
      const side = m.homeId === blk.clubId ? 'home' : 'away';
      if (used.has(m.id + side)) continue;
      used.add(m.id + side);
      out.push({ match: m, side, players: blk.players, label: blk.label });
    }
    if (paired) i++;
  }
  return { out, loose };
}

const lineups = new Map(); // matchId -> {sources: []}
const PRIORITY = { espn: 0, urba: 1, champagne: 2 };
function record(match, side, players, src) {
  if (!lineups.has(match.id)) lineups.set(match.id, { match, sources: [] });
  const e = lineups.get(match.id);
  let s = e.sources.find(x => x.url === src.url);
  if (!s) { s = { ...src, home: null, away: null }; e.sources.push(s); }
  if (!s[side]) s[side] = players;
}
const articleLog = [];

/* ---------- 1. ESPN ---------- */
const espnSummary = id => `https://site.web.api.espn.com/apis/site/v2/sports/rugby/289279/summary?event=${id}`;
const espnMatchUrl = id => `https://www.espn.com/rugby/match/_/gameId/${id}/league/289279`;
const ESPN_FROM = 2023; // muestras de 2017–2023 (18 partidos, 3 por temporada) no traen planteles; 2023 se revisa completo como control
const espnMatches = MATCHES.filter(m => m.source?.espnId && m.season >= ESPN_FROM);
console.log(`ESPN: ${espnMatches.length} partidos con id`);
const espnBySeason = {};
for (const [i, m] of espnMatches.entries()) {
  const body = await get(espnSummary(m.source.espnId), { delay: 900 });
  const rs = body?.rosters ?? [];
  const st = (espnBySeason[m.season] ??= { checked: 0, withRoster: 0 });
  st.checked++;
  let any = false;
  for (const r of rs) {
    const players = (r.roster ?? []).map(p => ({ number: Number(p.jersey) || null, name: p.athlete?.displayName ?? p.athlete?.fullName, starter: !!p.starter })).filter(p => p.name);
    if (players.length < 10) continue;
    any = true;
    record(m, r.homeAway === 'home' ? 'home' : 'away', players.sort((a, b) => (a.number ?? 99) - (b.number ?? 99)).map(({ number, name }) => ({ number, name })), { type: 'espn', url: espnMatchUrl(m.source.espnId), api: espnSummary(m.source.espnId) });
  }
  if (any) st.withRoster++;
  if (i % 100 === 0) console.log(`  ESPN ${i}/${espnMatches.length}`);
}

/* ---------- 2. URBA (WordPress histórico) ---------- */
const URBA = 'https://urbaweb.azurewebsites.net/wp-json/wp/v2/posts';
const urbaPosts = new Map();
for (const q of ['Top 12', 'Top 13', 'Top 14', 'formaciones']) {
  for (let page = 1; page < 40; page++) {
    const url = `${URBA}?search=${encodeURIComponent(q)}&after=2016-01-01T00:00:00&before=2026-01-01T00:00:00&per_page=50&page=${page}&_fields=id,date,link,title,content`;
    const body = await get(url, { delay: 1500 });
    if (!Array.isArray(body) || !body.length) break;
    for (const p of body) urbaPosts.set(p.id, p);
    if (body.length < 50) break;
  }
}
console.log(`URBA: ${urbaPosts.size} notas`);
for (const p of [...urbaPosts.values()].sort((a, b) => a.date.localeCompare(b.date))) {
  const blocks = parseBlocks(htmlToText(p.content?.rendered ?? ''));
  if (!blocks.length) continue;
  const date = p.date.slice(0, 10);
  const { out, loose } = assign(blocks, date);
  const url = p.link.replace('urbaweb.azurewebsites.net', 'urba.org.ar');
  for (const a of out) record(a.match, a.side, a.players, { type: 'urba', url, wpId: p.id, publishedAt: date });
  articleLog.push({ source: 'urba', url, date, title: htmlToText(p.title?.rendered ?? '').trim(), blocks: blocks.length, assigned: out.length, unassigned: loose });
}

/* ---------- 3. Rugby Champagne ---------- */
const CH = 'https://www.rugbychampagneweb.com';
const chUrls = new Set();
for (const s of ['urba', 'urba/top-14']) {
  const xml = await get(`${CH}/sitemap-section/${s}/`, { json: false, delay: 1500 });
  for (const m of String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/g)) chUrls.add(m[1]);
}
const OTHER = /primera-division-[abc]\/|segunda-division\/|tercera-division\/|desarrollo|juvenil|m19|m17|m16|m15|femenin|seven|intermedia|pre-?[ab]\b|interior|nacional-de-clubes|pumas/;
const chCands = [...chUrls].filter(u => /formaci|alineaci|equipos-confirmados|con-los-equipos|titulares|los-xv|planteles-confirmados/.test(u) && !OTHER.test(u) && !/formaciones-fijas|conformacion|formacion-integral/.test(u)).sort();
console.log(`Rugby Champagne: ${chUrls.size} URLs en sitemaps, ${chCands.length} candidatas`);
for (const url of chCands) {
  const html = await get(url, { json: false, delay: 2000 });
  if (!html) { articleLog.push({ source: 'champagne', url, error: 'sin respuesta' }); continue; }
  const date = /"datePublished":"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1] ?? /article:published_time" content="(\d{4}-\d{2}-\d{2})/.exec(html)?.[1];
  const title = decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '').replace(/\s*\|\s*Rugby Champagne\s*$/, '');
  if (!date) { articleLog.push({ source: 'champagne', url, title, error: 'sin fecha' }); continue; }
  const text = htmlToText(html);
  const body = text.slice(Math.max(0, text.indexOf(title.slice(0, 30))), text.indexOf('Recomendadas') > 0 ? text.indexOf('Recomendadas') : undefined);
  const blocks = parseBlocks(body);
  const { out, loose } = blocks.length ? assign(blocks, date) : { out: [], loose: [] };
  for (const a of out) record(a.match, a.side, a.players, { type: 'champagne', url, publishedAt: date });
  articleLog.push({ source: 'champagne', url, date, title, blocks: blocks.length, assigned: out.length, unassigned: loose });
}

/* ---------- Salida ---------- */
const matchesOut = [];
for (const { match: m, sources } of [...lineups.values()].sort((a, b) => a.match.date.localeCompare(b.match.date) || a.match.id.localeCompare(b.match.id))) {
  sources.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type]);
  const best = side => sources.find(s => s[side]?.length);
  const h = best('home'), a = best('away');
  matchesOut.push({
    matchId: m.id, season: m.season, round: m.round, stage: m.stage, date: m.date, homeId: m.homeId, awayId: m.awayId,
    source: (h ?? a).url, homeSource: h?.url ?? null, awaySource: a?.url ?? null,
    home: h?.home ?? [], away: a?.away ?? [],
    otherSources: sources.filter(s => s !== h && s !== a).map(s => ({ type: s.type, url: s.url, home: s.home ?? [], away: s.away ?? [] })),
  });
}

const seasons = {};
for (const m of MATCHES) {
  const s = (seasons[m.season] ??= { matches: 0, withBothSides: 0, withOneSide: 0, bySource: {} });
  s.matches++;
}
for (const x of matchesOut) {
  const s = seasons[x.season];
  if (x.home.length && x.away.length) s.withBothSides++; else s.withOneSide++;
  for (const t of new Set([x.homeSource, x.awaySource].filter(Boolean).map(u => u.includes('espn.com') ? 'espn' : u.includes('urba.org.ar') ? 'urba' : 'champagne'))) s.bySource[t] = (s.bySource[t] ?? 0) + 1;
}
for (const [y, s] of Object.entries(seasons)) s.pctBothSides = +(100 * s.withBothSides / s.matches).toFixed(1);

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  description: 'Formaciones publicadas (titulares y suplentes cuando la fuente los informa) de partidos del máximo torneo URBA anteriores a 2026. Una entrada por partido; home/away se toman de la fuente de mayor prioridad que informa ese lado (ESPN > URBA > Rugby Champagne). otherSources guarda las listas de otras fuentes del mismo partido. Los nombres se transcriben tal como los publica la fuente.',
  sourcesPolicy: {
    espn: 'API pública de partido; planteles disponibles desde 2024 (muestras 2017–2023 sin planteles).',
    urba: 'WordPress histórico de la URBA (wp-json). Mayormente playoffs y algunas fechas regulares.',
    champagne: 'Rugby Champagne: notas de formaciones de su sitemap de sección URBA/Top 14.',
    excluded: ['aplenorugby.com.ar: robots.txt Disallow / para agentes genéricos', 'entrepalosrugby.com.ar: robots.txt Crawl-delay 60 y 3–6 documentos/hora', 'ovalados.com: /data excluido por robots'],
  },
  coverage: { espnBySeason, seasons },
  matches: matchesOut,
  articles: articleLog,
};
await writeFile(join(ROOT, 'research/history/urba-lineups.json'), JSON.stringify(out, null, 1) + '\n');
console.log('Cobertura por temporada (partidos con ambos lados / total):');
for (const [y, s] of Object.entries(seasons)) console.log(`  ${y}: ${s.withBothSides}/${s.matches} (${s.pctBothSides}%) + ${s.withOneSide} con un solo lado · ${JSON.stringify(s.bySource)}`);
