#!/usr/bin/env node
/**
 * Turns the 2026 Intermedia / Pre A / Pre B line-ups published by Ovalados (research/ovalados-planteles-reservas-2026.json)
 * into research/reserves.json, used by new leagues to replace invented senior players with the real ones.
 * Position comes from the shirt number of the published line-up (1-15; replacements 16+ get no position and are
 * left out). No age is recorded. Names already in the senior catalogue of the same club, abbreviated first names and
 * one-word names are reported, not added. Idempotent. Usage: node scripts/import-ovalados-reserves.mjs [--dry]
 */
import { readFile, writeFile } from 'node:fs/promises';
const DRY = process.argv.includes('--dry');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const [ova, catalog] = await Promise.all(['research/ovalados-planteles-reservas-2026.json', 'research/catalog.json'].map(read));
const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = s => n(s).split(' ').sort().join(' ');
const slug = s => n(s).replace(/ /g, '-');
const POSITION_BY_NUMBER = { 1: 'Pilar izquierdo', 2: 'Hooker', 3: 'Pilar derecho', 4: 'Segunda línea', 5: 'Segunda línea', 6: 'Ala', 7: 'Ala', 8: 'Número 8', 9: 'Medio scrum', 10: 'Apertura', 11: 'Wing', 12: 'Centro', 13: 'Centro', 14: 'Wing', 15: 'Fullback' };
const SOURCE = { id: 'ovalados-reservas-2026', title: 'Ovalados · Plantel 2026 Intermedia, Pre A y Pre B en la ficha de cada club del Top 14; el puesto sale del dorsal de la formación publicada', url: 'https://ovalados.com/', publishedAt: null, verifiedAt: ova.source?.retrievedAt ?? '2026-11-11' };
const out = { source: SOURCE, players: [] }, report = { added: [], skipped: [] }, seen = new Set();
for (const [clubId, club] of Object.entries(ova.clubs ?? {})) {
  const seniors = new Set(catalog.players.filter(p => p.clubId === clubId).flatMap(p => [p.name, ...(p.nameAliases ?? [])]).map(key));
  for (const [category, entries] of Object.entries(club.categories ?? {})) {
    if (!['Intermedia', 'Pre A', 'Pre B'].includes(category)) continue;
    for (const e of entries ?? []) {
      // Names whose accented letters arrived garbled (�) cannot be restored with certainty: left out.
      if (String(e.name).includes('\uFFFD')) { report.skipped.push({ clubId, category, name: e.name, reason: 'caracteres ilegibles' }); continue; }
      // Rows that are page text, not people («Intermedia», «A, Pre», «Sin Información», match captions).
      if (/\b(pre|intermedia|sin informacion|vs|ilegible)\b/.test(n(e.name))) { report.skipped.push({ clubId, category, name: e.name, reason: 'texto de la página' }); continue; }
      const [surname, first] = String(e.name).split(',').map(x => x?.trim());
      if (!first || !surname || /^\p{L}\.?$/u.test(first.split(' ')[0])) { report.skipped.push({ clubId, category, name: e.name, reason: 'nombre incompleto o abreviado' }); continue; }
      const name = `${first} ${surname}`, position = POSITION_BY_NUMBER[e.number] ?? null;
      if (!position) { report.skipped.push({ clubId, category, name, reason: 'suplente sin puesto (dorsal 16 o más)' }); continue; }
      if (seniors.has(key(name)) || seen.has(clubId + key(name))) { report.skipped.push({ clubId, category, name, reason: 'ya figura en el plantel' }); continue; }
      seen.add(clubId + key(name));
      out.players.push({ id: `${slug(name)}-${clubId}-res`, name, clubId, category, number: e.number, position, sourceIds: [SOURCE.id] });
      report.added.push({ clubId, category, name, position });
    }
  }
}
const byClub = report.added.reduce((m, x) => (m[x.clubId] = (m[x.clubId] ?? 0) + 1, m), {});
console.log(`agregados ${report.added.length}`, JSON.stringify(byClub), `omitidos ${report.skipped.length}`);
if (!DRY) { await writeFile('research/reserves.json', JSON.stringify(out, null, 1) + '\n'); await writeFile('research/ovalados-import-report-reservas.json', JSON.stringify(report, null, 1) + '\n'); }
