#!/usr/bin/env node
/**
 * Copies the Primera trajectory into research/catalog.json as players[].trajectory. Idempotent.
 *
 * «Primera» = Top 12/Top 14 or Primera A. Counted seasons: 2019 and 2021-2026 (WINDOW, 7 seasons; 2020 had no
 * tournament). 2016-2018 only cover playoffs of five clubs, so they no longer count: every club can reach the top
 * label. Sources:
 *  - Top 12/14: research/history/player-trajectory.json (official sheets, ESPN, press line-ups, 2026 catalogue).
 *  - Primera A: research/history/urba-lineups-primera-a.json catalogCrossmatch (press line-ups; exact or same-club
 *    name matches only. Initial-only matches and other-club matches stay out until reviewed by hand).
 *  - Division of each club per season: Top flight from urba-results.json, Primera A/B from the official URBA fixture
 *    index (coverage.seasons[].clubs, 2021-2025) and the 2019 notes; 2026 from the catalogue competitions.
 *
 * A season in which the player's club played Primera A (line-ups are ~0-7 % covered) or whose division is unknown is
 * «sin datos» (unknownSeasons), not an absence. complete=false when those gaps could change the label.
 * trajectory = { seasons, firstSeason, lastSeason, complete, unknownSeasons, primeraASeasons, confidence,
 *   officialSeasons, pressSeasons, disputedSeasons, sourceIds }
 * Usage: node scripts/apply-trajectory.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const [catalog, trajectory, history, primeraA, primeraB] = await Promise.all(['research/catalog.json', 'research/history/player-trajectory.json',
  'research/history/urba-results.json', 'research/history/urba-lineups-primera-a.json', 'research/history/urba-lineups-primera-b.json'].map(read));
const matches = Array.isArray(history) ? history : history.matches;
export const WINDOW = [2019, 2021, 2022, 2023, 2024, 2025, 2026];
// Same bands as TRAJECTORY_LABELS in web/domain.js.
const band = n => n >= 7 ? 4 : n >= 6 ? 3 : n >= 4 ? 2 : n >= 2 ? 1 : 0;

const competition = id => new Set(catalog.competitions.find(c => c.id === id)?.clubIds ?? []);
const division = {}; // division[season][clubId] = 'top' | 'primera-a' | 'primera-b'
for (const s of WINDOW) division[s] = {};
for (const m of matches) if (division[m.season]) for (const id of [m.homeId, m.awayId]) division[m.season][id] = 'top';
for (const [file, div] of [[primeraA, 'primera-a'], [primeraB, 'primera-b']])
  for (const [s, cov] of Object.entries(file.coverage.seasons)) for (const id of cov.clubs ?? []) if (division[s]) division[s][id] ??= div;
// 2019 has no official index; the Rugby Champagne notes place these clubs (primera-ab-sources-report.md §2).
Object.assign(division[2019], Object.fromEntries(['champagnat', 'los-tilos', 'buenos-aires-crc'].filter(id => !division[2019][id]).map(id => [id, 'primera-a'])));
division[2019]['los-matreros'] ??= 'primera-b';
for (const [comp, div] of [['top14', 'top'], ['primera-a', 'primera-a'], ['primera-b', 'primera-b']]) for (const id of competition(comp)) division[2026][id] ??= div;

const PRIMERA = new Set(['top', 'primera-a']);
const primeraASeasons = {};
for (const x of primeraA.catalogCrossmatch) for (const s of x.seasons)
  // A promotion match published under Primera A does not make a Primera B club's season a Primera A one.
  if (['exact', 'subset'].includes(s.strength) && s.clubs.includes(x.clubId) && WINDOW.includes(s.season) && PRIMERA.has(division[s.season][x.clubId]))
    (primeraASeasons[x.playerId] ??= new Set()).add(s.season);

const SOURCES = [
  { id: 'urba-lineups-2016-2025', title: 'Formaciones URBA Top 12/Top 14 2016-2025 (Rugby Champagne, URBA, ESPN); cobertura en research/history/player-trajectory-report.md', url: 'https://www.rugbychampagneweb.com/urba/top-14', publishedAt: null, verifiedAt: '2026-11-10' },
  { id: 'urba-lineups-primera-a-2019-2025', title: 'Formaciones URBA Primera A 2019-2025 (Rugby Champagne) e índice oficial de divisiones (API del fixture de urba.org.ar); ver research/history/primera-ab-sources-report.md', url: 'https://www.rugbychampagneweb.com/urba/primera-division-a', publishedAt: null, verifiedAt: '2026-11-11' }];
for (const src of SOURCES) if (!catalog.sources.some(s => s.id === src.id)) catalog.sources.push(src);

const counts = { complete: 0, incomplete: 0, byLabel: {} };
for (const p of catalog.players) {
  const t = trajectory.players[p.id], a = primeraASeasons[p.id] ?? new Set();
  // 2026 comes from the catalogue (sheets or Ovalados squads): it counts only when the club plays Top 14 or Primera A.
  const top = new Set((t?.seasons ?? []).filter(s => WINDOW.includes(s) && (s !== 2026 || PRIMERA.has(division[2026][p.clubId]))));
  const seasons = WINDOW.filter(s => top.has(s) || a.has(s));
  if (!seasons.length) { delete p.trajectory; continue; }
  const clubIn = s => t?.clubsBySeason?.[s] ?? p.clubId;
  const unknown = WINDOW.filter(s => !seasons.includes(s) && !['top', 'primera-b'].includes(division[s][clubIn(s)]));
  const complete = band(seasons.length) === band(seasons.length + unknown.length);
  const bySource = t?.seasonsBySource ?? {}, inWindow = list => (list ?? []).filter(s => WINDOW.includes(s));
  p.trajectory = { seasons: seasons.length, firstSeason: Math.min(...(t?.seasons ?? []), ...seasons), lastSeason: Math.max(...seasons), complete,
    unknownSeasons: unknown.length, primeraASeasons: [...a].filter(s => !top.has(s)).length, confidence: t?.confidence ?? 'media',
    officialSeasons: inWindow(bySource.oficial).length, pressSeasons: inWindow(bySource.prensa).length + [...a].filter(s => !top.has(s)).length,
    disputedSeasons: inWindow(t?.seasonsDisputed).length,
    sourceIds: [...(top.size > 1 || (top.size && !top.has(2026)) ? [SOURCES[0].id] : []), ...(a.size ? [SOURCES[1].id] : [])] };
  counts[complete ? 'complete' : 'incomplete']++;
  const label = complete ? ['Debutante', 'Joven', 'Jugador de Primera', 'Experimentado', 'Veterano'][band(seasons.length)] : 'Historial incompleto';
  counts.byLabel[label] = (counts.byLabel[label] ?? 0) + 1;
}
await writeFile('research/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`trayectoria cargada: ${counts.complete} completas, ${counts.incomplete} con historial incompleto`, JSON.stringify(counts.byLabel));
