#!/usr/bin/env node
/**
 * Individual quality signals for documented players, written to research/catalog.json as players[].quality. Idempotent.
 * Without them every player of a club was the club level plus random noise, so a regular starter, a Puma or the
 * league's top kicker could rate below a bench player.
 *
 * quality = { offset, starts, starterRate, starterSeasons, positions, stats, pedigree, floor }
 *  - starts/starterRate: matches started (shirt 1-15) over the club's matches with a published line-up, 2024-2026
 *    (2024-2025 ESPN sheets cover every match; 2026 from the catalogue sheets). Recent seasons weigh more.
 *  - starterSeasons: seasons since 2019 with at least 3 starts.
 *  - positions: positions started at least twice and in at least 15 % of the starts, most frequent first. The
 *    catalogue position stays the main one; the rest let the player be picked there too.
 *  - stats: ESPN 2024-2025 events (research/history/player-stats.json) per start.
 *  - pedigree: levels from research/player-pedigree.json (Pumas, Pumas 7s, Pampas, Europe…); floor is the minimum
 *    overall the game gives that player (scale in AGENTS.md: average Puma about 82).
 *  - offset: attribute-base shift (1 attribute point ≈ 5 overall points) from starts and experience. Without line-up
 *    data it is 0 and the player keeps the club level.
 * Usage: node scripts/apply-player-quality.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
const read = async (p, fallback) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch (e) { if (fallback !== undefined) return fallback; throw e; } };
const [catalog, trajectory, stats, lineups, pedigree, lastCaps, ages] = await Promise.all([read('research/catalog.json'), read('research/history/player-trajectory.json'),
  read('research/history/player-stats.json'), read('research/history/urba-lineups.json'), read('research/player-pedigree.json', { players: {} }),
  read('research/pumas-last-caps.json', { players: {} }), read('research/age-verification.json', { players: [] })]);
const birthOf = Object.fromEntries(ages.players.filter(x => x.birthDate).map(x => [x.id, x.birthDate]));
const POSITION_BY_NUMBER = { 1: 'Pilar izquierdo', 2: 'Hooker', 3: 'Pilar derecho', 4: 'Segunda línea', 5: 'Segunda línea', 6: 'Ala', 7: 'Ala', 8: 'Número 8', 9: 'Medio scrum', 10: 'Apertura', 11: 'Wing', 12: 'Centro', 13: 'Centro', 14: 'Wing', 15: 'Fullback' };
const positionOf = r => r.position === 'Octavo' ? 'Número 8' : r.position === 'Tercera línea' ? 'Ala' : r.position;
const WEIGHT = { 2024: 1, 2025: 1.5, 2026: 2 };
// Floor = minimum overall in the game for a level while it is current (scale in AGENTS.md: average Puma 82). It is
// about today, not the career:
//  - a level fades 1.5 points a year after the last year at that level; for Pumas the last test or squad call-up
//    (research/pumas-last-caps.json) wins over the career years;
//  - past 30, 1.5 points a year (known or estimated age);
//  - a long injury in 2025-2026 takes 3 more, 2 if he has played since (Cordero: October 2025, back in February).
export const PEDIGREE_FLOOR = { pumas: 82, jaguares: 78, europe: 76, pampas: 72, 'argentina-xv': 71, 'super-rugby-americas-other': 70, pumas7: 70, 'other-pro': 70, 'youth-national': 0 };
const ageOf = p => { const b = birthOf[p.id] ?? p.birthDate ?? p.estimatedBirthDate; if (!b) return null; const y = 2026 - +b.slice(0, 4); return b.slice(5) > '11-10' ? y - 1 : y; };
const pedigreeFloor = (entries, p) => {
  const caps = lastCaps.players?.[p.id], age = ageOf(p);
  const capYear = caps ? Math.max(+(caps.lastTestDate ?? '0').slice(0, 4), caps.lastSquadYear ?? 0) || null : null;
  const best = Math.max(0, ...entries.map(e => {
    // Fewer than 10 known caps (D'Amorim, Pernas, Penoucos): a fringe Puma, not an established one.
    const base = (PEDIGREE_FLOOR[e.level] ?? 0) - (e.level === 'pumas' && caps?.caps != null && caps.caps < 10 ? 3 : 0); if (!base) return 0;
    const last = e.level === 'pumas' && capYear ? capYear : Math.max(...(e.years ?? [2026]));
    // Retired from Los Pumas (Cordero, July 2025): one more year away from that level.
    const retired = e.level === 'pumas' && /retir/i.test(caps?.notes ?? '') ? 1 : 0;
    return base - 1.5 * clamp(2026 - last - 1 + retired, 0, 8);
  }));
  if (!best) return 0;
  const injured = caps?.injury && (caps.injury.from ?? '') >= '2025' ? caps.injury.playedSince ? 2 : 3 : 0;
  return Math.round(best - 1.5 * clamp((age ?? 30) - 30, 0, 8) - injured);
};
const TOP14 = new Set(catalog.competitions.find(c => c.id === 'top14').clubIds);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r2 = x => Math.round(x * 100) / 100;

// Club matches with a published line-up per season (any side listed).
const clubMatches = {};
for (const m of lineups.matches) for (const [side, id] of [['home', m.homeId], ['away', m.awayId]])
  if ((m[side]?.length || (m.otherSources ?? []).some(o => o[side]?.length))) clubMatches[`${m.season}|${id}`] = (clubMatches[`${m.season}|${id}`] ?? 0) + 1;
for (const p of catalog.players) for (const a of p.appearances ?? []) (clubMatches[`2026|${p.clubId}`] ??= new Set()).add?.(a.round ?? a.matchDate);
for (const k of Object.keys(clubMatches)) if (clubMatches[k] instanceof Set) clubMatches[k] = clubMatches[k].size;

const summary = { withQuality: 0, withPedigree: 0, withPositions: 0 };
for (const p of catalog.players) {
  const t = trajectory.players[p.id], nums = t?.numbersBySeason ?? {}, ped = pedigree.players?.[p.id]?.entries ?? [];
  const starts = Object.values(nums).flat().filter(x => x >= 1 && x <= 15).length;
  let w = 0, rate = 0;
  for (const [y, list] of Object.entries(nums)) {
    const club = t.clubsBySeason?.[y] ?? p.clubId, total = clubMatches[`${y}|${Array.isArray(club) ? club[0] : club}`];
    if (!WEIGHT[y] || !total) continue;
    rate += WEIGHT[y] * Math.min(1, list.filter(x => x <= 15).length / total); w += WEIGHT[y];
  }
  const starterRate = w ? rate / w : null;
  const starterSeasons = Object.entries(nums).filter(([y, list]) => +y >= 2019 && list.filter(x => x <= 15).length >= 3).length;
  const count = {};
  for (const x of Object.values(nums).flat()) if (POSITION_BY_NUMBER[x]) count[POSITION_BY_NUMBER[x]] = (count[POSITION_BY_NUMBER[x]] ?? 0) + 1;
  const main = positionOf(p);
  const positions = [main, ...Object.entries(count).filter(([pos, c]) => pos !== main && c >= 2 && c / starts >= .15).sort((a, b) => b[1] - a[1]).map(([pos]) => pos)].filter(Boolean);
  const s = stats.players[p.id], st24 = Object.entries(nums).filter(([y]) => y === '2024' || y === '2025').flat(2).filter(x => typeof x === 'number' && x <= 15).length;
  const per = k => s && st24 >= 4 ? r2(s[k] / st24) : null;
  const floor = pedigreeFloor(ped, p);
  // A Top 14 player listed in 2026 who never appears in a published line-up since 2019 is most likely a squad player.
  const unseen = starterRate === null && !Object.keys(nums).length && TOP14.has(p.clubId);
  // League performance: regular starters over several seasons, the club's kicker and its finishers rise clearly
  // (Gutiérrez Taboada: starter at 10 every season since 2019 and third kicker of the league).
  const st = s && st24 >= 8 ? s : null;
  const kicks = st ? (st.conversions + st.penalties + st.drops) / st24 : 0, tries = st ? st.tries / st24 : 0;
  const perf = kicks >= 3 ? 1.4 : kicks >= 1.5 ? .6 : 0;
  const fin = tries >= .5 ? 1 : tries >= .3 ? .5 : 0;
  const offset = unseen ? -.4 : starterRate === null ? 0 : r2(clamp(3 * (starterRate - .45), -1.2, 1.6) + clamp(starterSeasons - 2, 0, 6) / 6 + perf + fin + (ped.some(e => e.level === 'youth-national') ? .4 : 0));
  if (!unseen && starterRate === null && !ped.length && positions.length < 2) { delete p.quality; continue; }
  p.quality = { offset, starts, starterRate: starterRate === null ? null : r2(starterRate), starterSeasons,
    positions: positions.length > 1 ? positions : undefined,
    stats: s && st24 >= 4 ? { starts: st24, triesPerStart: per('tries'), kicksPerStart: r2((s.conversions + s.penalties + s.drops) / st24), dropsPerStart: per('drops'), cardsPerStart: r2((s.yellow + 2 * s.red) / st24) } : undefined,
    pedigree: ped.length ? [...new Set(ped.map(e => e.level))] : undefined, floor: floor || undefined };
  summary.withQuality++; if (ped.length) summary.withPedigree++; if (positions.length > 1) summary.withPositions++;
}
const SOURCE = { id: 'player-quality-2026', title: 'Calidad individual: titularidades y dorsales 2019-2026, eventos ESPN 2024-2025 y trayectoria en selecciones y profesionales (research/player-pedigree.json)', url: 'https://www.espn.com.ar/rugby/', publishedAt: null, verifiedAt: '2026-11-11' };
if (!catalog.sources.some(x => x.id === SOURCE.id)) catalog.sources.push(SOURCE);
await writeFile('research/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(JSON.stringify(summary));
