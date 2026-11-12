#!/usr/bin/env node
/**
 * Per-player match events for URBA Top 12/14 2023-2025 from the ESPN match summaries already cached by
 * scripts/fetch-urba-lineups.mjs (site.web.api.espn.com; no new requests): tries, conversions, penalty goals, drop
 * goals, yellow and red cards. Only successful kicks are published, so kicks measure volume (who kicks), not accuracy.
 *
 * Team side: the summary event id is matched to research/history/urba-lineups.json (same ESPN game) for home/away club ids.
 * Player: samePerson against catalogue players of that club (names and aliases); ambiguous names are left out.
 * Output: research/history/player-stats.json. Usage: node scripts/build-player-stats.mjs
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = process.env.URBA_LINEUPS_CACHE || join(tmpdir(), 'rm26-urba-lineups-cache');
const read = async p => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const [catalog, lineups] = await Promise.all([read('research/catalog.json'), read('research/history/urba-lineups.json')]);

/* --- copied from scripts/import-ovalados-2026.mjs (that module runs the import when imported) --- */
const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'del', 'y', 'debut']);
const toks = s => n(String(s).replace(/\(debut\)|\*/g, '')).split(' ').filter(t => t && !STOP.has(t));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const close = (a, b) => a === b || (a.length === 1 || b.length === 1 ? a[0] === b[0] : lev(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
const samePerson = (x, y) => { const A = toks(x), B = toks(y); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; if (s.length < 2) return false; return s.every(t => l.some(u => close(t, u))) && s.some(t => t.length >= 5 && l.some(u => u.length >= 5 && close(t, u))); };
/* --- end of copy --- */

const byGame = new Map();
for (const m of lineups.matches) for (const u of [m.source, m.homeSource, m.awaySource, ...(m.otherSources ?? []).map(o => o.url)]) {
  const id = String(u ?? '').match(/gameId\/(\d+)/)?.[1];
  if (id) byGame.set(id, m);
}
const KIND = { try: 'tries', conversion: 'conversions', 'penalty goal': 'penalties', 'drop goal': 'drops', 'yellow card': 'yellow', 'red card': 'red' };
const players = {}, unmatched = {}, seen = new Set();
let games = 0, events = 0, linked = 0;
for (const f of await readdir(CACHE)) {
  let wrap; try { wrap = JSON.parse(await readFile(join(CACHE, f), 'utf8')); } catch { continue; }
  let body = wrap?.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { continue; } }
  const comp = body?.header?.competitions?.[0]; if (!comp?.details) continue;
  const gameId = String(wrap.url ?? '').match(/event=(\d+)/)?.[1] ?? String(body.header.id ?? '');
  if (seen.has(gameId)) continue; seen.add(gameId);
  const match = byGame.get(gameId); if (!match) continue;
  games++;
  const sideOf = Object.fromEntries((comp.competitors ?? []).map(c => [c.team?.id, c.homeAway === 'home' ? match.homeId : match.awayId]));
  for (const e of comp.details) {
    const kind = KIND[e.type?.text]; if (!kind) continue;
    events++;
    const clubId = sideOf[e.team?.id], name = e.participants?.[0]?.athlete?.displayName;
    if (!clubId || !name) continue;
    const cands = catalog.players.filter(p => p.clubId === clubId && [p.name, ...(p.nameAliases ?? [])].some(a => samePerson(a, name)));
    if (cands.length !== 1) { const k = `${clubId}|${name}`; unmatched[k] = (unmatched[k] ?? 0) + 1; continue; }
    linked++;
    const p = (players[cands[0].id] ??= { name: cands[0].name, clubId, tries: 0, conversions: 0, penalties: 0, drops: 0, yellow: 0, red: 0, bySeason: {} });
    p[kind]++;
    const s = (p.bySeason[match.season] ??= { tries: 0, conversions: 0, penalties: 0, drops: 0, yellow: 0, red: 0 });
    s[kind]++;
  }
}
const top = (k, x = 10) => Object.entries(players).sort((a, b) => b[1][k] - a[1][k]).slice(0, x).map(([id, p]) => `${p.name} (${p.clubId}) ${p[k]}`);
await writeFile(join(ROOT, 'research/history/player-stats.json'), JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  description: 'Eventos por jugador del Top 12/14 URBA 2023-2025 (resúmenes de partido de la API de ESPN ya guardados en caché): tries, conversiones, penales, drops y tarjetas. ESPN solo publica patadas convertidas: sirven para saber quién patea, no su efectividad.',
  coverage: { games, events, linkedEvents: linked, unmatchedEvents: Object.values(unmatched).reduce((a, b) => a + b, 0) },
  players,
  unmatched: Object.entries(unmatched).sort((a, b) => b[1] - a[1]).slice(0, 80).map(([k, v]) => ({ key: k, events: v })),
}, null, 1) + '\n');
console.log(`partidos ${games} · eventos ${events} · vinculados ${linked}`);
console.log('tries:', top('tries').join(' · '));
console.log('patadas:', Object.entries(players).sort((a, b) => (b[1].conversions + b[1].penalties) - (a[1].conversions + a[1].penalties)).slice(0, 8).map(([, p]) => `${p.name} ${p.conversions}c ${p.penalties}p`).join(' · '));
console.log('amarillas:', top('yellow', 6).join(' · '));
