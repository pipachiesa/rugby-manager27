#!/usr/bin/env node
/**
 * Reúne resultados históricos del máximo torneo URBA (Top 14 2016, Top 12 2017–2025, Top 13 2022, Top 14 2026)
 * y escribe research/history/urba-results.json.
 *
 * Fuentes (solo lectura, pedidos moderados, sin credenciales):
 *  - ESPN (API pública del sitio, alimentada por Opta): scoreboard por temporada de la liga 289279 «URBA Top 14».
 *  - Wikipedia en español: páginas de temporada (2016–2018 tienen todos los partidos con enlace a A Pleno Rugby;
 *    2019–2026 solo tabla final, usada como control cruzado).
 *  - ESPN/Datafactory: fixture y ficha por partido de 2026 (tries, conversiones, penales, drops).
 *  - research/catalog.json: fixture oficial 2026 (rondas) y tabla historical2026 (control).
 *
 * Uso: node scripts/fetch-urba-history.mjs [--refresh]
 * Las respuestas crudas se guardan en un caché fuera del repositorio (URBA_HISTORY_CACHE o el tmp del sistema),
 * de modo que una segunda ejecución no vuelve a consultar la red.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = process.env.URBA_HISTORY_CACHE || join(tmpdir(), 'rm26-urba-history-cache');
const REFRESH = process.argv.includes('--refresh');
const UA = 'RM26-research/1.0 (analisis local no comercial)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const accessLog = new Map();

async function get(url, { json = true, delay = 700 } = {}) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + (json ? '.json' : '.txt'));
  if (!REFRESH && existsSync(file)) {
    const cached = JSON.parse(await readFile(file, 'utf8'));
    accessLog.set(url, cached.fetchedAt);
    return cached.body;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(delay);
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: json ? 'application/json' : 'text/html,text/plain' } });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after') || 10) * 1000;
      console.warn(`  ${res.status} en ${url}; espero ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const text = await res.text();
    const body = json ? JSON.parse(text) : text;
    const fetchedAt = new Date().toISOString();
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, JSON.stringify({ url, fetchedAt, body }));
    accessLog.set(url, fetchedAt);
    return body;
  }
  throw new Error(`Demasiados reintentos: ${url}`);
}

/* ---------- Normalización de clubes ---------- */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIASES = {
  'alumni': ['alumni', 'asociacionalumni'],
  'belgrano-athletic': ['belgranoac', 'belgrano', 'belgranoathletic', 'belgranoathleticclub'],
  'casi': ['casi', 'clubatleticodesanisidro', 'clubatleticosanisidro'],
  'sic': ['sic', 'sanisidroclub'],
  'cuba': ['cuba', 'clubuniversitariodebuenosaires'],
  'hindu': ['hindu', 'hinduclub'],
  'newman': ['newman', 'clubnewman'],
  'pucara': ['pucara', 'clubpucara'],
  'regatas-bella-vista': ['regatasbellavista', 'regatas', 'regatasbv', 'clubregatasdebellavista', 'regatasdebellavista'],
  'san-luis': ['sanluis', 'clubsanluis', 'clubsanluisrugby'],
  'la-plata': ['laplatarugbyclub', 'laplata', 'laplatarc'],
  'atletico-del-rosario': ['clubatleticodelrosario', 'atleticodelrosario', 'atleticoderosario', 'atrosario', 'atldelrosario', 'altrosario'],
  'san-martin': ['sanmartin', 'clubatleticoferrocarrilgeneralsanmartin'],
  'lomas-athletic': ['lomas', 'lomasathletic', 'lomasathleticclub'],
  'los-tilos': ['lostilos', 'clublostilos'],
  'buenos-aires-crc': ['bacrc', 'buenosairescrc', 'buenosaires', 'buenosairescricketrugbyclub', 'buenosairescricketandrugbyclub'],
  'champagnat': ['champagnat', 'clubchampagnat'],
  'los-matreros': ['losmatreros', 'clublosmatreros'],
  'mariano-moreno': ['marianomoreno', 'clubmarianomoreno'],
  'san-cirano': ['sancirano'],
  'curupayti': ['curupayti'],
  'pueyrredon': ['pueyrredon'],
};
const ALIAS = new Map(Object.entries(ALIASES).flatMap(([id, list]) => list.map(a => [a, id])));
const unknownNames = new Set();
function clubId(name) {
  const id = ALIAS.get(norm(name));
  if (!id) unknownNames.add(name);
  return id ?? null;
}

/* ---------- ESPN ---------- */
const ESPN_LEAGUE = 289279;
const espnScoreboard = y => `https://site.api.espn.com/apis/site/v2/sports/rugby/${ESPN_LEAGUE}/scoreboard?dates=${y}&limit=1000`;
const espnMatchUrl = id => `https://www.espn.com/rugby/match/_/gameId/${id}/league/${ESPN_LEAGUE}`;
function espnEvents(y, sb) {
  const out = [];
  for (const e of sb.events ?? []) {
    const c = e.competitions[0];
    const side = ha => c.competitors.find(t => t.homeAway === ha);
    const h = side('home'), a = side('away');
    const stats = t => Object.fromEntries((t.statistics ?? []).map(s => [s.name, Number(s.displayValue)]));
    const sh = stats(h), sa = stats(a);
    const comp = s => s.tries === undefined ? null : { tries: s.tries, conversions: s.conversionGoals, penaltyGoals: s.penaltyGoals, dropGoals: s.dropGoalsConverted };
    out.push({
      espnId: e.id, date: e.date.slice(0, 10), datetimeUtc: e.date, status: e.status.type.name,
      homeName: h.team.displayName, awayName: a.team.displayName,
      homeId: clubId(h.team.displayName), awayId: clubId(a.team.displayName),
      homeScore: Number(h.score), awayScore: Number(a.score),
      homeComp: comp(sh), awayComp: comp(sa), neutral: !!c.neutralSite,
    });
  }
  return out.sort((x, y) => x.datetimeUtc.localeCompare(y.datetimeUtc) || x.espnId.localeCompare(y.espnId));
}
const compPoints = c => c && 5 * c.tries + 2 * c.conversions + 3 * c.penaltyGoals + 3 * c.dropGoals;

/* ---------- Wikipedia ---------- */
const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const pad = n => String(n).padStart(2, '0');
function spanishDate(text, year) {
  const m = /(\d{1,2})\s+de\s+([a-záéíóú]+)/i.exec(text ?? '');
  if (!m || !MONTHS[m[2].toLowerCase()]) return null;
  return `${year}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
}
async function wikiPage(title) {
  const api = `https://es.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const body = await get(api, { delay: 2500 });
  const page = body.query.pages[0];
  if (page.missing) return null;
  const rev = page.revisions[0];
  return { title, revid: rev.revid, timestamp: rev.timestamp, text: rev.slots.main.content, url: `https://es.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&oldid=${rev.revid}` };
}
function teamFromCell(cell) {
  let s = cell.replace(/\{\{refn[\s\S]*?\}\}/g, '').replace(/\[\[(?:Archivo|File|Imagen):[^\]]*\]\]/gi, '').replace(/bgcolor=#?\w+\s*\|/i, '').replace(/'''?/g, '').replace(/<[^>]+>/g, '');
  const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(s);
  const name = link ? (link[2] ?? link[1]) : s;
  const clean = name.replace(/\(.*?\)/g, '').trim();
  return { name: clean, id: ALIAS.get(norm(clean)) ?? (link ? ALIAS.get(norm(link[1])) : undefined) ?? clubId(clean) };
}
function parseWiki(page, season) {
  const lines = page.text.split('\n');
  const matches = [];
  let top = '', section = '', sub = '', fecha = null, roundDate = null, cells = [];
  const skip = () => /Cuadro|Líder|Colista|Evolución|Equipos|Clasificación|Séptima|Véase|Referencias|Enlaces|Repechaje|Promoción|Reválida/i.test(top + ' ' + section + ' ' + sub);
  const stageOf = () => /Cuartos/i.test(sub) ? 'quarterfinal' : /Semifinal/i.test(sub) ? 'semifinal' : /^\s*Final/i.test(sub) ? 'final' : 'regular';
  const flush = () => {
    if (cells.length === 3 && !skip()) {
      const sc = /(\d+)\s*[-–]\s*(\d+)/.exec(cells[1].replace(/\{\{refn[\s\S]*?\}\}/g, '').replace(/\[https?:\/\/\S+/, ''));
      if (sc) {
        const h = teamFromCell(cells[0]), a = teamFromCell(cells[2]);
        const url = /\[(https?:\/\/\S+)/.exec(cells[1])?.[1] ?? null;
        const played = /se jugó (?:el )?(\d{1,2} de [a-záéíóú]+)/i.exec(cells.join(' '))?.[1];
        matches.push({ round: fecha, date: spanishDate(played, season) ?? roundDate, dateIsRoundDate: !played, homeName: h.name, awayName: a.name, homeId: h.id, awayId: a.id, homeScore: +sc[1], awayScore: +sc[2], stage: stageOf(), reportUrl: url });
      }
    }
    cells = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = /^(={2,4})\s*(.*?)\s*\1\s*$/.exec(line))) {
      flush();
      if (m[1].length === 2) { top = m[2]; section = ''; sub = ''; } else if (m[1].length === 3) { section = m[2]; sub = ''; } else sub = m[2];
      if (m[1].length === 3 && /Semifinal|Final|Cuartos/.test(m[2])) sub = m[2];
      continue;
    }
    if (/^\{\{Partido\s*$/.test(line.trim())) {
      flush();
      const tpl = {};
      for (i++; i < lines.length && !/^\}\}\s*$/.test(lines[i]); i++) {
        const kv = /^\|\s*(\w+)\s*=\s*(.*)$/.exec(lines[i]);
        if (kv) tpl[kv[1]] = kv[2];
      }
      if (skip()) continue;
      const sc = /(\d+)\s*[-–]\s*(\d+)/.exec(tpl.resultado ?? '');
      if (sc && tpl.local && tpl.visita) {
        const h = teamFromCell(tpl.local), a = teamFromCell(tpl.visita);
        matches.push({ round: null, date: spanishDate(tpl.fecha, season), dateIsRoundDate: false, homeName: h.name, awayName: a.name, homeId: h.id, awayId: a.id, homeScore: +sc[1], awayScore: +sc[2], stage: stageOf(), reportUrl: null });
      }
      continue;
    }
    if ((m = /^!.*Fecha\s+(\d+)/.exec(line))) { flush(); fecha = +m[1]; roundDate = null; continue; }
    if (/^!colspan=3\|/.test(line.replace(/\s/g, '')) || /^!\s*colspan="?3"?\s*\|\s*\d/.test(line)) { roundDate = spanishDate(line, season) ?? roundDate; continue; }
    if (/^\|-/.test(line)) { flush(); continue; }
    if (/^\|\}/.test(line) || /^\{\|/.test(line) || /^\|\s*valign/.test(line) || /^\|\s*colspan/.test(line)) { flush(); continue; }
    if (/^\|/.test(line) && !/^\|\s*(style|bgcolor="#ffffff")/.test(line)) cells.push(line.slice(1));
    else if (/^!/.test(line)) cells = [];
  }
  flush();
  return matches;
}
function parseWikiStandings(page) {
  // Primer bloque de filas «| 1.º || ... [[Club]]» seguido de una línea con PJ, PG, PE, PP, F, C.
  const lines = page.text.split('\n');
  let rows = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const m = /^\|\s*(\d+)\.º\s*\|\|.*?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(lines[i]) ?? /^\|\s*(\d+)\.º\s*\|\|\s*align="left"\s*\|\s*([^|\n\[]+?)\s*$/.exec(lines[i]);
    if (!m) continue;
    const nums = (lines[i + 1].replace(/'/g, '').match(/-?\d+/g) ?? []).map(Number);
    if (nums.length < 6) continue;
    if (+m[1] === 1 && rows.length) break;
    const name = (m[3] ?? m[2]).trim();
    rows.push({ pos: +m[1], name, id: ALIAS.get(norm(name)) ?? ALIAS.get(norm(m[2])) ?? clubId(name), played: nums[0], wins: nums[1], draws: nums[2], losses: nums[3], pointsFor: nums[4], pointsAgainst: nums[5] });
  }
  return rows.length ? rows : null;
}

/* ---------- Datafactory 2026 ---------- */
const DF = 'https://espn.datafactory.la/html/v3/htmlCenter/data/deportes/rugby/urba';
async function datafactory2026() {
  const html = await get(`${DF}/pages/es/fixture.html`, { json: false });
  const ids = [...new Set([...html.matchAll(/data-channel="deportes\.rugby\.urba\.(\d+)"/g)].map(m => m[1]))];
  const out = [];
  for (const id of ids) {
    const e = await get(`${DF}/events/${id}.json`, { delay: 400 });
    const m = e.match;
    if (e.status?.value !== 'Finalizado') continue;
    const s = e.summary ?? {};
    const q = (k, side) => s[k]?.[side + 'Qty'] ?? null;
    const comp = side => s.tries ? { tries: q('tries', side) + (q('penaltyTries', side) ?? 0), penaltyTries: q('penaltyTries', side) ?? 0, conversions: q('conversions', side), penaltyGoals: q('penalties', side), dropGoals: q('drops', side), yellowCards: q('yellowCards', side), redCards: q('redCards', side) } : null;
    out.push({
      dfId: String(m.matchId), date: `${m.date.slice(0, 4)}-${m.date.slice(4, 6)}-${m.date.slice(6, 8)}`, week: m.week, level: m.levelName,
      homeName: m.homeTeamName, awayName: m.awayTeamName, homeId: clubId(m.homeTeamName), awayId: clubId(m.awayTeamName),
      homeScore: e.scoreStatus[m.homeTeamId].score, awayScore: e.scoreStatus[m.awayTeamId].score,
      homeComp: comp('home'), awayComp: comp('away'), url: `${DF}/events/${id}.json`,
    });
  }
  return { fixtureUrl: `${DF}/pages/es/fixture.html`, matches: out };
}

/* ---------- Clasificación de etapas en ESPN ---------- */
function stageEspn(season, events) {
  // Se clasifican todos los partidos programados (finalizados o no) para no depender de que ESPN tenga el resultado.
  // Torneos a dos ruedas: la segunda aparición del mismo par local>visitante es un partido de playoff.
  // 2021 (una rueda + segunda fase): los tres últimos partidos son semifinales y final.
  const listed = events.filter(e => !['STATUS_TBD', 'STATUS_POSTPONED', 'STATUS_CANCELED'].includes(e.status));
  const seen = new Map(), out = [];
  listed.forEach((e, i) => {
    let stage;
    if (season === 2021) {
      const key = [e.homeId, e.awayId].sort().join('|');
      const k = (seen.get(key) ?? 0) + 1; seen.set(key, k);
      stage = i >= listed.length - 3 ? 'playoff' : k > 1 ? 'second-phase' : 'regular';
    } else {
      const key = `${e.homeId}>${e.awayId}`;
      stage = seen.has(key) ? 'playoff' : 'regular';
      seen.set(key, true);
    }
    out.push({ ...e, stage });
  });
  const po = out.filter(e => e.stage === 'playoff');
  po.forEach((e, i) => { e.stage = i === po.length - 1 ? 'final' : 'semifinal'; });
  return out;
}

/* ---------- A Pleno Rugby (archivo de resultados 2016–2018) ---------- */
// Las páginas de archivo listan «Fecha N - fecha» seguida de bloques local / tantos / tantos / visitante.
const APLENO = {
  2016: ['http://www.aplenorugby.com.ar/site/resultados-614'],
  2017: ['http://www.aplenorugby.com.ar/site/resultados-2017-628', 'http://www.aplenorugby.com.ar/site/resultados-2017-2a-rueda-637'],
  2018: ['http://www.aplenorugby.com.ar/site/resultados-urba-2018-647'],
};
async function aplenoText(url) {
  const file = join(CACHE, createHash('sha1').update(url).digest('hex') + '.latin1.txt');
  let raw;
  if (!REFRESH && existsSync(file)) { raw = JSON.parse(await readFile(file, 'utf8')); }
  else {
    await sleep(2000);
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'iso-8859-1';
    const html = new TextDecoder(/utf-?8/i.test(charset) ? 'utf-8' : 'latin1').decode(await res.arrayBuffer());
    raw = { url, fetchedAt: new Date().toISOString(), html };
    await mkdir(CACHE, { recursive: true });
    await writeFile(file, JSON.stringify(raw));
  }
  accessLog.set(url, raw.fetchedAt);
  const ent = { amp: '&', nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', ordm: 'º', deg: '°' };
  return raw.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n')
    .replace(/&(#\d+|\w+);/g, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : ent[e] ?? m)
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
async function aplenoSeason(season) {
  const out = [];
  for (const url of APLENO[season] ?? []) {
    const lines = await aplenoText(url);
    let stage = null, round = null, date = null, neutral = false, ignore = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let m;
      if (/Repechaje|Reubicaci|Primera A|Promoci/i.test(l) && !/^Resultados/.test(l)) { ignore = true; stage = null; continue; }
      if (/^Resultados\b/.test(l)) { stage = null; continue; }
      if ((m = /^Fecha (\d+)\s*-\s*(.*)$/.exec(l))) { ignore = false; stage = 'regular'; round = +m[1]; date = spanishDate(m[2], season); neutral = false; continue; }
      if (/^(Cuartos de Final|Semifinales|FINAL)/i.test(l) || /URBA.*FINAL/i.test(l)) {
        if (ignore) continue;
        stage = /Cuartos/i.test(l) ? 'quarterfinal' : /Semifinal/i.test(l) ? 'semifinal' : 'final';
        round = null; date = spanishDate(l, season) ?? (lines[i + 1] && spanishDate(lines[i + 1], season)); neutral = /CASI/.test(l) || /CASI/.test(lines[i + 1] ?? '');
        continue;
      }
      if (/^URBA/.test(l)) { if (!/Repechaje/i.test(l)) ignore = false; continue; }
      if (!stage || ignore) continue;
      const [a, hs, as, b] = lines.slice(i, i + 4);
      if (/^\d+$/.test(hs ?? '') && /^\d+$/.test(as ?? '') && !/^\d+$/.test(a) && b && !/^\d+$/.test(b)) {
        const homeId = clubId(a), awayId = clubId(b);
        out.push({ round, date, dateIsRoundDate: true, homeName: a, awayName: b, homeId, awayId, homeScore: +hs, awayScore: +as, stage, neutral: stage === 'regular' ? false : neutral, url });
        i += 3;
      }
    }
  }
  return out;
}

const seasonClubs = list => new Set(list.flatMap(m => [m.homeId, m.awayId]));

/* ---------- Programa principal ---------- */
const catalog = JSON.parse(await readFile(join(ROOT, 'research/catalog.json'), 'utf8'));
const SEASONS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026];
const WIKI_TITLES = { 2016: 'Top 14 de la URBA 2016', 2017: 'Top 12 de la URBA 2017', 2018: 'Top 12 de la URBA 2018', 2019: 'Top 12 de la URBA 2019', 2021: 'Top 12 de la URBA 2021', 2022: 'Top 13 de la URBA 2022', 2023: 'Top 12 de la URBA 2023', 2024: 'Top 12 de la URBA 2024', 2025: 'Top 12 de la URBA 2025', 2026: 'Top 14 de la URBA 2026' };
const sources = {}, matches = [], conflicts = [], gaps = [], seasonsMeta = {};
const addSource = (id, obj) => { sources[id] = { id, ...obj, accessedAt: (accessLog.get(obj.fetchUrl ?? obj.url) ?? new Date().toISOString()).slice(0, 10) }; };

const df = await datafactory2026();
addSource('datafactory-2026', { title: 'ESPN/Datafactory · URBA Top 14 2026, fixture y fichas por partido', url: df.fixtureUrl });

for (const season of SEASONS) {
  console.log(`Temporada ${season}`);
  const wiki = await wikiPage(WIKI_TITLES[season]);
  const wikiMatches = wiki ? parseWiki(wiki, season) : [];
  const wikiTable = wiki ? parseWikiStandings(wiki) : null;
  if (wiki) addSource(`wikipedia-${season}`, { title: `Wikipedia (es) · ${wiki.title} (revisión ${wiki.revid}, ${wiki.timestamp.slice(0, 10)})`, url: wiki.url, fetchUrl: undefined });
  let espn = [];
  if (season >= 2017) {
    const sb = await get(espnScoreboard(season));
    espn = espnEvents(season, sb);
    addSource(`espn-${season}`, { title: `ESPN · URBA Top 14/Top 12 (liga ${ESPN_LEAGUE}), scoreboard ${season}`, url: espnScoreboard(season), fetchUrl: espnScoreboard(season) });
  }
  const staged = stageEspn(season, espn);
  const finals = staged.filter(e => e.status === 'STATUS_FINAL');
  const notFinal = staged.filter(e => e.status !== 'STATUS_FINAL');
  // Desde 2019 las páginas de Wikipedia solo traen playoffs (plantillas {{Partido}}); se usan como control.
  if (season >= 2019) for (let i = wikiMatches.length - 1; i >= 0; i--) if (wikiMatches[i].stage === 'regular') wikiMatches.splice(i, 1);
  const out = [];
  const pairKey = (m) => m.stage === 'regular' && season !== 2016 && season !== 2021 ? `${m.homeId}>${m.awayId}` : `${m.stage}:${[m.homeId, m.awayId].sort().join('|')}`;

  if (season <= 2018) {
    // A Pleno Rugby (fuente original que cita Wikipedia) es la primaria; ESPN y Wikipedia sirven de control.
    const ap = await aplenoSeason(season);
    for (const url of APLENO[season]) addSource(`apleno-${season}-${APLENO[season].indexOf(url) + 1}`, { title: `A Pleno Rugby · archivo de resultados URBA ${season}`, url });
    const wikiByKey = new Map(wikiMatches.map(w => [pairKey(w), w]));
    for (const m of ap) {
      const key = pairKey(m);
      let w = wikiByKey.get(key);
      if (w && m.stage !== 'regular' && w.homeId !== m.homeId) w = { ...w, homeId: w.awayId, awayId: w.homeId, homeScore: w.awayScore, awayScore: w.homeScore };
      let e = finals.find(e => pairKey(e) === key);
      if (e && m.stage !== 'regular' && e.homeId !== m.homeId) e = { ...e, homeId: e.awayId, awayId: e.homeId, homeScore: e.awayScore, awayScore: e.homeScore };
      const diffs = {};
      if (w && (w.homeScore !== m.homeScore || w.awayScore !== m.awayScore)) diffs.wikipedia = `${w.homeScore}-${w.awayScore}`;
      if (e && (e.homeScore !== m.homeScore || e.awayScore !== m.awayScore)) diffs.espn = `${e.homeScore}-${e.awayScore}`;
      // Regla de mayoría: si ESPN y Wikipedia coinciden entre sí y difieren de A Pleno, se usa el tanteo coincidente.
      const majority = diffs.wikipedia && diffs.espn && diffs.wikipedia === diffs.espn;
      const [hs, as] = majority ? diffs.espn.split('-').map(Number) : [m.homeScore, m.awayScore];
      if (Object.keys(diffs).length) conflicts.push({ season, stage: m.stage, homeId: m.homeId, awayId: m.awayId, date: m.date, apleno: `${m.homeScore}-${m.awayScore}`, ...diffs, used: majority ? 'espn+wikipedia' : 'apleno', aplenoUrl: m.url, espnUrl: e ? espnMatchUrl(e.espnId) : null, wikipediaReport: w?.reportUrl ?? null });
      out.push({ round: m.round ?? w?.round ?? null, date: m.date ?? e?.date ?? null, homeName: m.homeName, awayName: m.awayName, homeId: m.homeId, awayId: m.awayId, homeScore: hs, awayScore: as, stage: m.stage, neutral: m.neutral,
        source: { primary: majority ? `espn-${season}` : `apleno-${season}`, aplenoUrl: m.url, espnId: e?.espnId ?? null, espnUrl: e ? espnMatchUrl(e.espnId) : null, wikipediaReport: w?.reportUrl ?? null, crossChecked: [e && 'espn', w && 'wikipedia'].filter(Boolean), conflict: Object.keys(diffs).length > 0 }, components: null });
    }
    for (const w of wikiMatches) if (!ap.some(m => pairKey(m) === pairKey(w))) gaps.push({ season, type: 'solo-wikipedia', detail: `${w.homeId}-${w.awayId} ${w.homeScore}-${w.awayScore} (${w.stage}) figura en Wikipedia pero no en A Pleno; no se incluye.` });
    for (const e of finals) if (!ap.some(m => pairKey(m) === pairKey(e))) gaps.push({ season, type: 'solo-espn', detail: `${e.homeId}-${e.awayId} ${e.homeScore}-${e.awayScore} (${e.stage}, ESPN ${e.espnId}) no figura en A Pleno; no se incluye.` });
  } else {
    // ESPN es la fuente primaria; Wikipedia completa partidos sin resultado en ESPN y sirve de control.
    const wikiByKey = new Map(wikiMatches.map(w => [pairKey(w), w]));
    const used = new Set();
    for (const e of finals) {
      const key = pairKey(e);
      if (e.homeScore === 0 && e.awayScore === 0) {
        gaps.push({ season, type: 'resultado-no-fiable', detail: `${e.date} ${e.homeId}-${e.awayId}: ESPN lo marca finalizado 0-0 (marcador sin cargar). No se encontró otra fuente con el tanteo; se excluye.`, espnUrl: espnMatchUrl(e.espnId) });
        continue;
      }
      let w = wikiByKey.get(key);
      if (w && e.stage !== 'regular' && w.homeId !== e.homeId) w = { ...w, homeId: w.awayId, awayId: w.homeId, homeScore: w.awayScore, awayScore: w.homeScore };
      if (w) used.add(key);
      let homeScore = e.homeScore, awayScore = e.awayScore, primary = `espn-${season}`, flagged = false;
      const dfm = season === 2026 ? df.matches.find(d => d.homeId === e.homeId && d.awayId === e.awayId && (e.stage === 'regular' ? d.level === 'Temporada Regular' : d.level !== 'Temporada Regular')) : null;
      for (const [label, other] of [['wikipedia', w], ['datafactory', dfm]]) {
        if (other && (other.homeScore !== e.homeScore || other.awayScore !== e.awayScore)) {
          conflicts.push({ season, stage: e.stage, homeId: e.homeId, awayId: e.awayId, date: e.date, espn: `${e.homeScore}-${e.awayScore}`, [label]: `${other.homeScore}-${other.awayScore}`, espnUrl: espnMatchUrl(e.espnId), otherUrl: other.reportUrl ?? other.url ?? null });
          flagged = true;
        }
      }
      // En 2026 hay tres fuentes (ESPN, Datafactory y la tabla del catálogo); si ESPN difiere de Datafactory se usa Datafactory, que es la que alimenta la tabla oficial de ESPN.
      if (dfm && flagged) { homeScore = dfm.homeScore; awayScore = dfm.awayScore; primary = 'datafactory-2026'; }
      let components = null;
      const cH = dfm?.homeComp ?? e.homeComp, cA = dfm?.awayComp ?? e.awayComp;
      const consistent = (c, pts) => c && (compPoints(c) + 2 * (c.penaltyTries ?? 0) === pts);
      if (cH && cA && consistent(cH, homeScore) && consistent(cA, awayScore)) components = { home: cH, away: cA, source: dfm?.homeComp ? 'datafactory-2026' : `espn-${season}` };
      const round = dfm && /Fecha (\d+)/.exec(dfm.week ?? '') ? +/Fecha (\d+)/.exec(dfm.week)[1] : (w?.round ?? null);
      out.push({ round, date: e.date, homeName: e.homeName, awayName: e.awayName, homeId: e.homeId, awayId: e.awayId, homeScore, awayScore, stage: e.stage, neutral: e.stage === 'regular' ? e.neutral : null,
        source: { primary, espnId: e.espnId, espnUrl: espnMatchUrl(e.espnId), wikipediaReport: w?.reportUrl ?? null, datafactoryUrl: dfm?.url ?? null, crossChecked: [w && 'wikipedia', dfm && 'datafactory'].filter(Boolean), conflict: flagged }, components });
    }
    for (const w of wikiMatches) if (!used.has(pairKey(w)) && seasonClubs(finals).has(w.homeId) && seasonClubs(finals).has(w.awayId)) gaps.push({ season, type: 'solo-wikipedia', detail: `${w.homeId}-${w.awayId} ${w.homeScore}-${w.awayScore} (${w.stage}) figura en Wikipedia pero no en ESPN; no se incluye.` });
    const missing = notFinal.filter(e => !out.some(o => o.homeId === e.homeId && o.awayId === e.awayId && o.stage === e.stage));
    if (missing.length) gaps.push({ season, type: 'sin-resultado', count: missing.length, matches: missing.map(e => `${e.date} ${e.homeId}-${e.awayId} (ESPN ${e.espnId}, ${e.status})`) });
  }
  // Rondas 2026 desde el fixture oficial del catálogo
  if (season === 2026) for (const m of out) if (m.stage === 'regular') m.round ??= catalog.fixtures.find(f => f.competitionId === 'top14' && f.homeClubId === m.homeId && f.awayClubId === m.awayId)?.round ?? null;

  out.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.round ?? 0) - (b.round ?? 0));
  const clubs = [...new Set(out.flatMap(m => [m.homeId, m.awayId]))].sort();
  // Tabla del torneo regular recalculada y comparada con la de Wikipedia / catálogo
  const table = {};
  for (const m of out.filter(m => m.stage === 'regular' || m.stage === 'second-phase')) for (const [id, f, a] of [[m.homeId, m.homeScore, m.awayScore], [m.awayId, m.awayScore, m.homeScore]]) {
    const r = table[id] ??= { played: 0, wins: 0, draws: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
    r.played++; r.pointsFor += f; r.pointsAgainst += a; f > a ? r.wins++ : f < a ? r.losses++ : r.draws++;
  }
  const reference = season === 2026
    ? catalog.clubs.filter(c => c.competitionId === 'top14').map(c => ({ id: c.id, pos: c.historical2026.rank, ...c.historical2026, source: 'research/catalog.json historical2026' }))
    : season === 2021 ? [] // la tabla publicada es la de la primera rueda; no es comparable con el total de 2021
    : (wikiTable ?? []).map(r => ({ ...r, source: `wikipedia-${season}` }));
  const tableCheck = reference.map(r => {
    const mine = table[r.id];
    const diff = mine ? ['played', 'wins', 'draws', 'losses', 'pointsFor', 'pointsAgainst'].filter(k => r[k] !== undefined && mine[k] !== r[k]).map(k => `${k}: datos ${mine[k]} / referencia ${r[k]}`) : ['club ausente en los partidos'];
    return { id: r.id, rank: r.pos, ok: diff.length === 0, diff };
  });
  const regularCount = out.filter(m => m.stage === 'regular' || m.stage === 'second-phase').length;
  const expected = { 2016: 91, 2021: 96 }[season] ?? clubs.length * (clubs.length - 1);
  if (regularCount < expected) gaps.push({ season, type: 'partidos-faltantes', count: expected - regularCount, detail: `Se esperaban ${expected} partidos de fase regular y hay ${regularCount}.` });
  seasonsMeta[season] = {
    competition: { 2016: 'Top 14 (una rueda)', 2021: 'Top 12 (una rueda + segunda fase por zonas, formato COVID)', 2022: 'Top 13', 2026: 'Top 14' }[season] ?? 'Top 12',
    clubs, matches: out.length, regular: regularCount, expectedRegular: expected,
    playoffs: out.filter(m => !['regular', 'second-phase'].includes(m.stage)).length,
    withTries: out.filter(m => m.components).length,
    sourcesUsed: [...new Set(out.map(m => m.source.primary))],
    standingsCheck: { reference: reference[0]?.source ?? null, allMatch: tableCheck.length > 0 && tableCheck.every(r => r.ok),
      referenceIncomplete: reference.length > 0 && reference.every(r => table[r.id] && r.played < table[r.id].played),
      rows: tableCheck.filter(r => !r.ok) },
  };
  for (const m of out) matches.push({ id: `${season}-${m.stage}-${m.homeId}-${m.awayId}${m.stage === 'second-phase' ? '-2' : ''}`, season, ...m });
}
gaps.push({ season: 2020, type: 'temporada-cancelada', detail: 'ESPN lista 131 partidos de 2020 con estado «postergado»: el torneo se suspendió por la pandemia. Se excluye.' });

const result = {
  generatedAt: new Date().toISOString().slice(0, 10),
  description: 'Resultados partido por partido del máximo torneo de la URBA. stage: regular | second-phase (2021) | quarterfinal | semifinal | final. Los puntajes son los oficiales publicados; components (tries, conversiones, penales, drops) solo cuando la fuente los informa y suman el tanteo.',
  clubIdNote: 'Los ids corresponden a research/catalog.json. Pucará, San Luis, San Martín, Lomas Athletic, San Cirano, Curupaytí y Mariano Moreno hoy juegan en Primera A/B (o fuera del catálogo jugable) pero disputaron el máximo torneo en las temporadas indicadas.',
  unknownClubNames: [...unknownNames],
  seasons: seasonsMeta,
  sources,
  conflicts,
  gaps,
  matches,
};
await mkdir(join(ROOT, 'research/history'), { recursive: true });
await writeFile(join(ROOT, 'research/history/urba-results.json'), JSON.stringify(result, null, 1) + '\n');
console.log(`Escrito research/history/urba-results.json: ${matches.length} partidos, ${conflicts.length} conflictos, ${gaps.length} huecos; nombres sin mapear: ${[...unknownNames].join(', ') || 'ninguno'}`);
for (const [s, m] of Object.entries(seasonsMeta)) console.log(s, m.matches, 'reg', m.regular, '/', m.expectedRegular, 'po', m.playoffs, 'tries', m.withTries, 'tabla', m.standingsCheck.allMatch, m.standingsCheck.rows.length);
