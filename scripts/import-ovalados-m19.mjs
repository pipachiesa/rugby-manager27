#!/usr/bin/env node
/**
 * Adds the 2026 M19 line-ups published by Ovalados (research/ovalados-planteles-m19-2026.json) to research/youth.json.
 * Idempotent. Teams A and B of each club (A is the stronger side; C-E are left out so the game squad stays around
 * 30). Ovalados shows no playing position for M19: the position comes from the shirt number of the published line-up
 * (1-15), as in the senior import. No age is recorded: the category does not prove a birth date.
 *  - A person already in youth.json for the same club (UAR call-ups) gains the source and, if missing, the position.
 *  - A name that matches a senior catalogue player of the same club is not added (already in the senior squad).
 *  - Abbreviated first names («J.») and one-word names are reported, not added.
 * Usage: node scripts/import-ovalados-m19.mjs [--dry]
 */
import { readFile, writeFile } from 'node:fs/promises';
const DRY = process.argv.includes('--dry');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const [ova, youth, catalog] = await Promise.all(['research/ovalados-planteles-m19-2026.json', 'research/youth.json', 'research/catalog.json'].map(read));
const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = s => n(s).split(' ').sort().join(' ');
const slug = s => n(s).replace(/ /g, '-');
const POSITION_BY_NUMBER = { 1: 'Pilar izquierdo', 2: 'Hooker', 3: 'Pilar derecho', 4: 'Segunda línea', 5: 'Segunda línea', 6: 'Ala', 7: 'Ala', 8: 'Número 8', 9: 'Medio scrum', 10: 'Apertura', 11: 'Wing', 12: 'Centro', 13: 'Centro', 14: 'Wing', 15: 'Fullback' };
const SOURCE = { id: 'ovalados-m19-2026', title: 'Ovalados · Plantel 2026 M19 (equipos A y B) en la ficha de cada club del Top 14; el puesto sale del dorsal de la formación publicada', url: 'https://ovalados.com/', publishedAt: null, verifiedAt: ova.source.retrievedAt };
const clubName = id => catalog.clubs.find(c => c.id === id)?.name ?? id;
const report = { added: [], linked: [], skipped: [] };
for (const [clubId, club] of Object.entries(ova.clubs)) {
  const teams = [['A', club.entries], ...Object.entries(club.otherTeams ?? {}).slice(0, 1).map(([label, list]) => ['B', Array.isArray(list) ? list : list.entries ?? []])];
  const seniors = new Set(catalog.players.filter(p => p.clubId === clubId).flatMap(p => [p.name, ...(p.nameAliases ?? [])]).map(key));
  for (const [team, entries] of teams) for (const e of entries) {
    const [surname, first] = e.name.split(',').map(x => x?.trim());
    if (!first || !surname || /^\p{L}\.?$/u.test(first.split(' ')[0])) { report.skipped.push({ clubId, name: e.name, reason: 'nombre incompleto o abreviado' }); continue; }
    const name = `${first} ${surname}`, position = POSITION_BY_NUMBER[e.number] ?? null;
    if (seniors.has(key(name))) { report.skipped.push({ clubId, name, reason: 'ya figura en el plantel superior del catálogo' }); continue; }
    const existing = youth.players.find(p => p.clubId === clubId && key(p.name) === key(name));
    if (existing) {
      existing.sourceIds = [...new Set([...(existing.sourceIds ?? []), SOURCE.id])];
      if (!existing.position && position) { existing.position = position; existing.positionSourceIds = [...new Set([...(existing.positionSourceIds ?? []), SOURCE.id])]; }
      existing.ovaladosTeam ??= team;
      report.linked.push({ clubId, name }); continue;
    }
    youth.players.push({ id: `${slug(name)}-${clubId}`, name, club: clubName(clubId), clubId, union: 'URBA', position, positionSourceIds: position ? [SOURCE.id] : [], knownFrom: ova.source.retrievedAt,
      sourceIds: [SOURCE.id], selections: [], ovaladosTeam: team, number: e.number, birthDate: null, birthDateSourceIds: [], birthDateVerifiedAt: null });
    report.added.push({ clubId, name, team, position });
  }
}
if (!youth.sources.some(s => s.id === SOURCE.id)) youth.sources.push(SOURCE);
const byClub = report.added.reduce((m, x) => (m[x.clubId] = (m[x.clubId] ?? 0) + 1, m), {});
console.log(`agregados ${report.added.length}`, JSON.stringify(byClub), `vinculados ${report.linked.length}`, `omitidos ${report.skipped.length}`);
for (const s of report.skipped) console.log(' -', s.clubId, s.name, '·', s.reason);
if (!DRY) { await writeFile('research/youth.json', JSON.stringify(youth, null, 2) + '\n'); await writeFile('research/ovalados-import-report-m19.json', JSON.stringify(report, null, 1) + '\n'); }
