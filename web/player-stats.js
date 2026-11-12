// Primera match records survive fixture resets and use the player ID, never the current roster.
// Compact tuples keep archived seasons small. A missing trailing value is zero; null means unknown.
const fields = [
  'appearances', 'starts', 'seconds', 'tries', 'conversionsMade', 'conversionAttempts',
  'yellowCards', 'redCards', 'penaltyGoals', 'penaltyAttempts', 'dropGoals', 'dropAttempts', 'points',
];
const [APP, START, SEC, TRY, CONV, CONV_ATT, YELLOW, RED, PEN, PEN_ATT, DROP, DROP_ATT, POINTS] = fields.map((_, i) => i);
const newValues = () => Array(fields.length).fill(0);
const valueAt = (values, field) => field < values.length ? values[field] : 0;
const kickFields = new Map([['conversion', [CONV, CONV_ATT]], ['penalty', [PEN, PEN_ATT]], ['dropGoal', [DROP, DROP_ATT]]]);
const tracked = new WeakMap();

function compact(values) {
  while (values.at(-1) === 0) values.pop();
  return values;
}

function matchSide(match, home, clubId, events, duration) {
  const lineup = (home ? match.homeLineup : match.awayLineup) ?? [];
  const starters = lineup.slice(0, 15);
  const lineupComplete = starters.length === 15 && new Set(starters.filter(Boolean)).size === 15;
  const players = new Map();
  const getPlayer = id => {
    if (!players.has(id)) {
      const values = newValues();
      values[START] = lineupComplete ? 0 : null;
      players.set(id, values);
    }
    return players.get(id);
  };
  const slots = starters.map(id => {
    if (!id) return null;
    const p = getPlayer(id);
    p[APP] = p[START] = 1;
    return {id, activeSince: 0};
  });
  const sideEvents = events.filter(event => event.teamId === clubId);
  let timingComplete = duration !== null && lineupComplete;
  const close = (slot, second) => {
    if (slot.activeSince === null && slot.returnSecond != null && slot.returnSecond <= second) {
      slot.activeSince = slot.returnSecond;
      slot.returnSecond = null;
    }
    if (slot.activeSince !== null) getPlayer(slot.id)[SEC] += second - slot.activeSince;
  };
  // A slim legacy result contains only positive scores. The selected bench is not evidence of an appearance.
  if (duration === null) {
    for (const id of lineup.slice(15).filter(Boolean)) {
      const p = getPlayer(id);
      if (!p[APP]) p[APP] = null;
    }
  } else {
    const changes = sideEvents.filter(e => ['substitution', 'yellowCard', 'redCard'].includes(e.type)).sort((a, b) => a.second - b.second);
    for (const e of changes) {
      const slot = slots[e.slot];
      if (!e.playerId || !slot || !Number.isFinite(e.second) || e.second < 0 || e.second > duration) {
        timingComplete = false;
        if (e.type === 'substitution' && e.playerId) getPlayer(e.playerId)[APP] = 1;
        continue;
      }
      if (e.type !== 'substitution' && slot.id !== e.playerId) {
        timingComplete = false;
        continue;
      }
      close(slot, e.second);
      if (e.type === 'substitution') {
        getPlayer(e.playerId)[APP] = 1;
        slots[e.slot] = {id: e.playerId, activeSince: e.second};
      } else {
        slot.activeSince = null;
        slot.returnSecond = e.type === 'yellowCard' ? e.returnSecond : null;
        if (e.type === 'yellowCard' && (!Number.isFinite(e.returnSecond) || e.returnSecond < e.second)) timingComplete = false;
      }
    }
    for (const slot of slots) if (slot) close(slot, duration);
  }

  const scoring = {points: 0, tries: 0, assigned: true, attempts: true, cards: true};
  for (const e of sideEvents) {
    const kick = kickFields.get(e.type);
    const card = e.type === 'yellowCard' ? YELLOW : e.type === 'redCard' ? RED : null;
    const points = Number.isFinite(e.points) && e.points > 0 ? e.points : 0;
    if (!kick && !points && e.type !== 'try' && card === null) continue;
    scoring.points += points;
    if (e.type === 'try') scoring.tries++;
    if (!e.playerId) {
      if (points || e.type === 'try') scoring.assigned = false;
      if (kick) scoring.attempts = false;
      if (card !== null) scoring.cards = false;
      continue;
    }
    const p = getPlayer(e.playerId);
    if (p[APP] !== 1) p[SEC] = null;
    p[APP] = 1;
    p[POINTS] += points;
    if (e.type === 'try') p[TRY]++;
    if (kick) {
      p[kick[1]]++;
      if (points) p[kick[0]]++;
      if (e.points !== 0 && !points) scoring.attempts = false;
    }
    if (card !== null) p[card]++;
  }
  const scoresComplete = scoring.assigned && scoring.points === (home ? match.homeScore : match.awayScore);
  const triesComplete = scoring.assigned && scoring.tries === (home ? match.homeTries : match.awayTries);
  for (const p of players.values()) {
    if (!timingComplete) p[SEC] = null;
    if (!triesComplete) p[TRY] = null;
    if (!scoresComplete) for (const field of [CONV, PEN, DROP, POINTS]) p[field] = null;
    if (duration === null || !scoring.attempts) for (const field of [CONV_ATT, PEN_ATT, DROP_ATT]) p[field] = null;
    if (duration === null || match.cardEventsTracked !== true || !scoring.cards) p[YELLOW] = p[RED] = null;
  }
  return [...players].map(([id, values]) => [id, compact(values)]);
}

/** Capture every previously unseen played fixture before the replay archive can trim its event log. */
export function recordPlayerStats(world) {
  const archive = world.playerStats ?? {playerIds: {}, seasons: {}};
  const existing = archive.seasons[world.season] ?? {};
  const pending = world.fixtures.filter(f => f.match && !Object.hasOwn(existing, f.id));
  if (!pending.length) return world;
  const playerIds = {...archive.playerIds};
  let nextIndex = Object.keys(playerIds).length;
  const indexOf = id => {
    if (!Object.hasOwn(playerIds, id)) Object.defineProperty(playerIds, id, {value: nextIndex++, enumerable: true});
    return playerIds[id];
  };
  const season = {...existing};
  for (const f of pending) {
    if (Object.hasOwn(season, f.id)) continue;
    const events = f.match.events ?? [];
    const end = f.match.slim ? null : events.find(e => e.type === 'fullTime')?.second;
    const duration = Number.isFinite(end) && end > 0 ? end : null;
    const side = (home, clubId) => matchSide(f.match, home, clubId, events, duration).map(([id, values]) => [indexOf(id), ...values]);
    season[f.id] = {
      round: f.round, competition: f.division, ...(f.stage ? {stage: f.stage} : {}),
      home: [f.homeId, side(true, f.homeId)], away: [f.awayId, side(false, f.awayId)],
    };
  }
  return {...world, playerStats: {playerIds, seasons: {...archive.seasons, [world.season]: season}}};
}

function appearancesByPlayer(archive) {
  if (!archive) return new Map();
  if (tracked.has(archive)) return tracked.get(archive);
  const byPlayer = new Map();
  for (const [season, fixtures] of Object.entries(archive.seasons)) {
    for (const [fixtureId, match] of Object.entries(fixtures)) {
      for (const home of [true, false]) {
        const [clubId, participants] = home ? match.home : match.away;
        const [opponentId] = home ? match.away : match.home;
        const context = {season: Number(season), competition: match.competition, clubId, fixtureId, round: match.round, stage: match.stage ?? null, opponentId, home};
        for (const [id, ...values] of participants) {
          if (!byPlayer.has(id)) byPlayer.set(id, []);
          byPlayer.get(id).push({context, values});
        }
      }
    }
  }
  tracked.set(archive, byPlayer);
  return byPlayer;
}

function appearancesOf(world, playerId) {
  const archive = world.playerStats;
  if (!archive || !Object.hasOwn(archive.playerIds, playerId)) return [];
  return appearancesByPlayer(archive).get(archive.playerIds[playerId]) ?? [];
}

function combine(rows, knownOnly = false) {
  if (!rows.length) return Array(fields.length).fill(knownOnly ? 0 : null);
  const totals = newValues();
  for (const {values} of rows) {
    for (let i = 0; i < fields.length; i++) {
      const value = valueAt(values, i);
      if (totals[i] !== null) totals[i] = value === null && !knownOnly ? null : totals[i] + (value ?? 0);
    }
  }
  return totals;
}

function describe(values) {
  const totals = Object.fromEntries(fields.flatMap((name, index) => index === SEC ? [] : [[name, valueAt(values, index)]]));
  const seconds = valueAt(values, SEC);
  const {conversionsMade, conversionAttempts} = totals;
  return {
    ...totals,
    minutes: seconds === null ? null : Math.round(seconds / 60),
    conversionPercentage: conversionsMade === null || !conversionAttempts ? null : 100 * conversionsMade / conversionAttempts,
  };
}

/** A round cutoff hides already stored matches whose replay has not been revealed. */
export function playerCareerStats(world, playerId, {season = world.season, throughRound = Infinity, recentLimit = 5} = {}) {
  const observed = appearancesOf(world, playerId).filter(r => r.context.season < world.season || r.context.round <= throughRound);
  const groups = new Map();
  for (const row of observed) {
    const {season, competition, clubId} = row.context;
    const key = JSON.stringify([season, competition, clubId]);
    if (!groups.has(key)) groups.set(key, {season, competition, clubId, matches: []});
    groups.get(key).matches.push(row);
  }
  const rows = [...groups.values()].sort((a, b) => b.season - a.season || a.competition.localeCompare(b.competition) || a.clubId.localeCompare(b.clubId))
    .map(({matches, ...context}) => ({...context, ...describe(combine(matches))}));
  const recent = observed.filter(r => valueAt(r.values, APP) === 1)
    .sort((a, b) => b.context.season - a.context.season || b.context.round - a.context.round || a.context.fixtureId.localeCompare(b.context.fixtureId))
    .slice(0, Math.max(0, recentLimit))
    .map(({context, values}) => ({...context, ...describe(values), started: valueAt(values, START) === null ? null : valueAt(values, START) === 1}));
  return {
    season, rows, recent,
    seasonTotals: describe(combine(observed.filter(r => r.context.season === season))),
    careerTotals: describe(combine(observed)),
    coverage: {
      firstSeason: rows.at(-1)?.season ?? null,
      currentSeason: world.season,
      hasRecords: rows.length > 0,
      hasPartialRecords: observed.some(r => r.values.includes(null)),
      parallel: 'unavailable',
    },
  };
}

/** Development may use confirmed lower bounds even when older logs are incomplete. */
export function playerDevelopmentEvidence(world, playerId) {
  const rows = appearancesOf(world, playerId).filter(r => r.context.season === world.season);
  const totals = combine(rows, true);
  return {
    appearances: totals[APP], starts: totals[START], minutes: Math.round(totals[SEC] / 60),
    tries: totals[TRY], points: totals[POINTS],
    complete: rows.length > 0 && rows.every(r => [APP, START, SEC, TRY, POINTS].every(i => valueAt(r.values, i) !== null)),
  };
}
