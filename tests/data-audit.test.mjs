import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../research/${name}.json`, import.meta.url), 'utf8'));
const catalog = read('catalog');
const returns = read('returns');
const ages = read('age-verification');
const snapshot = '2026-11-10';

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    assert.ok(item.id, `${label}: missing id`);
    assert.ok(!seen.has(item.id), `${label}: duplicate id ${item.id}`);
    seen.add(item.id);
  }
}
function validDate(value, label) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${label}: malformed date`);
  const date = new Date(`${value}T00:00:00Z`);
  assert.ok(!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value, `${label}: invalid date ${value}`);
  assert.ok(value < snapshot, `${label}: birth date must precede snapshot`);
}
function checkSourceReferences(value, sourceIds, path = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (key === 'sourceId' || key.endsWith('SourceId')) {
      if (child !== null) assert.ok(sourceIds.has(child), `${location}: unknown source ${child}`);
    } else if (key === 'sourceIds' || key.endsWith('SourceIds')) {
      assert.ok(Array.isArray(child), `${location}: expected array`);
      for (const id of child) assert.ok(sourceIds.has(id), `${location}: unknown source ${id}`);
    } else checkSourceReferences(child, sourceIds, location);
  }
}

test('dataset identifiers and nested source references resolve', () => {
  for (const [name, data] of [['catalog', catalog], ['returns', returns]]) {
    uniqueIds(data.sources, `${name} sources`);
    uniqueIds(data.players, `${name} players`);
    checkSourceReferences(data, new Set(data.sources.map(s => s.id)), name);
  }
  uniqueIds(catalog.clubs, 'catalog clubs');
  uniqueIds(catalog.competitions, 'catalog competitions');
  uniqueIds(catalog.referees, 'catalog referees');
  uniqueIds(ages.players, 'age verification');
  const clubs = new Set(catalog.clubs.map(c => c.id));
  for (const p of catalog.players) assert.ok(clubs.has(p.clubId), `${p.id}: missing club ${p.clubId}`);
  for (const p of returns.players) if (p.originClubId) assert.ok(clubs.has(p.originClubId), `${p.id}: missing origin club`);
});

test('birthdays are real dates and missing ages remain unknown', () => {
  for (const [label, players] of [['catalog', catalog.players], ['returns', returns.players], ['age verification', ages.players]]) {
    for (const p of players) {
      if (p.birthDate != null) validDate(p.birthDate, `${label} ${p.id}`);
      else if (label === 'age verification') assert.equal(p['ageAt2026-11-10'], null, `${p.id}: missing DOB must have null age`);
    }
  }
  for (const p of ages.players) {
    if (p.birthDate) {
      const [year, month, day] = p.birthDate.split('-').map(Number);
      const expected = 2026 - year - (month > 11 || (month === 11 && day > 10) ? 1 : 0);
      assert.equal(p['ageAt2026-11-10'], expected, `${p.id}: age mismatch`);
      assert.ok(p.birthDateSource?.url, `${p.id}: missing birth source`);
    }
  }
});

test('verified identities match their catalog record', () => {
  const byId = new Map(catalog.players.map(p => [p.id, p]));
  for (const p of ages.players) {
    const existing = byId.get(p.id);
    assert.ok(existing, `${p.id}: missing from catalog`);
    assert.equal(p.clubId, existing.clubId, `${p.id}: club mismatch`);
    assert.equal(p.canonicalName, existing.name, `${p.id}: name mismatch`);
    if (p.birthDate && existing.birthDate) assert.equal(p.birthDate, existing.birthDate, `${p.id}: conflicting birthdays`);
  }
});

test('return market excludes documented local, retired and historical players', () => {
  // A namesake at a club other than the documented origin club is a different person (e.g. Francisco Moreno).
  const localByName = new Map(catalog.players.map(p => [`${p.clubId}|${p.name}`, p]));
  for (const p of returns.players) {
    if (p.status === 'exterior') {
      assert.equal(p.eligibleForGameMarket, true, `${p.id}: exterior eligibility mismatch`);
      assert.notEqual(p.currentCountry, 'Argentina', `${p.id}: local player marked exterior`);
      const local = localByName.get(`${p.originClubId}|${p.name}`);
      if (local) assert.equal(local.rosterStatus, 'departed', `${p.id}: exterior player also marked local`);
    } else {
      assert.equal(p.eligibleForGameMarket, false, `${p.id}: ineligible status ${p.status}`);
    }
  }
});

test('fictional youth name pools are weighted, unique and linked to real clubs', () => {
  const names = read('names');
  const youth = read('youth');
  const datasets = { 'catalog.json': catalog, 'youth.json': youth };
  for (const ref of names.sourceIds) {
    const [filename, property] = ref.split(':');
    assert.ok(datasets[filename] && Array.isArray(datasets[filename][property]), `unknown name source ${ref}`);
  }
  const clubs = new Set(catalog.clubs.map(c => c.id));
  const pools = [['firstNames', names.firstNames], ['surnames', names.surnames], ...Object.entries(names.byClub)];
  for (const [label, pool] of pools) {
    if (label !== 'firstNames' && label !== 'surnames') assert.ok(clubs.has(label), `name pool for unknown club ${label}`);
    assert.ok(Array.isArray(pool) && pool.length, `${label}: empty pool`);
    const seen = new Set();
    for (const entry of pool) {
      assert.ok(typeof entry.name === 'string' && entry.name.trim(), `${label}: invalid name`);
      assert.ok(!seen.has(entry.name), `${label}: duplicate name ${entry.name}`);
      seen.add(entry.name);
      assert.ok(Number.isFinite(entry.weight) && entry.weight > 0, `${label}: invalid weight`);
    }
  }
  assert.equal(names.mix.clubSurnameChance + names.mix.globalSurnameChance, 1);
  assert.ok(Number.isInteger(names.mix.maxSameSurnamePerIntake) && names.mix.maxSameSurnamePerIntake > 0);
});
