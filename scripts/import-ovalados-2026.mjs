#!/usr/bin/env node
/**
 * Integrates research/ovalados-planteles-2026.json into research/catalog.json. Idempotent.
 *  1. Merges duplicate identities already in the catalog (same club, same person spelled differently): the other
 *     spelling is kept as nameAliases and sources/appearances are united. Records with verified evidence are kept.
 *  2. Groups Ovalados entries by person (typos, inverted names, initials) and links them to catalog records.
 *  3. Adds new players that have a full first name. Position comes from the shirt number on the 2026 sheet
 *     (16+ gives no position). Abbreviated names and non-player rows are reported, not added.
 * Primera A/B lists (research/ovalados-planteles-primera-ab-2026.json) write «Nombre APELLIDO»: it is turned into
 * «Apellido, Nombre». A person listed by two clubs of the same file is not added to either (site error, e.g. Curupaytí
 * and San Fernando), and a leading surname particle read as a first name («Das, Neves») is not a name.
 * Usage: node scripts/import-ovalados-2026.mjs [--file research/ovalados-planteles-primera-ab-2026.json] [--dry]
 */
import { readFile, writeFile } from 'node:fs/promises';
const DRY = process.argv.includes('--dry');
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const FILE = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : 'research/ovalados-planteles-2026.json';
const catalog = await read('research/catalog.json'), ova = await read(FILE);
// Obvious typing errors on the site, fixed only when the intended name is unambiguous.
const TYPOS = { Frnacisco: 'Francisco' };
const PARTICLE = /^(de|da|das|do|dos|del|di|van|von|la)$/i;
const title = w => w.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
/** «Patricio HERNANDEZ» → «Hernandez, Patricio»; names that already carry a comma are kept. */
const commaForm = raw => { const name = raw.split(/\s+/).map(w => TYPOS[w] ?? w).join(' ');
  if (name.includes(',')) return name; const words = name.split(' '), i = words.findIndex(w => /\p{Lu}{2}/u.test(w) && w === w.toUpperCase());
  return i > 0 ? `${title(words.slice(i).join(' '))}, ${words.slice(0, i).join(' ')}` : name; };
const ages = await read('research/age-verification.json'), youth = await read('research/youth.json'), returns = await read('research/returns.json');

const n = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['de', 'la', 'del', 'y', 'debut']);
const toks = s => n(String(s).replace(/\(debut\)|\*/g, '')).split(' ').filter(t => t && !STOP.has(t));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const close = (a, b) => a === b || (a.length === 1 || b.length === 1 ? a[0] === b[0] : lev(a, b) <= (Math.min(a.length, b.length) >= 7 ? 2 : 1));
/** Same person: every token of the shorter name has a close token in the longer one, and a surname-length token matches. */
export const samePerson = (x, y) => { const A = toks(x), B = toks(y); const [s, l] = A.length <= B.length ? [A, B] : [B, A]; if (s.length < 2) return false; return s.every(t => l.some(u => close(t, u))) && s.some(t => t.length >= 5 && l.some(u => u.length >= 5 && close(t, u))); };
const slug = s => n(s).replace(/ /g, '-');
const POSITION_BY_NUMBER = { 1: 'Pilar izquierdo', 2: 'Hooker', 3: 'Pilar derecho', 4: 'Segunda línea', 5: 'Segunda línea', 6: 'Ala', 7: 'Ala', 8: 'Octavo', 9: 'Medio scrum', 10: 'Apertura', 11: 'Wing', 12: 'Centro', 13: 'Centro', 14: 'Wing', 15: 'Fullback' };
// Only records with an accredited birth date or a youth cross-reference are never dropped.
const protectedIds = new Set([...ages.players.filter(p => p.birthDate).map(p => p.id), ...youth.players.map(p => p.catalogPlayerId).filter(Boolean)]);
const report = { merged: [], added: [], linked: 0, skipped: [], notOnOvalados: {} };

// 1. Merge catalog duplicates within each club.
const evidence = p => (protectedIds.has(p.id) ? 1000 : 0) + (p.birthDate ? 100 : 0) + (p.estimatedBirthDate ? 10 : 0) + (p.appearances?.length ?? 0);
for (const clubId of new Set(catalog.players.map(p => p.clubId))) {
  let list = catalog.players.filter(p => p.clubId === clubId);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (!a || !b || !samePerson(a.name, b.name)) continue;
    if (protectedIds.has(a.id) && protectedIds.has(b.id)) { report.skipped.push({ clubId, reason: 'dos registros con evidencia verificada', names: [a.name, b.name] }); continue; }
    if (a.birthDate && b.birthDate && a.birthDate !== b.birthDate) { report.skipped.push({ clubId, reason: 'fechas de nacimiento distintas', names: [a.name, b.name] }); continue; }
    const [keep, drop] = evidence(a) >= evidence(b) ? [a, b] : [b, a];
    // Show the fuller spelling; the other one stays as an alias for matching saved leagues and future sources.
    const fuller = toks(drop.name).length > toks(keep.name).length ? drop.name : keep.name;
    keep.nameAliases = [...new Set([...(keep.nameAliases ?? []), keep.name, drop.name, ...(drop.nameAliases ?? [])])].filter(x => x !== fuller);
    keep.name = fuller;
    for (const r of ages.players) if (r.id === keep.id) r.canonicalName = fuller;
    keep.sourceIds = [...new Set([...(keep.sourceIds ?? []), ...(drop.sourceIds ?? [])])];
    const seen = new Set((keep.appearances ?? []).map(x => `${x.round}/${x.sourceId}`));
    keep.appearances = [...(keep.appearances ?? []), ...(drop.appearances ?? []).filter(x => !seen.has(`${x.round}/${x.sourceId}`))].sort((x, y) => (x.round ?? 0) - (y.round ?? 0));
    for (const k of ['position', 'number', 'birthDate', 'birthDateSourceIds', 'birthDateVerifiedAt', 'estimatedBirthDate', 'estimatedBirthDateSourceIds'])
      if ((keep[k] == null || keep[k] === 'Sin confirmar' || (Array.isArray(keep[k]) && !keep[k].length)) && drop[k] != null) keep[k] = drop[k];
    if ((drop.lastObservedAt ?? '') > (keep.lastObservedAt ?? '')) Object.assign(keep, { lastObservedAt: drop.lastObservedAt, rosterEvidenceDate: drop.rosterEvidenceDate, rosterEvidenceSourceIds: drop.rosterEvidenceSourceIds });
    catalog.players.splice(catalog.players.indexOf(drop), 1);
    // The dropped spelling had no accredited date; its age-verification row would now point at nothing.
    const row = ages.players.findIndex(r => r.id === drop.id);
    if (row >= 0) ages.players.splice(row, 1);
    list[list.indexOf(drop)] = null;
    report.merged.push({ clubId, kept: keep.id, removed: drop.id, aliases: keep.nameAliases });
  }
}

// 2-3. Ovalados persons.
const entriesOf = club => club.entries.map(e => ({ ...e, name: commaForm(e.name.replace(/\*|\(debut\)/g, '').trim()) }));
const clubsOf = Object.entries(ova.clubs).map(([id, club]) => [id, entriesOf(club)]);
// Same full name (first name included, no initials) in two clubs: fuzzy matching would join different people here.
const key = name => toks(name).sort().join(' ');
const inTwoClubs = (clubId, name) => toks(name).every(t => t.length > 1) && clubsOf.some(([id, list]) => id !== clubId && list.some(e => key(e.name) === key(name)));
for (const [clubId, club] of Object.entries(ova.clubs)) {
  const sourceId = `ovalados-plantel-2026-${clubId}`;
  if (!catalog.sources.some(s => s.id === sourceId)) catalog.sources.push({ id: sourceId, title: `Ovalados · ${club.squadLabel ?? 'Plantel 2026 Top 14'} de ${catalog.clubs.find(c => c.id === clubId)?.name ?? clubId} (lista pública; no acredita afiliación al ${ova.source.retrievedAt.split('-').reverse().slice(0, 2).join('/')})`, url: club.url, publishedAt: null, verifiedAt: ova.source.retrievedAt });
  const persons = [];
  for (const e of entriesOf(club)) {
    const clean = e.name;
    if (toks(clean).length < 2 || PARTICLE.test(clean.split(',')[1]?.trim() ?? '')) { report.skipped.push({ clubId, reason: 'no identifica a un jugador', names: [e.name] }); continue; }
    if (inTwoClubs(clubId, clean)) { report.skipped.push({ clubId, reason: 'figura en el plantel de dos clubes', names: [e.name] }); continue; }
    const p = persons.find(p => p.variants.some(v => samePerson(v, clean)));
    if (p) { p.variants.push(clean); p.numbers.push(e.number); } else persons.push({ variants: [clean], numbers: [e.number] });
  }
  const seen = new Set();
  for (const p of persons) {
    const full = p.variants.filter(v => v.includes(',') && (v.split(',')[1].trim().replace(/[^\p{L}]/gu, '').length > 2) && !/\b\p{L}\./u.test(v.split(',')[1]));
    const best = full.sort((a, b) => b.split(',')[1].trim().length - a.split(',')[1].trim().length)[0];
    const match = catalog.players.find(x => x.clubId === clubId && [x.name, ...(x.nameAliases ?? [])].some(name => p.variants.some(v => samePerson(name, v))));
    if (match) {
      seen.add(match.id); report.linked++;
      match.sourceIds = [...new Set([...(match.sourceIds ?? []), sourceId])];
      match.rosterEvidenceSourceIds = [...new Set([...(match.rosterEvidenceSourceIds ?? []), sourceId])];
      continue;
    }
    if (!best) { report.skipped.push({ clubId, reason: 'nombre abreviado o incompleto', names: p.variants }); continue; }
    const [surname, first] = best.split(',').map(x => x.trim());
    const name = `${first} ${surname}`;
    const number = p.numbers.find(x => x <= 15) ?? p.numbers[0];
    const id = `${clubId}-${slug(name)}`;
    if (catalog.players.some(x => x.id === id)) continue;
    catalog.players.push({ id, clubId, name, position: POSITION_BY_NUMBER[number] ?? null, number, sourceIds: [sourceId], appearances: [], lastObservedAt: null,
      rosterStatus: 'observed-2026', verifiedAt: ova.source.retrievedAt, birthDate: null, birthDateSourceIds: [], birthDateVerifiedAt: null,
      rosterEvidenceDate: null, rosterEvidenceSourceIds: [sourceId], positionSourceIds: POSITION_BY_NUMBER[number] ? [sourceId] : [], ...(p.variants.length > 1 ? { nameAliases: [...new Set(p.variants.map(v => { const [s, f] = v.split(',').map(x => x?.trim()); return f ? `${f} ${s}` : s; }))].filter(x => x !== name) } : {}) });
    seen.add(id); report.added.push({ clubId, name, number, position: POSITION_BY_NUMBER[number] ?? null });
  }
  report.notOnOvalados[clubId] = catalog.players.filter(x => x.clubId === clubId && !seen.has(x.id) && !['departed', 'retired'].includes(x.rosterStatus)).map(x => x.name);
}
// A 2026 local sheet is history: a player now documented as active abroad for the same origin club has left.
report.departed = [];
for (const r of returns.players.filter(r => r.status === 'exterior' && r.originClubId)) {
  const local = catalog.players.filter(p => p.clubId === r.originClubId && [p.name, ...(p.nameAliases ?? [])].some(name => samePerson(name, r.name)));
  if (local.length !== 1 || local[0].rosterStatus === 'departed') continue;
  Object.assign(local[0], { rosterStatus: 'departed', currentClub: r.currentClub, currentClubEvidenceDate: r.currentClubEvidenceDate ?? r.observedAt, currentClubSourceIds: r.currentClubSourceIds ?? r.sourceIds });
  for (const id of local[0].currentClubSourceIds) { const src = (returns.sources ?? []).find(s => s.id === id); if (src && !catalog.sources.some(s => s.id === id)) catalog.sources.push(src); }
  report.departed.push({ id: local[0].id, currentClub: r.currentClub });
}
if (!DRY) {
  await writeFile('research/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
  for (const k of Object.keys(ages.coverage ?? {})) { const ps = k === 'all' ? ages.players : ages.players.filter(x => x.clubId === k); ages.coverage[k] = { players: ps.length, withVerifiedDOB: ps.filter(x => x.birthDate).length }; }
  await writeFile('research/age-verification.json', JSON.stringify(ages, null, 2) + '\n');
}
await writeFile('research/ovalados-import-report.json', JSON.stringify(report, null, 1) + '\n');
console.log(`fusionados ${report.merged.length} · vinculados ${report.linked} · agregados ${report.added.length} · omitidos ${report.skipped.length} · total catálogo ${catalog.players.length}${DRY ? ' (simulación)' : ''}`);
