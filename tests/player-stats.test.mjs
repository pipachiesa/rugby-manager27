import assert from 'node:assert/strict';
import test from 'node:test';
import {playerCareerStats, playerDevelopmentEvidence, recordPlayerStats} from '../web/player-stats.js';

const starting = (club, first) => [first, ...Array.from({length: 14}, (_, i) => `${club}-${i + 2}`)];
const event = (type, second, playerId, {teamId = 'home', points = 0, ...extra} = {}) => ({type, second, playerId, teamId, points, ...extra});
const fullTime = {type: 'fullTime', second: 4800};
const fixture = ({id = 'fixture-1', round = 1, stage, division = 'Top 14', home = 'home', away = 'away', starter = 'player', events = [], ...patch} = {}) => ({
  id, round, stage, division, homeId: home, awayId: away,
  match: {homeId: home, awayId: away, homeLineup: [...starting(home, starter), 'replacement', 'unused'], awayLineup: starting(away, 'opponent'),
    homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0, cardEventsTracked: true, events: [...events, fullTime], ...patch},
});
const world = (...fixtures) => ({season: 2026, fixtures, clubs: []});
const record = (...fixtures) => recordPlayerStats(world(...fixtures));

test('uses timed substitutions and cards for minutes, and counts attempts including misses', () => {
  const played = fixture({homeScore: 15, homeTries: 2, awayScore: 5, awayTries: 1, events: [
    event('try', 200, 'player', {points: 5}), event('conversion', 210, 'player', {points: 2}),
    event('yellowCard', 600, 'player', {slot: 0, returnSecond: 1200}),
    event('penalty', 800, 'home-2'), event('penalty', 1500, 'player', {points: 3}),
    event('try', 1900, 'player', {points: 5}), event('conversion', 1910, 'player'),
    event('try', 2000, 'opponent', {teamId: 'away', points: 5}), event('conversion', 2010, 'opponent', {teamId: 'away'}),
    event('substitution', 3720, 'replacement', {slot: 0}),
    event('redCard', 4500, 'replacement', {slot: 0}),
  ]});
  const w = record(played);
  const starter = playerCareerStats(w, 'player');
  assert.deepEqual(starter.seasonTotals, {
    appearances: 1, starts: 1, minutes: 52, tries: 2, conversionsMade: 1, conversionAttempts: 2, conversionPercentage: 50,
    yellowCards: 1, redCards: 0, penaltyGoals: 1, penaltyAttempts: 1, dropGoals: 0, dropAttempts: 0, points: 15,
  });
  assert.equal(starter.recent[0].started, true);
  const bench = playerCareerStats(w, 'replacement');
  assert.equal(bench.seasonTotals.appearances, 1);
  assert.equal(bench.seasonTotals.minutes, 13);
  assert.equal(bench.seasonTotals.redCards, 1);
  assert.equal(bench.seasonTotals.conversionPercentage, null);
  assert.equal(bench.recent[0].started, false);
  assert.equal(playerCareerStats(w, 'unused').coverage.hasRecords, false);
  assert.equal(playerCareerStats(w, 'unused').seasonTotals.appearances, null);
  assert.equal(playerCareerStats(w, 'opponent').seasonTotals.conversionPercentage, 0);
  assert.deepEqual(playerDevelopmentEvidence(w, 'player'), {appearances: 1, starts: 1, minutes: 52, tries: 2, points: 15, complete: true});
});

test('a substitute can replace a player before the sin bin expires without adding phantom time', () => {
  const w = record(fixture({events: [
    event('yellowCard', 3600, 'player', {slot: 0, returnSecond: 4200}),
    event('substitution', 3900, 'replacement', {slot: 0}),
  ]}));
  assert.equal(playerCareerStats(w, 'player').seasonTotals.minutes, 60);
  assert.equal(playerCareerStats(w, 'replacement').seasonTotals.minutes, 15);
});

test('slim migration preserves confirmed stats and leaves missing attempts, minutes and cards unknown', () => {
  const f = fixture({slim: true, cardEventsTracked: undefined, homeScore: 7, homeTries: 1});
  f.match.events = [event('try', 100, 'player', {points: 5}), event('conversion', 110, 'player', {points: 2})];
  const legacy = world(f);
  const w = recordPlayerStats(legacy);
  assert.equal(legacy.playerStats, undefined);
  assert.equal(recordPlayerStats(w), w);
  const restored = JSON.parse(JSON.stringify(w));
  assert.equal(recordPlayerStats(restored), restored);
  assert.deepEqual(restored.playerStats, w.playerStats);
  const profile = playerCareerStats(w, 'player');
  assert.equal(profile.seasonTotals.appearances, 1);
  assert.equal(profile.seasonTotals.starts, 1);
  assert.equal(profile.seasonTotals.tries, 1);
  assert.equal(profile.seasonTotals.conversionsMade, 1);
  assert.equal(profile.seasonTotals.conversionAttempts, null);
  assert.equal(profile.seasonTotals.conversionPercentage, null);
  assert.equal(profile.seasonTotals.minutes, null);
  assert.equal(profile.seasonTotals.yellowCards, null);
  assert.equal(profile.seasonTotals.redCards, null);
  assert.equal(profile.coverage.hasPartialRecords, true);
  assert.equal(profile.coverage.parallel, 'unavailable');
  assert.equal(playerCareerStats(w, 'replacement').seasonTotals.appearances, null);
  assert.deepEqual(playerCareerStats(w, 'replacement').recent, []);
  assert.deepEqual(playerDevelopmentEvidence(w, 'player'), {appearances: 1, starts: 1, minutes: 0, tries: 1, points: 7, complete: false});
});

test('legacy full matches have attempts and minutes but no historical card zeroes', () => {
  const w = record(fixture({cardEventsTracked: undefined, events: [event('penalty', 900, 'player')]}));
  const {seasonTotals: stats} = playerCareerStats(w, 'player');
  assert.equal(stats.minutes, 80);
  assert.equal(stats.penaltyAttempts, 1);
  assert.equal(stats.penaltyGoals, 0);
  assert.equal(stats.conversionAttempts, 0);
  assert.equal(stats.conversionPercentage, null);
  assert.equal(stats.yellowCards, null);
  assert.equal(stats.redCards, null);
});

test('archive is idempotent across slimming and keeps a stable player through moves, playoffs and new seasons', () => {
  const oldFixture = fixture();
  const movedFixture = fixture({id: 'fixture-2', round: 2, home: 'other-club', division: 'Primera A'});
  let w = record(oldFixture, movedFixture);
  w = recordPlayerStats({...w, fixtures: [oldFixture, {...movedFixture, match: {...movedFixture.match, slim: true, events: []}}]});
  assert.equal(playerCareerStats(w, 'player').seasonTotals.minutes, 160);
  assert.deepEqual(playerCareerStats(w, 'player').rows.map(({season, competition, clubId}) => [season, competition, clubId]), [
    [2026, 'Primera A', 'other-club'], [2026, 'Top 14', 'home'],
  ]);
  w = recordPlayerStats({...JSON.parse(JSON.stringify(w)), season: 2027, fixtures: [
    fixture({home: 'other-club'}), fixture({id: 'final', round: 28, stage: 'final', home: 'other-club'}),
  ]});
  const profile = playerCareerStats(w, 'player');
  assert.equal(profile.seasonTotals.appearances, 2);
  assert.equal(profile.careerTotals.appearances, 4);
  assert.equal(profile.recent[0].stage, 'final');
  assert.equal(profile.recent[0].opponentId, 'away');
  assert.equal(profile.coverage.firstSeason, 2026);
  assert.equal(playerCareerStats(w, 'player', {season: 2026, recentLimit: 0}).seasonTotals.appearances, 2);
  assert.deepEqual(playerCareerStats(w, 'player', {recentLimit: 0}).recent, []);
  assert.equal(playerDevelopmentEvidence(w, 'player').appearances, 2);
});

test('a pending round stays out of every profile view while recorded prior seasons remain visible', () => {
  const prior = record(fixture({round: 26}));
  const w = recordPlayerStats({...prior, season: 2027, fixtures: [
    fixture({homeScore: 7, homeTries: 1, events: [event('try', 100, 'player', {points: 5}), event('conversion', 110, 'player', {points: 2})]}),
  ]});
  const hidden = playerCareerStats(w, 'player', {throughRound: 0});
  assert.equal(hidden.rows.length, 1);
  assert.equal(hidden.rows[0].season, 2026);
  assert.equal(hidden.seasonTotals.tries, null);
  assert.equal(hidden.careerTotals.tries, 0);
  assert.deepEqual(hidden.recent.map(m => m.season), [2026]);
  assert.equal(playerCareerStats(w, 'player').careerTotals.tries, 1);
});
