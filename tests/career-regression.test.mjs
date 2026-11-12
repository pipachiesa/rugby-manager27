import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as E from '../web/engine.js';
import * as D from '../web/domain.js';
import * as S from '../web/player-stats.js';
import {mergeResearch} from '../scripts/merge-research.mjs';

const read = async file => JSON.parse(await readFile(new URL(`../research/${file}.json`, import.meta.url), 'utf8'));
const [raw, ages, returns, youth, names] = await Promise.all(['catalog','age-verification','returns','youth','names'].map(read));
const catalog = mergeResearch(raw, ages, returns);
const roundTrip = value => JSON.parse(JSON.stringify(value));

test('v15 save migrates once and preserves roster, lineups, fixtures and unknown legacy match facts', () => {
  const initial = D.initialWorld(catalog, 418, returns, youth, names);
  const played = E.autoPlayRound(initial);
  const slim = D.slimMatches(played, new Set());
  const fixture = slim.fixtures.find(f => f.match?.homeLineup?.length >= 15);
  assert.ok(fixture, 'a legacy result with an observed lineup is required');
  const playerId = fixture.match.homeLineup[0];
  const old = roundTrip({...slim, dataVersion:15, playerStats:undefined});
  const before = roundTrip(old);
  const next = D.migrateWorld(old, catalog, returns);
  assert.equal(next.dataVersion, D.DATA_VERSION);
  assert.deepEqual(old, before, 'migration must not change the input save');
  assert.deepEqual(next.fixtures, before.fixtures, 'match results and stored events survive migration');
  for (const c of before.clubs) {
    const updated = next.clubs.find(x => x.id === c.id);
    assert.deepEqual(updated.lineup, c.lineup, `${c.id}: selected lineup`);
    assert.deepEqual(updated.players.map(p => p.id), c.players.map(p => p.id), `${c.id}: player identities`);
    const byId = new Map(updated.players.map(p => [p.id, p]));
    for (const p of c.players) assert.deepEqual(byId.get(p.id).attributes, p.attributes, `${p.id}: trained attributes`);
  }
  const history = S.playerCareerStats(next, playerId);
  assert.ok(history.careerTotals.appearances >= 1);
  assert.equal(history.careerTotals.minutes, null, 'a slim legacy result does not establish minutes');
  assert.equal(history.careerTotals.conversionAttempts, null, 'a slim legacy result does not establish missed attempts');
  assert.deepEqual(D.migrateWorld(next, catalog, returns), next, 'migration is idempotent');
});

test('round statistics survive JSON saves, continuation, and season reset without double counting', () => {
  let world = D.initialWorld(catalog, 581, returns, youth, names);
  const managed = world.clubs[0].id;
  world = D.advanceWorld(world, new Set([managed]));
  const fixture = world.fixtures.find(f => f.match && (f.homeId === managed || f.awayId === managed));
  const id = (fixture.homeId === managed ? fixture.match.homeLineup : fixture.match.awayLineup)[0];
  const baseline = S.playerCareerStats(world, id);
  assert.equal(baseline.seasonTotals.appearances, 1);
  let loaded = roundTrip(world);
  assert.deepEqual(S.playerCareerStats(loaded, id), baseline, 'save/load changes no statistics');
  assert.deepEqual(S.recordPlayerStats(loaded), loaded, 'reprocessing played matches is idempotent');
  loaded = D.advanceWorld(loaded, new Set([managed]));
  const afterTwo = S.playerCareerStats(loaded, id);
  assert.ok(afterTwo.seasonTotals.appearances >= 1 && afterTwo.seasonTotals.appearances <= 2);
  const savedTwo = roundTrip(loaded);
  assert.deepEqual(S.playerCareerStats(savedTwo, id), afterTwo);
  assert.deepEqual(S.recordPlayerStats(savedTwo), savedTwo);
  // Fill unplayed regular fixtures with score-only records: they provide no individual appearance evidence.
  const oldSeason = savedTwo.season;
  savedTwo.fixtures = savedTwo.fixtures.map(f => f.match || f.stage ? f : {...f, match:{homeScore:0, awayScore:0, homeTries:0, awayTries:0, events:[]}});
  const rolled = D.advanceSeasonWorld(savedTwo);
  const history = S.playerCareerStats(roundTrip(rolled), id, {season:oldSeason});
  assert.equal(rolled.season, oldSeason + 1);
  assert.ok(history.seasonTotals.appearances >= afterTwo.seasonTotals.appearances, 'old individual records survive fixture reset; playoffs may add appearances');
  for (const [fixtureId, record] of Object.entries(savedTwo.playerStats.seasons[oldSeason]))
    assert.deepEqual(rolled.playerStats.seasons[oldSeason][fixtureId], record, `${fixtureId}: original record preserved`);
  assert.deepEqual(rolled.playerStats.seasons[oldSeason][fixture.id], savedTwo.playerStats.seasons[oldSeason][fixture.id]);
});
