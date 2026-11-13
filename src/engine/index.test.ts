import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createInitialState, generateMatch, simulateFixture, regenerateReplay, getStandings, trainPlayer, ATTRIBUTE_LABELS, cohortLevel, impliedStrength, DEFAULT_TACTICS, POSITIONS, advanceSeason, completeCurrentAcademyIntake, developmentProfile, developPlayer, canDevelopAttribute, overall, createReturnCandidates, contactReturn, signReturn, projectedReturnPlayer } from './index.ts';

test('schedule is a balanced round robin and players have valid attributes', () => {
  const state=createInitialState(42);
  assert.equal(state.clubs.length,42); assert.equal(state.fixtures.length,546);
  for(const club of state.clubs){
    const fixtures=state.fixtures.filter(f=>f.homeId===club.id||f.awayId===club.id);
    assert.equal(fixtures.length,26);
    assert.equal(new Set(fixtures.map(f=>f.homeId===club.id?f.awayId:f.homeId)).size,13);
    assert.equal(club.players.length,90);
    for(const p of club.players){assert.equal(Object.keys(p.attributes).length,27);for(const n of Object.values(p.attributes)) assert.ok(n>=1&&n<=20);assert.equal(p.fictional,true);}
  }
  assert.equal(Object.keys(ATTRIBUTE_LABELS).length,27);
});
test('match is deterministic, scoring matches the event log and replay', () => {
  const state=createInitialState(42), [home,away]=state.clubs;
  const one=generateMatch(home,away,DEFAULT_TACTICS,DEFAULT_TACTICS,1234);
  assert.deepEqual(one,generateMatch(home,away,DEFAULT_TACTICS,DEFAULT_TACTICS,1234));
  assert.ok(one.frames.length > 241); assert.ok(one.frames.every(f=>f.players.length>=24 && f.players.length<=30));
  assert.notDeepEqual(one.events, generateMatch(home, away, DEFAULT_TACTICS, DEFAULT_TACTICS, 1235, false).events);
  const phases = new Set(one.frames.map(f => f.phase));
  for (const phase of ['restart','pass','carry','ruck','kick','catch','scrum','lineout']) assert.ok(phases.has(phase), phase);
  for (let i = 0; i < one.frames.length; i++) {
    const frame = one.frames[i];
    assert.ok(i === 0 || frame.second > one.frames[i - 1].second);
    const event = one.events.findLast(e => e.second <= frame.second);
    assert.equal(frame.homeScore, event?.homeScore ?? 0);
    assert.equal(frame.awayScore, event?.awayScore ?? 0);
    assert.equal(frame.homeDirection, frame.second <= 2400 ? 1 : -1);
    if (frame.carrierId) {
      const carrier = frame.players.find(p => p.id === frame.carrierId);
      assert.ok(carrier);
      assert.equal(carrier.teamId, frame.possessionId);
      assert.equal(carrier.x, frame.ball.x);
      assert.equal(carrier.y, frame.ball.y);
    }
  }
  for (const event of one.events.filter(e => e.points)) {
    const frame = one.frames.find(f => f.second === event.second);
    assert.equal(frame?.homeScore, event.homeScore);
    assert.equal(frame?.awayScore, event.awayScore);
  }
  assert.equal(one.events.at(-1)?.homeScore,one.homeScore);assert.equal(one.events.at(-1)?.awayScore,one.awayScore);
  let h=0,a=0;
  for(const event of one.events){const delta=event.type==='try'?5:event.type==='conversion'&&!event.description.includes('fallada')?2:(event.type==='penalty'||event.type==='dropGoal')&&!event.description.includes('fallado')?3:0;if(event.teamId===home.id)h+=delta;if(event.teamId===away.id)a+=delta;assert.equal(event.homeScore,h);assert.equal(event.awayScore,a);}
  assert.equal(h,one.homeScore);assert.equal(a,one.awayScore);
});
test('fixture results persist, standings count once and replay survives training', () => {
  let state=createInitialState(7);const fixture=state.fixtures[0];state=simulateFixture(state,fixture.id);
  const saved=state.fixtures[0].match!;assert.equal(saved.frames.length,0);
  const replay=regenerateReplay(state,fixture.id);assert.equal(replay.homeScore,saved.homeScore);assert.equal(replay.frames.at(-1)?.homeScore,saved.homeScore);assert.equal(replay.frames.at(-1)?.awayScore,saved.awayScore);assert.equal(replay.frames.at(-1)?.second,4800);
  const club=state.clubs.find(c=>c.id===fixture.homeId)!; const p=club.players.find(p=>p.attributes.pace<p.potential)!;
  state=trainPlayer(state,club.id,p.id,'pace');assert.deepEqual(regenerateReplay(state,fixture.id).frames,replay.frames);
  assert.equal(simulateFixture(state,fixture.id),state);
  const rows=getStandings(state,fixture.division);assert.equal(rows.reduce((n,r)=>n+r.played,0),2);
});
test('lineups reject out-of-position players and season advances only when complete', async () => {
  const {setLineup,advanceSeason}=await import('./index.ts');
  let state=createInitialState(31);const club=state.clubs[0];const lineup=club.players.slice(0,15).map(p=>p.id);
  state=setLineup(state,club.id,lineup);assert.deepEqual(state.clubs[0].lineup,lineup);
  [lineup[0],lineup[9]]=[lineup[9],lineup[0]];assert.throws(()=>setLineup(state,club.id,lineup));assert.throws(()=>advanceSeason(state));
  const sample=generateMatch(state.clubs[0],state.clubs[1],DEFAULT_TACTICS,DEFAULT_TACTICS,15);
  state={...state,fixtures:state.fixtures.map(f=>({...f,match:{...sample,frames:[]}}))};
  const next=advanceSeason(state);assert.equal(next.season,state.season+1);assert.equal(next.fixtures.length,546);assert.ok(next.fixtures.every(f=>!f.match));
  assert.equal(next.clubs.filter(c=>c.division==='Top 14').length,14);assert.ok(next.clubs.every(c=>c.players.filter(p=>p.squad==='M17').length>=15));
});
test('return leg reverses venues and fatigue and training are limited per round', () => {
  const state=createInitialState(55), club=state.clubs[0];
  for(const f of state.fixtures.filter(f=>f.homeId===club.id)) assert.ok(state.fixtures.some(g=>g.round!==f.round&&g.homeId===f.awayId&&g.awayId===f.homeId));
  const player=club.players.find(p=>p.attributes.pace<p.potential)!;
  const trained=trainPlayer(state,club.id,player.id,'pace');
  assert.throws(()=>trainPlayer(trained,club.id,player.id,'pace'),/ya entrenó/);
  const fixture=trained.fixtures.find(f=>f.homeId===club.id||f.awayId===club.id)!;
  const played=simulateFixture(trained,fixture.id), updated=played.clubs.find(c=>c.id===club.id)!;
  assert.equal(updated.players[0].fitness,95);assert.equal(updated.players[20].fitness,100);
  const next=trainPlayer(played,club.id,player.id,'pace');assert.equal(next.trainingRounds?.[club.id],2);
});
test('kicking and set piece skills materially change outcomes', () => {
  const [home,away]=createInitialState(42).clubs;
  const withSkills=(n:number)=>({...home,players:home.players.map(p=>({...p,attributes:{...p.attributes,scrummaging:n,lineout:n,goalKicking:n}}))});
  const opponent={...away,players:away.players.map(p=>({...p,attributes:{...p.attributes,scrummaging:10,lineout:10}}))};
  function collect(skill:number){let won=0,total=0,kicks=0,goals=0;for(let i=0;i<80;i++){const m=generateMatch(withSkills(skill),opponent,DEFAULT_TACTICS,DEFAULT_TACTICS,i);for(const e of m.events.filter(e=>e.teamId===home.id)){if(e.type==='scrum'||e.type==='lineout'){total++;if(e.description.includes('gana'))won++;}if(e.type==='conversion'){kicks++;if(!e.description.includes('fallada'))goals++;}}}return {set:won/total,kick:goals/kicks};}
  const low=collect(1), high=collect(20);assert.ok(high.set>low.set+.15);assert.ok(high.kick>low.kick+.3);
});
test('local starters, reserves and youths have distinct current ability on the international scale', () => {
  const state = createInitialState(2026), newman = state.clubs.find(c => c.id === 'newman')!;
  const localStarters = state.clubs.flatMap(c => c.players.filter(p => p.seniorSquad === 'Primera'));
  const average = (ratings: number[]) => ratings.reduce((sum, n) => sum + n, 0) / ratings.length;
  const tiers = ['Primera', 'Intermedia', 'Pre A', 'Pre B'].map(tier => average(newman.players.filter(p => p.seniorSquad === tier).map(overall)));
  assert.ok(tiers[0] >= 63 && tiers[0] <= 73);
  assert.ok(tiers.every((rating, i) => i === 0 || rating < tiers[i - 1] - 2));
  assert.ok(Math.max(...localStarters.map(overall)) < 82);
  const m19 = newman.players.filter(p => p.squad === 'M19');
  assert.ok(average(m19.map(overall)) < tiers[1]);
  assert.equal(new Set(m19.map(p => p.name.split(' ').at(-1))).size, m19.length);
  const { players, verifiedAt } = JSON.parse(readFileSync('research/returns.json', 'utf8'));
  const montoya = projectedReturnPlayer(players.find(r => r.id === 'julian-montoya'), 2026, verifiedAt)!;
  // Career level 86, but at 33 he is past his peak (1.5 points a year past 30).
  assert.ok(overall(montoya) >= 80 && overall(montoya) <= 84);
  assert.ok(overall(montoya) > tiers[0] + 8);
});

test('documented prospects need deterministic contact and can only sign with their home club once', () => {
  const { players, verifiedAt } = JSON.parse(readFileSync('research/returns.json', 'utf8'));
  const base = createInitialState(26);
  assert.deepEqual(base.returnCandidates, []);
  const candidates = createReturnCandidates(base.clubs, 26, 2026, players, verifiedAt);
  const montoya = candidates.find(c => c.player.sourceRecordId === 'julian-montoya')!;
  assert.ok(montoya.contactable);
  assert.ok(candidates.every(c => !c.player.fictional && c.player.sourceIds?.length));
  assert.ok(!candidates.some(c => ['santiago-cordero', 'agustin-creevy', 'nicolas-sanchez'].includes(c.player.sourceRecordId!)));
  const initial = { ...base, returnRecords: players, returnCandidates: candidates };
  assert.throws(() => contactReturn(initial, 'another-club', montoya.id), /no disponible/);
  assert.throws(() => signReturn(initial, montoya.homeClubId, montoya.id), /aceptar/);
  const contacted = contactReturn(initial, montoya.homeClubId, montoya.id);
  assert.deepEqual(contacted, contactReturn(initial, montoya.homeClubId, montoya.id));
  assert.throws(() => contactReturn(contacted, montoya.homeClubId, montoya.id), /ya realizó/);
  const trials = Array.from({ length: 48 }, (_, seed) => contactReturn({ ...initial, seed }, montoya.homeClubId, montoya.id));
  const ready = trials.find(world => world.returnCandidates?.find(c => c.id === montoya.id)?.status === 'ready')!;
  assert.ok(ready);
  assert.ok(trials.some(world => world.returnCandidates?.find(c => c.id === montoya.id)?.status === 'monitoring'));
  const signed = signReturn(ready, montoya.homeClubId, montoya.id);
  assert.ok(signed.clubs.find(c => c.id === montoya.homeClubId)?.players.some(p => p.id === montoya.id));
  assert.throws(() => signReturn(signed, montoya.homeClubId, montoya.id));
  assert.ok(!createReturnCandidates(signed.clubs, signed.seed, 2027, players, verifiedAt).some(c => c.id === montoya.id));
});
test('mentality and penalty choice change decisions, and old tactics without them keep the baseline', () => {
  const state = createInitialState(31), [a, b] = state.clubs;
  const count = (tactics: typeof DEFAULT_TACTICS, pred: (e: { type: string }) => boolean) => {
    let n = 0; for (let s = 0; s < 120; s++) n += generateMatch(a, b, tactics, DEFAULT_TACTICS, s, false).events.filter(e => e.teamId === a.id && pred(e)).length; return n;
  };
  const goals = (t: typeof DEFAULT_TACTICS) => count(t, e => e.type === 'penalty');
  assert.ok(goals({ ...DEFAULT_TACTICS, penalty: 'Palos' }) > goals({ ...DEFAULT_TACTICS, penalty: 'Touch' }) * 1.5, 'Palos kicks more penalty goals than Touch');
  const kicks = (t: typeof DEFAULT_TACTICS) => count(t, e => e.type === 'kick');
  assert.ok(kicks({ ...DEFAULT_TACTICS, mentality: 'Defensiva' }) > kicks({ ...DEFAULT_TACTICS, mentality: 'Ofensiva' }), 'Defensiva kicks more');
  // A league saved before these options existed has tactics without them: same match as the explicit defaults.
  const { mentality, penalty, ...legacy } = DEFAULT_TACTICS;
  const x = generateMatch(a, b, legacy as typeof DEFAULT_TACTICS, DEFAULT_TACTICS, 7, false), y = generateMatch(a, b, DEFAULT_TACTICS, DEFAULT_TACTICS, 7, false);
  assert.deepEqual([x.homeScore, x.awayScore], [y.homeScore, y.awayScore]);
});

test('academy admits a deterministic class every year and fills each position after promotions', () => {
  const state = createInitialState(2026);
  const start = { ...state, fixtures: [], nextDivisions: {} };
  const first = advanceSeason(start);
  assert.deepEqual(first, advanceSeason(start));
  let current = first;
  for (let i = 0; i < 4; i++) {
    for (const club of current.clubs) {
      const intake = club.players.filter(p => p.academyIntakeSeason === current.season && p.academyEntry === 'intake');
      assert.equal(intake.length, 15);
      assert.deepEqual(intake.map(p => p.position), [...POSITIONS]);
      assert.ok(intake.every(p => p.age === 16 && p.squad === 'M17' && p.academyClubId === club.id));
      assert.equal(new Set(club.players.map(p => p.id)).size, club.players.length);
      for (const squad of ['M17', 'M19']) {
        const group = club.players.filter(p => p.squad === squad);
        assert.ok(group.length >= 15 && group.length <= 30, `${club.id} ${squad}: ${group.length}`);
        for (const position of new Set(POSITIONS)) {
          assert.ok(group.filter(p => p.position === position).length >= POSITIONS.filter(p => p === position).length);
        }
      }
    }
    current = advanceSeason({ ...current, fixtures: [], nextDivisions: {} });
  }
  const player = first.clubs[0].players.find(p => p.academyEntry === 'intake')!;
  assert.equal(current.clubs[0].players.find(p => p.id === player.id)?.squad, 'Plantel superior');
  const fromLegacy = state.clubs[0].players.find(p => p.squad === 'M19')!;
  const legacyState = { ...start, clubs: start.clubs.map((c, i) => i === 0 ? { ...c, players: c.players.map(p => p.id === fromLegacy.id ? { ...p, age: null, fictional: false, youthSeasons: 1 } : p) } : c) };
  const graduate = advanceSeason(legacyState).clubs[0].players.find(p => p.id === fromLegacy.id)!;
  assert.equal(graduate.age, null);
  assert.equal(graduate.squad, 'Plantel superior');
});

test('completing an eight-player intake adds seven positions once and preserves the saved roster', () => {
  const state = createInitialState(2026);
  const fresh = advanceSeason({ ...state, fixtures: [], nextDivisions: {} });
  const kept = new Set([0, 2, 4, 6, 8, 10, 12, 14]);
  const club = fresh.clubs[0];
  const intake = club.players.filter(p => p.academyIntakeSeason === fresh.season && p.academyEntry === 'intake');
  const removed = new Set(intake.filter((_, i) => !kept.has(i)).map(p => p.id));
  const older = club.players.find(p => p.squad === 'M17' && p.age === 17)!;
  const documented = { ...older, fictional: false, sourceRecordId: 'verified-junior' };
  const partial = {
    ...fresh,
    clubs: fresh.clubs.map(c => c === club ? { ...club, players: club.players.filter(p => !removed.has(p.id)).map(p => p.id === older.id ? documented : p) } : c),
  };
  const completed = completeCurrentAcademyIntake(partial);
  const repaired = completed.clubs[0];
  const full = repaired.players.filter(p => p.academyIntakeSeason === completed.season && p.academyEntry === 'intake');
  assert.equal(full.length, 15);
  assert.deepEqual(full.map(p => p.position).sort(), [...POSITIONS].sort());
  for (const p of partial.clubs[0].players) assert.equal(repaired.players.find(q => q.id === p.id), p);
  assert.equal(completed.fixtures, partial.fixtures);
  assert.equal(completed.clubs[1], partial.clubs[1]);
  assert.deepEqual(completed, completeCurrentAcademyIntake(partial));
  assert.equal(completeCurrentAcademyIntake(completed), completed);
  assert.equal(completeCurrentAcademyIntake(state), state);
});

test('fresh fictional reserve squads obey the hierarchy and training can exceed a legacy cap', () => {
  const state = createInitialState(2026);
  for (const club of state.clubs) {
    const upper = club.players.filter(p => p.seniorSquad === 'Primera' || p.seniorSquad === 'Intermedia');
    const lower = club.players.filter(p => p.seniorSquad === 'Pre A' || p.seniorSquad === 'Pre B');
    assert.ok(Math.max(...lower.map(overall)) <= Math.min(...upper.map(overall)));
  }
  const junior = state.clubs[0].players.find(p => p.squad === 'M17' && p.position === 'Wing')!;
  let player = { ...junior, age: 16, potential: 13, attributes: { ...junior.attributes, pace: 13 } };
  assert.equal(developPlayer(player, 'pace', { seed: 9, season: 2026, round: 1, mode: 'individual' }).attributes.pace, 14);
  const baseline = developmentProfile(player).originalProjection;
  const evidence = { appearances: 22, starts: 20, minutes: 1540, tries: 6, points: 30, complete: true };
  const relevant = ['pace','acceleration','evasion','handling','agility','positioning','tackling'] as const;
  for (let season = 2026; season <= 2036; season++) {
    for (let round = 1; round <= 28; round++) {
      player = developPlayer(player, relevant[(round - 1) % relevant.length], { seed: 9, season, round, evidence, mode: 'individual' });
    }
    player = { ...player, age: player.age + 1 };
  }
  const developed = developmentProfile(player);
  assert.equal(developed.originalProjection, baseline);
  assert.ok(overall(player) > baseline);
  // The ceiling is soft: it follows the projection (+4), which good seasons and training revise upwards.
  assert.ok(overall(player) <= developed.ceiling && developed.ceiling <= Math.max(baseline + 8, developed.projection + 4));
  assert.equal(canDevelopAttribute({ ...player, attributes: { ...player.attributes, pace: 20 } }, 'pace'), false);
});

test('an emigrant ages abroad and returns only to the academy club under the same identity', () => {
  const state = createInitialState(51);
  const origin = state.clubs[0], from = state.clubs[1];
  const starter = from.players.find(p => p.seniorSquad === 'Primera')!;
  const player = { ...starter, age: 25, academyClubId: origin.id, attributes: Object.fromEntries(Object.keys(starter.attributes).map(a => [a, 17])) as typeof starter.attributes };
  const base = { ...state, fixtures: [], nextDivisions: {}, clubs: state.clubs.map(c => c.id === from.id ? { ...c, players: c.players.map(p => p.id === player.id ? player : p) } : c) };
  const evidence = (id: string) => id === player.id ? { appearances: 22, starts: 22, minutes: 1660, tries: 0, points: 0, complete: true } : undefined;
  assert.equal(advanceSeason(base).overseasCareers?.length, 0);
  let world = Array.from({ length: 16 }, (_, seed) => advanceSeason({ ...base, seed }, evidence)).find(w => w.overseasCareers?.length === 1)!;
  assert.ok(world);
  assert.equal(world.overseasCareers?.[0].player.id, player.id);
  assert.equal(world.overseasCareers?.[0].originClubId, origin.id);
  assert.equal(world.overseasCareers?.[0].fromClubId, from.id);
  assert.ok(world.clubs.every(c => !c.players.some(p => p.id === player.id)));
  assert.equal(world.returnCandidates?.find(c => c.player.id === player.id)?.contactable, false);
  while (world.overseasCareers![0].player.age! < 34) world = advanceSeason({ ...world, fixtures: [], nextDivisions: {} });
  const offer = world.returnCandidates?.find(c => c.player.id === player.id)!;
  assert.equal(offer.origin, 'simulated');
  assert.equal(offer.contactable, true);
  assert.equal(offer.player.age, 34);
  assert.ok(offer.player.attributes.pace < player.attributes.pace);
  assert.throws(() => contactReturn(world, from.id, offer.id), /no disponible/);
  const ready = Array.from({ length: 48 }, (_, seed) => contactReturn({ ...world, seed }, origin.id, offer.id))
    .find(w => w.returnCandidates?.some(c => c.id === offer.id && c.status === 'ready'))!;
  assert.ok(ready);
  const signed = signReturn(ready, origin.id, offer.id);
  assert.equal(signed.clubs.flatMap(c => c.players).filter(p => p.id === player.id).length, 1);
  assert.ok(signed.clubs.find(c => c.id === origin.id)?.players.some(p => p.id === player.id));
  assert.equal(signed.overseasCareers?.[0].status, 'returned');
  assert.throws(() => signReturn(signed, origin.id, offer.id));
  const next = advanceSeason({ ...signed, fixtures: [], nextDivisions: {} });
  assert.ok(!next.returnCandidates?.some(c => c.player.id === player.id));
  assert.equal(next.overseasCareers?.[0].returnedSeason, signed.season);
});

test('actual cards remove the right player from play for ten minutes or until full time', () => {
  const [home, away] = createInitialState(42).clubs;
  const found = new Map();
  for (let seed = 0; seed < 256 && found.size < 2; seed++) {
    const match = generateMatch(home, away, DEFAULT_TACTICS, DEFAULT_TACTICS, seed, false);
    for (const event of match.events) {
      if (event.type === 'redCard' || (event.type === 'yellowCard' && event.returnSecond! < 4600)) found.set(event.type, match);
    }
  }
  assert.equal(found.size, 2);
  for (const match of new Set(found.values())) {
    assert.equal(match.cardEventsTracked, true);
    const replay = generateMatch(home, away, DEFAULT_TACTICS, DEFAULT_TACTICS, match.seed);
    for (const card of match.events.filter(e => e.type === 'yellowCard' || e.type === 'redCard')) {
      assert.ok(card.slot! >= 0 && card.slot! < 15 && card.playerId && card.teamId);
      if (card.returnSecond) assert.equal(card.returnSecond, Math.min(4800, card.second + 600));
      const during = replay.frames.filter(f => f.second >= card.second && f.second < (card.returnSecond ?? 4801));
      assert.ok(during.length);
      assert.ok(during.every(f => !f.players.some(p => p.id === card.playerId) && f.carrierId !== card.playerId));
    }
  }
});
test('high balls are contested: a better Juego aéreo drops fewer kicks', () => {
  const state=createInitialState(7), [home,away]=state.clubs;
  const withAerial=(club:any,v:number)=>({...club,players:club.players.map((p:any)=>({...p,attributes:{...p.attributes,aerial:v}}))});
  const drops=(h:any,a:any)=>{let n=0;for(let s=0;s<40;s++){const m=generateMatch(h,a,DEFAULT_TACTICS,DEFAULT_TACTICS,900+s);n+=m.events.filter(e=>e.type==='knockOn'&&e.teamId===h.id&&/pelota alta/.test(e.description)).length;}return n;};
  const sure=drops(withAerial(home,20),withAerial(away,1)), shaky=drops(withAerial(home,1),withAerial(away,20));
  assert.ok(shaky>0,'some high balls are dropped');
  assert.ok(sure<shaky,`aerial 20 drops ${sure}, aerial 1 drops ${shaky}`);
});
test('M17 classes vary per season, big clubs get golden classes more often, strength follows the XV', () => {
  const golden=(strength:number)=>Array.from({length:3000},(_,i)=>cohortLevel({id:'c'+i,strength},2027,i)).filter(r=>r.label==='Dorada').length;
  assert.ok(golden(12.7)>golden(7.6)*2,'big clubs have more golden classes');
  assert.deepEqual(cohortLevel({id:'newman',strength:12},2028,5),cohortLevel({id:'newman',strength:12},2028,5));
  const state=createInitialState(42), club=state.clubs[0];
  assert.ok(Math.abs(impliedStrength(club)-club.strength)<1.5,'a fresh squad implies about its own strength');
});
