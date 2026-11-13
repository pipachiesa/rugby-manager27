/** A seeded rugby management simulation. Individual attributes are game estimates. */
export const ATTRIBUTE_LABELS = {
  pace: 'Velocidad', acceleration: 'Aceleración', agility: 'Agilidad', strength: 'Fuerza', stamina: 'Resistencia',
  passing: 'Pase', handling: 'Manejo', vision: 'Visión', decisions: 'Decisiones', kicking: 'Juego con el pie',
  goalKicking: 'Patadas a los palos', tackling: 'Tackle', positioning: 'Ubicación', breakdown: 'Ruck',
  scrummaging: 'Scrum', lineout: 'Lineout', jumping: 'Salto', maul: 'Maul', carrying: 'Acarreo',
  evasion: 'Evasión', offload: 'Offload', discipline: 'Disciplina', leadership: 'Liderazgo',
  workRate: 'Trabajo', technique: 'Técnica', composure: 'Temple', aerial: 'Juego aéreo',
} as const;
export type Attribute = keyof typeof ATTRIBUTE_LABELS;
export type Attributes = Record<Attribute, number>;
export const POSITIONS = ['Pilar izquierdo','Hooker','Pilar derecho','Segunda línea','Segunda línea','Ala','Ala','Número 8','Medio scrum','Apertura','Wing','Centro','Centro','Wing','Fullback'] as const;
export type Position = typeof POSITIONS[number];
export type Division = 'Top 14' | 'Primera A' | 'Primera B';
export type Squad = 'Plantel superior' | 'M19' | 'M17';
export type SeniorSquad = 'Primera' | 'Intermedia' | 'Pre A' | 'Pre B';
export interface Injury { type: string; name: string; weeksOut: number; since: number; season: number; }
export interface Player { academyClubId?: string; academyIntakeSeason?: number; academyEntry?: 'intake' | 'cover'; youthSeasons?: number; development?: DevelopmentState; trajectory?: { seasons: number; complete: boolean }; seniorSquad?: SeniorSquad; positions?: Position[]; injury?: Injury | null; id: string; name: string; age: number | null; birthDate?: string; ageKnown?: boolean; ageEstimated?: boolean; estimatedBirthDate?: string | null; sourceIds?: string[]; sourceRecordId?: string; position: Position; squad: Squad; attributes: Attributes; potential: number; fitness: number; estimated: boolean; fictional: boolean; }
export interface ClubDefinition { id?: string; name: string; shortName?: string; division: Division; color: string; secondaryColor: string; strength: number; }
export interface Club { id: string; name: string; shortName: string; division: Division; color: string; secondaryColor: string; strength: number; players: Player[]; lineup?: string[]; }
export interface Tactics { mentality?: 'Ofensiva' | 'Equilibrada' | 'Defensiva'; penalty?: 'Palos' | 'Touch' | 'Según marcador'; attack: '1-3-3-1' | '2-4-2'; defense: 'Drift' | 'Rush'; scrum: 'Estable' | 'Presión'; lineout: 'Seguro' | 'Competir'; maul: 'Evitar' | 'Usar'; kicking: 'Conservador' | 'Territorial'; ruck: 'Rápido' | 'Asegurar'; }
export const DEFAULT_TACTICS: Tactics = { mentality:'Equilibrada', penalty:'Según marcador', attack:'1-3-3-1', defense:'Drift', scrum:'Estable', lineout:'Seguro', maul:'Usar', kicking:'Territorial', ruck:'Asegurar' };
export interface Fixture { id: string; division: Division; round: number; homeId: string; awayId: string; match?: MatchResult; stage?: 'semi' | 'final'; neutral?: boolean; }
export type EventType = 'try' | 'conversion' | 'penalty' | 'dropGoal' | 'turnover' | 'kick' | 'lineout' | 'scrum' | 'substitution' | 'knockOn' | 'infringement' | 'yellowCard' | 'redCard' | 'halfTime' | 'fullTime';
export interface MatchEvent { minute: number; second: number; type: EventType; teamId?: string; playerId?: string; description: string; points?: number; slot?: number; returnSecond?: number; homeScore: number; awayScore: number; x: number; y: number; }
export interface ReplayPlayer { id: string; teamId: string; number: number; x: number; y: number; }
export interface ReplayFrame { second: number; players: ReplayPlayer[]; ball: { x: number; y: number; h?: number }; homeScore: number; awayScore: number; possessionId: string; phase?: ReplayPhase; carrierId?: string; targetId?: string; flight?: 'pass'|'kick'; homeDirection?: number; }
export interface ReplayMoment { second:number; possessionId:string; x:number; y:number; homeScore:number; awayScore:number; h?:number; phase?:ReplayPhase; carrierId?:string; targetId?:string; flight?:'pass'|'kick'; homeDirection?:number; }
export interface MatchResult { homeId: string; awayId: string; homeScore: number; awayScore: number; events: MatchEvent[]; frames: ReplayFrame[]; homeTries: number; awayTries: number; seed: number; homeTactics: Tactics; awayTactics: Tactics; timeline: ReplayMoment[]; homeLineup: string[]; awayLineup: string[]; cardEventsTracked?: boolean; replayTrack?: PackedMoment[]; analysis?: { home: TeamAnalysis; away: TeamAnalysis }; }
export interface Standing { clubId: string; played: number; won: number; drawn: number; lost: number; pointsFor: number; pointsAgainst: number; tries: number; bonus: number; points: number; }
export interface ReturnCandidate { origin?: 'documented' | 'simulated'; id:string; homeClubId:string; player:Player; status:'monitoring'|'ready'|'signed'; note:string; willingness:number|null; contactable:boolean; lastContactRound?:number; }
export interface OverseasCareer {
  player: Player;
  originClubId: string;
  fromClubId: string;
  departedSeason: number;
  destination: { country: string; competition: string };
  status: 'abroad' | 'returned' | 'retired';
  returnedSeason?: number;
}
interface CareerNews { round: number; season: number; clubId: string; kind: 'squad'; playerId: string; text: string; }
export interface LeagueState { overseasCareers?: OverseasCareer[]; news?: (CareerNews | { kind: string })[]; seed: number; season: number; clubs: Club[]; fixtures: Fixture[]; tactics: Record<string,Tactics>; trainingRounds?: Record<string,number>; returnCandidates?: ReturnCandidate[]; returnRecords?: ReturnRecord[]; returnObservedAt?: string; nameWeights?: NameWeights; }

function random(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s: string) { let h=2166136261; for (let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return h>>>0; }
const clamp = (n:number, lo:number, hi:number) => Math.max(lo,Math.min(hi,n));
const firstNames=['Tomás','Santiago','Juan','Mateo','Francisco','Joaquín','Agustín','Benjamín','Felipe','Lautaro','Nicolás','Manuel','Pedro','Facundo','Ignacio','Lucas','Ramiro','Martín','Franco','Simón','Jerónimo','Bautista','Federico','Valentín','Gonzalo','Bruno','Ezequiel','Andrés','Marcos','Julián'];
const lastNames=['García','Fernández','Pérez','González','López','Martínez','Rodríguez','Sánchez','Romero','Torres','Díaz','Álvarez','Ruiz','Molina','Castro','Acosta','Sosa','Vega','Ramos','Herrera','Silva','Domínguez','Cabrera','Medina','Suárez','Aguirre','Paz','Costa','Benítez','Luna'];
const attributes = Object.keys(ATTRIBUTE_LABELS) as Attribute[];
type Profile = Partial<Record<Attribute, number>>;

// Weight the work of each position. Fitness and day form never enter this scale.
const prop: Profile = { scrummaging: 5, strength: 4, technique: 3, stamina: 2, breakdown: 2, tackling: 2, discipline: 1, carrying: 1 };
export const ratingWeights: Record<Position, Profile> = {
  'Pilar izquierdo': prop,
  Hooker: { lineout: 4, scrummaging: 4, technique: 3, strength: 2, tackling: 2, handling: 2, stamina: 1, discipline: 1, breakdown: 1 },
  'Pilar derecho': prop,
  'Segunda línea': { jumping: 4, lineout: 3, strength: 3, maul: 3, workRate: 2, tackling: 2, stamina: 1, scrummaging: 1, discipline: 1 },
  Ala: { breakdown: 4, tackling: 4, workRate: 3, stamina: 3, positioning: 2, carrying: 2, decisions: 1, discipline: 1 },
  'Número 8': { carrying: 4, strength: 3, tackling: 3, workRate: 2, breakdown: 2, stamina: 2, handling: 2, offload: 1, decisions: 1 },
  'Medio scrum': { passing: 5, decisions: 4, handling: 3, kicking: 2, vision: 2, workRate: 1, acceleration: 1, positioning: 1, composure: 1 },
  Apertura: { decisions: 4, passing: 3, vision: 3, kicking: 3, goalKicking: 2, composure: 2, handling: 2, positioning: 1 },
  Wing: { pace: 4, acceleration: 3, evasion: 3, handling: 2, agility: 2, positioning: 2, tackling: 2, aerial: 2, carrying: 1, decisions: 1 },
  Centro: { tackling: 3, carrying: 3, handling: 3, passing: 2, evasion: 2, decisions: 2, positioning: 2, strength: 1, pace: 1, offload: 1 },
  Fullback: { positioning: 4, handling: 3, aerial: 3, kicking: 3, pace: 2, tackling: 2, decisions: 2, acceleration: 1, composure: 1, evasion: 1 },
};
export const HOME_EDGE = .62;
export const DAY_FORM = .02;
/**
 * Tactic trade-offs. Real URBA data cannot measure a tactic, but it bounds it: the whole Newman-CASI gap is about
 * 5 points of margin, so no single option should be worth more than about ±1.5 points against an equal side
 * (scripts/engine-calibration-check.mjs measures this). Each option keeps a cost and a benefit.
 */
export const TACTIC_TUNING = {
  // Rush: cheaper to beat when the defensive line is poorly coordinated. Softened on 12/11/2026 (it was worth +3.3
  // for Newman after the strength refit); now about +1 against an equal side.
  rushPenalty: .026, rushPenaltyPerIndiscipline: .012, rushPressureGain: .9, rushPressureError: .014, rushBreakBase: .03, rushBreakOpen: .025,
  // Conservador kicks less often but long into the field; Territorial looks for touch. Both within ±0.5 points.
  // Juego aéreo: base rates for a kick into the field between equal players, moved by the aerial gap per point.
  aerialDrop: .035, kickRegain: .025, restartRegain: .12, aerialSlope: .008,
    conservativeKickDistance: 30, territorialKickDistance: 29, conservativeKickChance: 0, territorialKickChance: .075,
  // Ruck Rápido: more line breaks and metres, more turnovers at the breakdown.
  fastBreak: .035, fastGain: 1.9, fastPassError: .018, fastRuckExposure: .042,
  // Mentality. Ofensiva keeps the ball in hand and goes wide: more breaks, more handling errors. Defensiva kicks for
  // territory and plays tight: fewer errors, fewer breaks. Equilibrada is the calibrated baseline.
  attackingWide: .10, attackingKick: -.05, attackingBreak: .018, attackingError: .007,
  defensiveWide: -.10, defensiveKick: .06, defensiveBreak: -.008, defensiveError: -.012,
  // Penalty choice. Palos takes the points from further out; Touch goes for the lineout (and the maul) except from
  // long range late on; Según marcador is the calibrated baseline, chasing the game late when behind.
  postsFrom: 67, postsChance: .93, touchPointsChance: .65,
};
export function overall(player: Pick<Player, 'position' | 'attributes'>): number {
  const weights = ratingWeights[player.position];
  let total = 0, weight = 0;
  for (const attr of attributes) {
    const w = weights[attr] ?? 0;
    if (!w) continue;
    total += (player.attributes[attr] ?? aerialFrom(player.position, player.attributes)) * w;
    weight += w;
  }
  return clamp(Math.round((total / weight - 1) * 100 / 19), 0, 100);
}

export interface DevelopmentEvidence {
  appearances: number;
  starts: number;
  minutes: number;
  tries: number;
  points: number;
  complete: boolean;
}
type DevelopmentState = {
  originalProjection: number;
  projection: number;
  trainingGains: number;
  seasonTrainingGains: number;
  trainingSeason?: number;
  seasonAttributes?: Partial<Record<Attribute, number>>;
  talent?: boolean;
  seasonIndividualGains?: number;
};
type DevelopmentContext = {
  seed: number;
  season: number;
  round: number;
  evidence?: DevelopmentEvidence;
  mode: 'individual' | 'youth' | 'senior';
};
function developmentAge(player: Player): number {
  if (player.age != null) return player.age;
  if (player.squad === 'M17') return 17;
  if (player.squad === 'M19') return 19;
  const seasons = player.trajectory?.complete ? player.trajectory.seasons : undefined;
  return seasons ? Math.min(35, 19 + seasons * 2) : 27;
}
function developmentState(player: Player): DevelopmentState {
  if (player.development) return player.development;
  const age = developmentAge(player);
  const current = overall(player);
  const positionPeak = Math.max(...attributes.filter(a => ratingWeights[player.position][a]).map(a => player.attributes[a]));
  const legacyHeadroom = clamp((player.potential - positionPeak) * 1.3, 0, 5);
  const expectedGain = age < 18 ? 12 : age < 21 ? 9 : age < 24 ? 6 : age < 28 ? 3 : 1;
  const originalProjection = clamp(Math.round(current + (expectedGain + legacyHeadroom) * talentFactor(player)), current, 98);
  return { originalProjection, projection: originalProjection, trainingGains: 0, seasonTrainingGains: 0, talent: true };
}
/**
 * Talent (12/11/2026): how much of the usual room to grow a player has, from 0.45 to 1.55 (mean 1), fixed per player.
 * An M17 rated 45 projects to about 52 with little talent and about 70 with a lot. The projection is an estimate: good
 * seasons and individual training move it up (reviewDevelopment), so a player can end above it.
 */
/** Saved leagues (data v22): a stored projection of a young player is rescaled by his talent, once. */
export function withTalent(player: Player): Player {
  const dev = player.development;
  if (!dev || dev.talent) return player;
  if (developmentAge(player) >= 24) return { ...player, development: { ...dev, talent: true } };
  const current = overall(player), f = talentFactor(player), scale = (x: number) => Math.round(current + Math.max(0, x - current) * f);
  return { ...player, development: { ...dev, originalProjection: scale(dev.originalProjection), projection: scale(dev.projection), talent: true } };
}
/**
 * How far a player can go past his projection (12/11/2026): usually 3 points, but the projection is an estimate and
 * some players surprise: 13 % can go 5 points past it, 5 % seven and 2 % ten. Fixed per player; past the projection
 * growth is slow (headroom in developPlayer), so it takes good seasons and training to get there.
 */
export function surpriseMargin(player: Pick<Player, 'id'>): number {
  const u = random(hash(`${player.id}/surprise`))();
  return u < .02 ? 10 : u < .07 ? 7 : u < .20 ? 5 : 3;
}
export function talentFactor(player: Pick<Player, 'id'>): number {
  const rng = random(hash(`${player.id}/talent`));
  return .45 + 1.1 * (rng() + rng()) / 2;
}
export function developmentProfile(player: Player) {
  const base = developmentState(player), current = overall(player);
  return {
    originalProjection: base.originalProjection,
    projection: Math.max(current, base.projection),
    // Soft ceiling: it rises with the projection, so good seasons keep opening room above the first estimate.
    ceiling: Math.max(current, Math.min(100, base.projection + surpriseMargin(player))),
    trainingGains: base.trainingGains,
    seasonTrainingGains: base.seasonTrainingGains,
    trainingSeason: base.trainingSeason,
    seasonTrainingLimit: seasonalLimit(player),
  };
}
function seasonalLimit(player: Player): number {
  const age = developmentAge(player);
  return player.squad !== 'Plantel superior' ? 15 : age <= 21 ? 9 : age <= 24 ? 7 : age <= 29 ? 5 : 3;
}
function individualAttributeLimit(player: Player): number {
  const age = developmentAge(player);
  return age < 21 ? 4 : age < 26 ? 3 : 2;
}
export function canDevelopAttribute(player: Player, attribute: Attribute, season?: number): boolean {
  if (player.injury || !attributes.includes(attribute) || player.attributes[attribute] >= 20) return false;
  const progress = player.development;
  if (season !== undefined && progress?.trainingSeason === season && (progress.seasonTrainingGains >= seasonalLimit(player) || (progress.seasonAttributes?.[attribute] ?? 0) >= individualAttributeLimit(player))) return false;
  const profile = developmentProfile(player);
  const newRating = overall({ position: player.position, attributes: { ...player.attributes, [attribute]: player.attributes[attribute] + 1 } });
  return newRating <= profile.ceiling;
}
function scoringEvidence(player: Player, evidence?: DevelopmentEvidence): number {
  if (!evidence?.complete) return 0;
  const backs = POSITIONS.indexOf(player.position) >= 8;
  const kicker = player.position === 'Apertura' || player.position === 'Fullback' || player.position === 'Medio scrum';
  const kickPoints = Math.max(0, evidence.points - evidence.tries * 5);
  return clamp(evidence.tries / (backs ? 5 : 3) + (kicker ? kickPoints / 40 : 0), 0, 1);
}
export function developPlayer(player: Player, attribute: Attribute, context: DevelopmentContext): Player {
  if (!canDevelopAttribute(player, attribute, context.season)) return player;
  const state = developmentState(player);
  const sameSeason = state.trainingSeason === context.season;
  const seasonalGains = sameSeason ? state.seasonTrainingGains : 0;
  const trainedAttributes = sameSeason ? state.seasonAttributes ?? {} : {};
  const age = developmentAge(player);

  const current = overall(player);
  const relevant = ratingWeights[player.position][attribute] ?? 0;
  const minutes = context.evidence?.minutes ?? 0;
  const playing = clamp(minutes / 1050, 0, 1);
  const scoring = scoringEvidence(player, context.evidence);
  const ageFactor = age < 22 ? 1 : age < 27 ? .88 : age < 32 ? .70 : .52;
  // A surprise player (surpriseMargin above 3) only starts slowing down that much later.
  const distance = current - state.projection - (surpriseMargin(player) - 3);
  const headroom = clamp(1 - Math.max(0, distance + 2) * .105, .15, 1);
  const specialty = relevant ? 1 : .83;
  const likelihood = context.mode === 'individual' && distance <= -2 && age <= 29
    ? 1
    : clamp(ageFactor * specialty * headroom * (.94 + playing * .14 + scoring * .10), .08, 1);
  if (random(context.seed ^ hash(`${context.season}/${context.round}/${player.id}/${attribute}/${context.mode}`))() >= likelihood) return player;
  const updated = { ...player, attributes: { ...player.attributes, [attribute]: player.attributes[attribute] + 1 } };
  const gains = seasonalGains + 1;
  // The youth plan's weekly growth does not move the projection (it is what the projection already expects): only
  // individual training and senior growth while playing do, one point every four gains.
  const individualGains = (sameSeason ? state.seasonIndividualGains ?? 0 : 0) + (context.mode === 'individual' ? 1 : 0);
  const incrementalProjection = (age < 26 && (context.mode === 'individual' ? individualGains % 4 === 0 : context.mode === 'senior' && gains % 4 === 0 && minutes >= 480)) ? 1 : 0;
  return {
    ...updated,
    development: {
      ...state,
      // The projection does not chase the current level (that ratchet made the ceiling endless): only evidence moves it.
      projection: Math.min(100, state.projection + incrementalProjection),
      trainingGains: state.trainingGains + 1,
      trainingSeason: context.season,
      seasonTrainingGains: gains,
      seasonIndividualGains: individualGains,
      seasonAttributes: { ...trainedAttributes, [attribute]: (trainedAttributes[attribute] ?? 0) + 1 },
    },
  };
}
function reviewDevelopment(player: Player, evidence: DevelopmentEvidence | undefined, season: number, seed: number): Player {
  if (!player.development && !evidence?.minutes) return player;
  const state = developmentState(player);
  const gains = state.trainingSeason === season ? state.seasonTrainingGains : 0;
  const age = developmentAge(player);
  // Recorded minutes are a lower bound for older leagues. Tries count as an additional signal, never a prerequisite.
  const played = evidence?.minutes ?? 0;
  const starts = evidence?.starts ?? 0;
  const strongSeason = played >= 1050 && starts >= 10 && (gains >= 2 || scoringEvidence(player, evidence) >= .7 || played >= 1450);
  let progressed = player;
  if (age <= 26 && strongSeason) {
    const relevant = attributes.filter(a => ratingWeights[player.position][a] && canDevelopAttribute(player, a, season));
    if (relevant.length) {
      const rng = random(seed ^ hash(`${season}/${player.id}/season-review`));
      const selected = relevant[Math.floor(rng() * relevant.length)];
      progressed = developPlayer(player, selected, { seed, season, round: 99, evidence, mode: 'senior' });
    }
  }
  const after = developmentState(progressed);
  // The projection is revised with the season: playing a lot (minutes and starts, which counts for those who rarely
  // score), tries and kicked points, and individual training all add to it; a season without minutes adds nothing.
  const young = age <= 28;
  const revision = !young ? 0
    : (strongSeason ? 2 : played >= 480 ? 1 : 0)
      + (scoringEvidence(player, evidence) >= .7 ? 1 : 0)
      + ((state.trainingSeason === season ? state.seasonIndividualGains ?? 0 : 0) >= 5 ? 1 : 0);
  return {
    ...progressed,
    development: {
      ...after,
      projection: Math.min(100, after.projection + revision),
      seasonTrainingGains: 0,
      seasonIndividualGains: 0,
      seasonAttributes: {},
      trainingSeason: season + 1,
    },
  };
}

const forwards: Profile = { strength: 1.8, stamina: .4, pace: -3.4, acceleration: -2.9, agility: -2.6, goalKicking: -7, kicking: -4.8, passing: -1.2, vision: -1.4, evasion: -1.7, carrying: 1, maul: .8, breakdown: 1, tackling: .8 };
const backs: Profile = { strength: -1.8, stamina: .5, pace: 1.5, acceleration: 1.5, agility: 1, passing: .5, handling: .5, maul: -4.5, scrummaging: -7, lineout: -3.5, breakdown: -.7, goalKicking: -4 };
const role: Record<Position, Profile> = {
  'Pilar izquierdo': { scrummaging: 2.5, strength: 1.2, lineout: -2.3, jumping: -2.3, stamina: -.8 },
  'Pilar derecho': { scrummaging: 3, strength: 1.4, lineout: -2.5, jumping: -2.3, stamina: -1 },
  Hooker: { lineout: 2.7, scrummaging: 1.9, handling: .6, tackling: .5, jumping: -1.1 },
  'Segunda línea': { jumping: 2.9, lineout: 2.3, maul: 1, scrummaging: .4, workRate: .8 },
  Ala: { breakdown: 1.7, tackling: 1.3, workRate: 1.3, stamina: 1.2, pace: 1.2, scrummaging: -2 },
  'Número 8': { carrying: 1.7, strength: .7, offload: .9, handling: 1, pace: .8, scrummaging: -1.5 },
  'Medio scrum': { passing: 2.6, decisions: 1.5, kicking: 1.8, vision: 1.4, handling: .7, goalKicking: 2 },
  Apertura: { passing: 1.6, vision: 1.8, kicking: 2.6, goalKicking: 6.3, decisions: 1.4, composure: 1.1 },
  Wing: { pace: 1.7, acceleration: 1.7, agility: 1, evasion: 2, kicking: -1.1 },
  Centro: { strength: 1.5, carrying: 1.7, tackling: 1.2, passing: .6, offload: 1.3 },
  Fullback: { positioning: 2, kicking: 2.3, goalKicking: 3.4, jumping: 1.2, handling: 1.3 },
};
function createAttributes(position: Position, base: number, rng: () => number): Attributes {
  const group = POSITIONS.indexOf(position) < 8 ? forwards : backs;
  const generated = Object.fromEntries(attributes.filter(attr => attr !== 'aerial').map(attr => [attr, clamp(Math.round(base + (group[attr] ?? 0) + (role[position][attr] ?? 0) + (rng() + rng() - 1) * 2.7), 1, 20)])) as Attributes;
  return { ...generated, aerial: aerialFrom(position, generated) };
}
/**
 * Juego aéreo (catching and contesting high balls), added on 12/11/2026. It draws no random number of its own, so
 * every other attribute generates exactly as before: it comes from jumping, handling and positioning, with a lift
 * for the back three, who live under the high ball. The data migration (v21) uses the same formula.
 */
export function aerialFrom(position: Position, a: Partial<Attributes>): number {
  const lift = position === 'Fullback' ? 1.5 : position === 'Wing' ? 1 : 0;
  return clamp(Math.round((a.jumping ?? 10) * .35 + (a.handling ?? 10) * .35 + (a.positioning ?? 10) * .3 + lift), 1, 20);
}
/** Overall of a player with no individual or attribute noise: what a club's tier promises for this position. */
export function expectedOverall(position: Position, base: number): number {
  return overall({ position, attributes: createAttributes(position, base, () => .5) });
}
/**
 * Removes the club-level bias that random squad generation leaves behind: individual players keep their spread,
 * but the starting XV averages what the club strength promises. Without this, the seed alone moved a club by
 * ±4-6 points of margin (research/history/calibration-history-report.md). Deterministic per player id.
 */
/** bonus: extra XV mean (overall points) on top of what the club strength promises, e.g. for its internationals. */
export function levelClubSquad(club: Club, bonus = 0): Club {
  const target = bonus + POSITIONS.reduce((n, position) => n + expectedOverall(position, club.strength + seniorSquadAdjustment('Primera')), 0) / 15;
  for (let pass = 0; pass < 4; pass++) {
    const xv = selection(club).slice(0, 15);
    const actual = xv.reduce((n, p) => n + overall(p), 0) / xv.length;
    const shift = (target - actual) * 19 / 100;
    if (Math.abs(target - actual) < .15) break;
    for (const player of club.players) {
      const jitter = random(hash(`${club.id}/${player.id}/level/${pass}`));
      player.attributes = Object.fromEntries(attributes.map(attr => [attr, clamp(Math.floor(player.attributes[attr] + shift + jitter()), 1, 20)])) as Attributes;
    }
  }
  return club;
}
/**
 * A corrected position (community data) means the attributes were generated for the wrong role: a fly-half listed as
 * a wing kept kicking and lost pace. Rebuild the profile for the new position at the same overall, so the level is
 * kept and only its shape changes. Deterministic per player id.
 */
export function reshapeForPosition(player: Pick<Player, 'id' | 'position' | 'attributes'>, position: Position): Attributes {
  const target = overall(player), seed = hash(`${player.id}/reshape/${position}`);
  const build = (base: number) => createAttributes(position, base, random(seed));
  let lo = -5, hi = 25;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (overall({ position, attributes: build(mid) }) < target) lo = mid; else hi = mid; }
  return build(hi);
}
/** individual: documented quality (starts, experience) replaces the random spread when known. */
export function createPlayerAttributes(position: Position, base: number, seed: string | number, individual?: number): Attributes {
  const rng = random(typeof seed === 'number' ? seed : hash(seed));
  // Most players sit close to their tier, with some overlap and a handful of standouts.
  const spread = (rng() + rng() - 1) * 2.3;
  return createAttributes(position, base + (individual ?? spread), rng);
}
/** A player can only be picked in his own positions: the main one plus those documented in published line-ups. */
export function canPlay(player: Pick<Player, 'position' | 'positions'>, position: Position): boolean {
  return player.position === position || !!player.positions?.includes(position);
}
/** Default XV: the best available player for each position, natural position first, then a documented second one. */
export const available = (p: Pick<Player, 'injury'>) => !p.injury;
export function autoLineup(club: Pick<Club, 'players'>): string[] {
  const senior = club.players.filter(p => p.squad === 'Plantel superior' && available(p)), used = new Set<string>(), ids: string[] = [];
  const best = (list: Player[]) => list.filter(p => !used.has(p.id)).sort((a, b) => overall(b) - overall(a))[0];
  for (const position of POSITIONS) {
    const p = best(senior.filter(p => p.position === position)) ?? best(senior.filter(p => canPlay(p, position))) ?? best(senior);
    if (p) { used.add(p.id); ids.push(p.id); }
  }
  return ids;
}
/** Attribute base of a division's average club (catalogue score 70); the gaps set how promoted clubs fare. */
// Primera A and B were raised on 11/11/2026 (from 9.8 and 8.8): promoted clubs won 14 % of their first Top 14
// season with a -16.9 margin; real URBA promoted clubs 2018-2026 won 26 % at -11 (15 cases), the game now 29 % at
// -10.5 (16 simulated cases). Primera B keeps a similar gap below Primera A.
// Attribute points per point of catalogue strength (club ranking). Sets how far apart the clubs of a division are.
export const STRENGTH_SLOPE = Number((globalThis as any).process?.env?.RM_SLOPE) || .071;
export const DIVISION_BASELINE: Record<Division, number> = { 'Top 14': 10.9, 'Primera A': 10.15, 'Primera B': 9.2 };
export function localClubStrength(score: number, division: Division): number {
  // Club rankings are relative to a division. They never become individual ratings.
  const baseline = DIVISION_BASELINE[division];
  return baseline + (clamp(score, 42, 96) - 70) * STRENGTH_SLOPE;
}
const seniorTiers: SeniorSquad[] = ['Primera', 'Intermedia', 'Pre A', 'Pre B'];
export function seniorSquadAdjustment(tier: SeniorSquad): number {
  return { Primera: 0, Intermedia: -1.25, 'Pre A': -2.4, 'Pre B': -3.45 }[tier];
}
/** Carry each old attribute's limited individual variation into the recalibrated role. */
export function migratePlayerAttributes(player: Player, base: number, previousStrength: number): Attributes {
  const index = POSITIONS.indexOf(player.position);
  const forward = index < 8;
  const oldForward = ['strength', 'tackling', 'breakdown', 'scrummaging', 'lineout', 'jumping', 'maul', 'carrying', 'workRate'];
  const oldBack = ['pace', 'acceleration', 'agility', 'passing', 'handling', 'vision', 'decisions', 'kicking', 'evasion', 'offload'];
  const oldBase = previousStrength + (player.squad === 'M17' ? -4 : player.squad === 'M19' ? -2 : 0);
  const recalibrated = createAttributes(player.position, base, () => .5);
  for (const attr of attributes) {
    let bonus = (forward ? oldForward : oldBack).includes(attr) ? 1.5 : -.4;
    if (['pace', 'acceleration', 'agility'].includes(attr)) bonus += forward ? -2.2 : 1.5;
    if (['strength', 'scrummaging', 'maul'].includes(attr)) bonus += forward ? 1 : -1.5;
    if (attr === 'scrummaging') bonus = index < 3 ? 3.4 : forward ? 0 : -4;
    if (attr === 'lineout' || attr === 'jumping') bonus = [3, 4, 5, 6].includes(index) ? 3 : 0;
    if (attr === 'goalKicking') bonus = [9, 14].includes(index) ? 3 : -3;
    if (attr === 'kicking') bonus = [8, 9, 14].includes(index) ? 3 : forward ? -3 : 0;
    const expected = clamp(Math.round(oldBase + bonus), 1, 20);
    const deviation = clamp(player.attributes[attr] - expected, -3, 3);
    recalibrated[attr] = clamp(recalibrated[attr] + deviation, 1, 20);
  }
  return recalibrated;
}
type WeightedName = { name: string; weight: number };
export type NameWeights = { firstNames?: WeightedName[]; surnames?: WeightedName[]; byClub?: Record<string, WeightedName[]>; mix?: { clubSurnameChance?: number; maxSameSurnamePerIntake?: number }; };
function drawName(rng: () => number, entries: WeightedName[] | undefined, fallback: string[]): string {
  const options = entries?.filter(entry => entry.name && Number.isFinite(entry.weight) && entry.weight > 0) ?? [];
  if (!options.length) return fallback[Math.floor(rng() * fallback.length)];
  let draw = rng() * options.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of options) {
    draw -= entry.weight;
    if (draw < 0) return entry.name;
  }
  return options[options.length - 1].name;
}
function makePlayer(clubId: string, index: number, strength: number, rng: () => number, squad: Squad, names?: NameWeights, intakeNames?: Set<string>): Player {
  const position = POSITIONS[index % 15];
  const seniorSquad = squad === 'Plantel superior' ? seniorTiers[Math.floor(index / 15)] : undefined;
  const age = squad === 'M17' ? 16 + Math.floor(rng() * 2) : squad === 'M19' ? 18 + Math.floor(rng() * 2) : 19 + Math.floor((rng() + rng()) * 8);
  const tier = seniorSquad ? seniorSquadAdjustment(seniorSquad) : squad === 'M19' ? -3.05 : -4.35;
  const playerAttributes = createPlayerAttributes(position, strength + tier, Math.floor(rng() * 0x100000000));
  const peak = Math.max(...Object.values(playerAttributes));
  const potential = clamp(peak + (age < 20 ? 2 + Math.floor(rng() * 3) : Math.floor(rng() * 3)), 1, 20);
  const nameRng = random(Math.floor(rng() * 0x100000000));
  const available = (options: WeightedName[] | undefined) => options?.filter(entry => !intakeNames?.has(entry.name));
  const clubSurnames = available(names?.byClub?.[clubId]);
  const clubChance = clamp(names?.mix?.clubSurnameChance ?? .3, 0, 1);
  const surnameList = clubSurnames?.length && nameRng() < clubChance ? clubSurnames : available(names?.surnames);
  const lastName = drawName(nameRng, surnameList, lastNames.filter(name => !intakeNames?.has(name)));
  intakeNames?.add(lastName);
  const name = `${drawName(nameRng, names?.firstNames, firstNames)} ${lastName}`;
  return { seniorSquad, academyClubId: squad !== 'Plantel superior' ? clubId : undefined, id: `${clubId}-${squad === 'Plantel superior' ? 's' : squad === 'M19' ? '19' : '17'}-${index}`, name, age, position, squad, attributes: playerAttributes, potential, fitness: 100, estimated: true, fictional: true };
}
const CLUB_DATA: Record<Division, [string,string,string,number][]> = {
 'Top 14': [['SIC','#f5f4ee','#111827',16],['Hindú','#f0cf28','#143f8d',16],['Alumni','#d32835','#ffffff',15],['Newman','#9f1b35','#f2d87a',17],['CASI','#161616','#ffffff',15],['CUBA','#18335e','#f2d361',14],['Belgrano Athletic','#7d4d32','#f4d12f',14],['San Luis','#b32d3a','#193b6d',14],['Pucará','#d83238','#ffffff',13],['Regatas Bella Vista','#2c8abf','#ffffff',13],['Buenos Aires','#263867','#ffffff',13],['La Plata','#f3d33b','#141414',12],['San Cirano','#1d3e77','#e8d74d',12],['Los Tilos','#299552','#ffffff',12]],
 'Primera A': [['Atlético del Rosario','#bb273a','#ffffff',13],['Champagnat','#873a8d','#ffffff',12],['Olivos','#20456c','#ffffff',12],['Lomas','#e1c82f','#1c2542',12],['San Albano','#216ba4','#ffffff',11],['San Martín','#df3a31','#ffffff',11],['Banco Nación','#4987bc','#ffffff',11],['Curupaytí','#39794b','#ffffff',11],['Pueyrredón','#326ead','#ffffff',10],['Albatros','#cd3443','#ffffff',10],['Los Matreros','#ef8c32','#ffffff',10],['SITAS','#29824d','#ffffff',10],['Universitario de La Plata','#1b3966','#ffffff',10],['Biei','#a72432','#ffffff',9]],
 'Primera B': [['Mariano Moreno','#151515','#ffffff',10],['GEBA','#f6f6f3','#3294c3',10],['Hurling','#286d42','#ffffff',10],['Monte Grande','#c63a41','#ffffff',9],['Los Cedros','#2b7a49','#ffffff',9],['La Salle','#1b3d70','#ffffff',9],['Ciudad de Buenos Aires','#3691bd','#ffffff',9],['San Patricio','#4d9350','#ffffff',9],['San Carlos','#a82e34','#ffffff',8],['Argentino de Rugby','#213a70','#ffffff',8],['Vicente López','#4093bd','#ffffff',8],['Liceo Naval','#1c355b','#ffffff',8],['Manuel Belgrano','#85bcd7','#ffffff',8],['Lanús','#853747','#ffffff',7]]
};
const slug=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function createClubs(seed=26, definitions?:ClubDefinition[], names?:NameWeights):Club[] {
  const entries:ClubDefinition[]=definitions ?? (Object.entries(CLUB_DATA) as [Division,[string,string,string,number][]][]).flatMap(([division, clubs])=>clubs.map(([name,color,secondaryColor,strength])=>({name,color,secondaryColor,strength:localClubStrength(72+(strength-12)*5,division),division})));
  return entries.map(({id:providedId,name,shortName,division,color,secondaryColor,strength})=>{
    const id=providedId ?? slug(name); const rng=random(seed^hash(id));
    const under19Names = new Set<string>(), under17Names = new Set<string>();
    const players = [
      ...Array.from({length:60}, (_, i) => makePlayer(id, i, strength, rng, 'Plantel superior', names)),
      ...Array.from({length:15}, (_, i) => makePlayer(id, i, strength, rng, 'M19', names, under19Names)),
      ...Array.from({length:15}, (_, i) => makePlayer(id, i, strength, rng, 'M17', names, under17Names)),
    ];
    return boundGeneratedReserves({id,name,shortName:shortName ?? (name.length>13?name.split(' ').map(x=>x[0]).join('').slice(0,4).toUpperCase():name),division,color,secondaryColor,strength,players});
  });
}
// Reserve generation is bounded once. Existing or developed players are never re-rated for moving categories.
export function boundGeneratedReserves(club: Club): Club {
  const higher = club.players.filter(p => p.squad === 'Plantel superior' && (p.seniorSquad === 'Primera' || p.seniorSquad === 'Intermedia'));
  if (!higher.length) return club;
  const cap = Math.min(...higher.map(overall));
  return {
    ...club,
    players: club.players.map(p => {
      if (!p.fictional || p.squad !== 'Plantel superior' || (p.seniorSquad !== 'Pre A' && p.seniorSquad !== 'Pre B') || overall(p) <= cap) return p;
      const attrs = { ...p.attributes };
      let trial = { ...p, attributes: attrs };
      while (overall(trial) > cap) {
        for (const a of attributes) attrs[a] = Math.max(1, attrs[a] - 1);
      }
      return trial;
    }),
  };
}
export function createFixtures(clubs:Club[]):Fixture[] {
  const fixtures:Fixture[]=[];
  for (const division of ['Top 14','Primera A','Primera B'] as Division[]) {
    const ids=clubs.filter(c=>c.division===division).map(c=>c.id); if(ids.length%2) ids.push('BYE');
    const rotation=[...ids];
    const firstLegStart=fixtures.length;
    for(let round=1;round<rotation.length;round++) {
      for(let i=0;i<rotation.length/2;i++) {
        let homeId=rotation[i],awayId=rotation[rotation.length-1-i]; if((round+i)%2===0) [homeId,awayId]=[awayId,homeId];
        if(homeId!=='BYE'&&awayId!=='BYE') fixtures.push({id:`${slug(division)}-${round}-${homeId}-${awayId}`,division,round,homeId,awayId});
      }
      rotation.splice(1,0,rotation.pop()!);
    }
    const firstLeg=fixtures.slice(firstLegStart);
    for(const f of firstLeg) {const round=f.round+rotation.length-1;fixtures.push({...f,id:`${slug(division)}-${round}-${f.awayId}-${f.homeId}`,round,homeId:f.awayId,awayId:f.homeId});}
  }
  return fixtures;
}
export function createInitialState(seed=26, definitions?:ClubDefinition[], names?:NameWeights):LeagueState { const clubs=createClubs(seed,definitions,names); return {seed,season:2026,clubs,fixtures:createFixtures(clubs),tactics:Object.fromEntries(clubs.map(c=>[c.id,{...DEFAULT_TACTICS}])),nameWeights:names,returnCandidates:[]}; }
/** The XV that will actually play: the chosen one with injured starters replaced. */
export function effectiveLineup(club:Club):string[] { return selection(club).slice(0,15).map(p=>p.id); }
function selection(club:Club):Player[] {
  const senior=club.players.filter(p=>p.squad==='Plantel superior'&&available(p));
  const ids=club.lineup??[];
  if(ids.length!==15 || new Set(ids).size!==15 || !ids.every(id=>club.players.some(p=>p.id===id))) {
    const automatic=autoLineup(club).map(id=>senior.find(p=>p.id===id)!);
    return [...automatic,...senior.filter(p=>!automatic.includes(p))];
  }
  // An injured starter is replaced in his slot by the best available player for that position; the rest stays.
  const chosen:Player[]=[];
  for(let i=0;i<15;i++){
    const p=senior.find(p=>p.id===ids[i]);
    const pick=p ?? senior.filter(x=>!ids.includes(x.id)&&!chosen.includes(x)&&canPlay(x,POSITIONS[i])).sort((a,b)=>overall(b)-overall(a))[0] ?? senior.find(x=>!ids.includes(x.id)&&!chosen.includes(x));
    if(pick)chosen.push(pick);
  }
  return [...chosen,...senior.filter(p=>!chosen.includes(p))];
}
const shirtRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => i + from);
const pack = shirtRange(0, 7), backline = shirtRange(8, 14), jumpers = [3, 4, 5, 6], frontRow = [0, 1, 2];

interface Team {
  club: Club;
  tactics: Tactics;
  lineup: Player[];
  startingIds: string[];
  bench: (Player | undefined)[];
  form: number;
  analysis: TeamAnalysis;
  territorialPhases: number;
  replacementStart: Map<string, number>;
  suspendedUntil: Map<string, number>;
}
interface TeamAnalysis {
  openPlay: number;
  scrum: number;
  lineout: number;
  maul: number;
  kicking: number;
  discipline: number;
  fitness: number;
  dayForm: number;
  phases: number;
  territory: number;
  turnoversWon: number;
  metresGained: number;
}
type Ball = { x: number; y: number };
type Random = () => number;
const roundOne = (n: number) => Math.round(n * 10) / 10;
const choose = <T,>(list: T[], rng: Random): T => list[Math.floor(rng() * list.length)];

function attributeAt(team: Team, player: Player, attr: Attribute, second: number): number {
  const elapsed = (second - (team.replacementStart.get(player.id) ?? 0)) / 4800;
  const startFitness = .72 + .28 * clamp(player.fitness, 0, 100) / 100;
  const fade = 1 - elapsed * (.17 - player.attributes.stamina * .006);
  return player.attributes[attr] * startFitness * fade * (1 + team.form);
}
const activeAt = (team: Team, player: Player, second: number) => (team.suspendedUntil.get(player.id) ?? 0) <= second;
function unit(team: Team, slots: number[], weights: Profile, second: number): number {
  let total = 0, weight = 0;
  for (const slot of slots) {
    for (const [attr, w] of Object.entries(weights) as [Attribute, number][]) {
      const player = team.lineup[slot];
      total += attributeAt(team, player, attr, second) * w * (activeAt(team, player, second) ? 1 : .5);
      weight += w;
    }
  }
  return total / weight;
}
const scrumSkill = (team: Team, second: number) =>
  unit(team, frontRow, { scrummaging: 5, strength: 2, technique: 2, discipline: 1 }, second) * .76 +
  unit(team, [3, 4, 5, 6, 7], { strength: 2, scrummaging: 1 }, second) * .24;
const lineoutSkill = (team: Team, second: number) =>
  unit(team, [1], { lineout: 4, technique: 1, composure: 1 }, second) * .48 +
  unit(team, jumpers, { jumping: 4, lineout: 3, handling: 1, strength: 1 }, second) * .52;
const maulSkill = (team: Team, second: number) => unit(team, pack, { maul: 5, strength: 3, technique: 2 }, second);
const allShirts = [...pack, ...backline];
const onScale = (n: number) => clamp(Math.round((n - 1) * 100 / 19), 0, 100);
function prepareTeam(club: Club, tactics: Tactics, rng: Random): Team {
  const chosen = selection(club);
  if (chosen.length < 15) throw new Error('El club necesita 15 jugadores habilitados');
  const lineup = chosen.slice(0, 15);
  const bench = [0, 3].map(slot => chosen.slice(15).find(p => p.position === POSITIONS[slot]));
  const fitness = Math.round(lineup.reduce((n, p) => n + p.fitness, 0) / 15);
  // Calibrated against URBA 2016-2026 (research/history): the engine already has more per-match noise than real
  // results, so day form only adds a small ±2 % swing.
  const form = (rng() + rng() - 1) * DAY_FORM;
  // Report skill with a fit XV on a neutral day; fitness and match form are shown separately.
  const analysis: TeamAnalysis = { openPlay: 0, scrum: 0, lineout: 0, maul: 0, kicking: 0, discipline: 0, fitness, dayForm: roundOne(form * 100), phases: 0, territory: 50, turnoversWon: 0, metresGained: 0 };
  const team: Team = { club, tactics, lineup: lineup.map(p => ({ ...p, fitness: 100 })), startingIds: lineup.map(p => p.id), bench, form: 0, analysis, territorialPhases: 0, replacementStart: new Map(), suspendedUntil: new Map() };
  analysis.openPlay = onScale(unit(team, allShirts, { handling: 2, carrying: 2, tackling: 2, decisions: 1, breakdown: 1 }, 0));
  analysis.scrum = onScale(scrumSkill(team, 0));
  analysis.lineout = onScale(lineoutSkill(team, 0));
  analysis.maul = onScale(maulSkill(team, 0));
  analysis.kicking = onScale(unit(team, [8, 9, 14], { kicking: 3, vision: 1 }, 0));
  analysis.discipline = onScale(unit(team, allShirts, { discipline: 3, composure: 1 }, 0));
  return { ...team, lineup, form };
}

/**
 * At each phase the current skills are fitness-adjusted, then compared with their direct opposition.
 * Bernoulli draws decide infringements, execution, retention and kicks; independent draws vary metres.
 * Field position changes later choices and opportunities. There is no roll for a final score or winner.
 */
export function generateMatch(homeClub: Club, awayClub: Club, homeTactics: Tactics = DEFAULT_TACTICS, awayTactics: Tactics = DEFAULT_TACTICS, seed = 26, includeFrames = true, neutral = false): MatchResult {
  const rng = random(seed), events: MatchEvent[] = [], timeline: ReplayMoment[] = [];
  const home = prepareTeam(homeClub, homeTactics, rng), away = prepareTeam(awayClub, awayTactics, rng);
  let homeScore = 0, awayScore = 0, homeTries = 0, awayTries = 0;
  let second = 0, homeDirection = 1, ball: Ball = { x: 50, y: 35 };
  let team = rng() < .5 ? home : away;
  const openingReceiver = team;
  let carrier: Player | undefined;
  let nextPhase: 'ruck' | 'scrum' | 'lineout' = 'ruck';
  const other = (t: Team) => t === home ? away : home;
  const direction = (t: Team) => t === home ? homeDirection : -homeDirection;
  const progress = (t: Team) => direction(t) > 0 ? ball.x : 100 - ball.x;
  const coord = (t: Team, metre: number) => direction(t) > 0 ? metre : 100 - metre;
  const jog = (dx: number, dy: number): Ball => ({ x: clamp(ball.x + dx, 1, 99), y: clamp(ball.y + dy, 1, 69) });
  const chance = (p: number, min: number, max: number) => rng() < clamp(p, min, max);
  // Home advantage in attribute points per duel: .62 reproduces the real URBA home margin of about +2 points.
  // A final at a neutral ground has no home advantage.
  const edge = (s: number) => team === home && !neutral ? s + HOME_EDGE : s;
  const attr = (t: Team, p: Player, a: Attribute, at = second) => attributeAt(t, p, a, at);

  function actor(side: Team, slots: number[], at = second): Player {
    const candidates = slots.map(slot => side.lineup[slot]).filter(p => activeAt(side, p, at));
    return choose(candidates.length ? candidates : side.lineup.filter(p => activeAt(side, p, at)), rng);
  }
  function atSlot(side: Team, slot: number, at = second): Player {
    const preferred = side.lineup[slot];
    return activeAt(side, preferred, at) ? preferred : side.lineup.find(p => activeAt(side, p, at))!;
  }

  function moment(at: number, phase: ReplayPhase, location = ball, metadata: { flight?: 'pass' | 'kick'; targetId?: string; h?: number } = {}) {
    const { x, y } = location;
    const entry = { second: at, phase, x: roundOne(x), y: roundOne(y), h: metadata.h, flight: metadata.flight, targetId: metadata.targetId, carrierId: metadata.flight ? undefined : carrier?.id, possessionId: team.club.id, homeDirection, homeScore, awayScore };
    if (timeline.at(-1)?.second === at) timeline[timeline.length - 1] = entry;
    else timeline.push(entry);
  }
  function record(at: number, type: EventType, involved: Team | undefined, description: string, player?: Player, points = 0, slot?: number, returnSecond?: number) {
    if (points && involved === home) homeScore += points;
    if (points && involved === away) awayScore += points;
    if (type === 'try' && involved === home) homeTries++;
    if (type === 'try' && involved === away) awayTries++;
    events.push({ second: at, minute: Math.min(80, Math.floor(at / 60) + 1), type, teamId: involved?.club.id, playerId: player?.id, description, homeScore, awayScore, x: roundOne(ball.x), y: roundOne(ball.y), points, slot, returnSecond });
  }
  function fly(at: number, duration: number, location: Ball, receiver: Player | undefined, flight: 'pass' | 'kick', nextTeam: Team, height: number, arrival: ReplayPhase = 'catch') {
    const metadata = { flight, targetId: receiver?.id };
    moment(at, flight, ball, metadata);
    moment(at + Math.floor(duration / 2), flight, { x: (ball.x + location.x) / 2, y: (ball.y + location.y) / 2 }, { ...metadata, h: height });
    ball = location;
    team = nextTeam;
    carrier = receiver;
    moment(at + duration, arrival);
  }
  function restart(at: number, receiving: Team) {
    team = other(receiving);
    carrier = atSlot(team, 9, at);
    ball = { x: 50, y: 35 };
    nextPhase = 'ruck';
    moment(at, 'restart');
    const catcher = actor(receiving, [3, 4, 5, 7, 14], at + 9);
    fly(at + 2, 7, { x: coord(receiving, 23 + rng() * 10), y: 19 + rng() * 32 }, catcher, 'kick', receiving, 13);
    aerialContest(at + 9, other(receiving), receiving, catcher, true);
  }
  function turnover(at: number, winner: Team, description: string) {
    team = winner;
    carrier = actor(winner, [5, 6, 7, 8], at);
    winner.analysis.turnoversWon++;
    record(at, 'turnover', winner, description, carrier);
    moment(at, 'ruck');
  }
  /**
   * A kick into the field is contested in the air: the receiver (Juego aéreo) against the best-placed chaser.
   * Clean catch, knock-on (scrum to the kicking side) or the kicking side wins it back. Restarts are short and
   * contested by the forwards, so they are won back more often than long kicks.
   */
  function aerialContest(at: number, kicking: Team, receiving: Team, receiver: Player | undefined, restartKick: boolean) {
    if (!receiver) return;
    const chaser = actor(kicking, restartKick ? jumpers : [10, 11, 12, 13, 14], at);
    const homeEdge = (side: Team) => side === home && !neutral ? HOME_EDGE : 0;
    const diff = attr(receiving, receiver, 'aerial', at) + homeEdge(receiving) - attr(kicking, chaser, 'aerial', at) - homeEdge(kicking);
    const roll = rng();
    const drop = clamp(TACTIC_TUNING.aerialDrop - diff * TACTIC_TUNING.aerialSlope, .01, .16);
    const regain = clamp((restartKick ? TACTIC_TUNING.restartRegain : TACTIC_TUNING.kickRegain) - diff * TACTIC_TUNING.aerialSlope, .01, .26);
    if (roll < drop) {
      record(at, 'knockOn', receiving, `${receiver.name} no puede con la pelota alta`, receiver);
      team = kicking;
      carrier = atSlot(kicking, 8, at);
      nextPhase = 'scrum';
      moment(at, 'scrum');
    } else if (roll < drop + regain) {
      carrier = chaser;
      record(at, 'turnover', kicking, `${chaser.name} gana la pelota en el aire`, chaser);
      kicking.analysis.turnoversWon++;
      team = kicking;
      nextPhase = 'ruck';
      moment(at, 'ruck');
    }
  }
  function kickerFor(side: Team): Player {
    return side.lineup.filter(player => activeAt(side, player, second)).reduce((best, player) => attr(side, player, 'goalKicking') > attr(side, best, 'goalKicking') ? player : best);
  }
  function goal(at: number, type: 'conversion' | 'penalty' | 'dropGoal', distance: number, margin: number) {
    const kicker = kickerFor(team);
    carrier = kicker;
    const skill = attr(team, kicker, 'goalKicking', at);
    const composure = attr(team, kicker, 'composure', at);
    const p = .82 + (skill - 13) * .034 + (composure - 11) * .012 - (distance - 23) * .009 - margin * .005 - (type === 'dropGoal' ? .31 : 0);
    const scored = chance(p, .07, .95);
    const label = type === 'conversion' ? (scored ? 'Conversión' : 'Conversión fallada') : type === 'penalty' ? (scored ? 'Penal' : 'Penal fallado') : (scored ? 'Drop' : 'Drop fallado');
    // Preserve the kick origin in the log and show points only after the ball reaches the posts.
    const origin = ball;
    const goalLine = coord(team, 100);
    fly(at, 6, { x: goalLine, y: scored ? 35 : margin < 11 ? 43 : 27 }, undefined, 'kick', team, 14, 'goal');
    record(at + 6, type, team, `${label} de ${kicker.name}`, kicker, scored ? (type === 'conversion' ? 2 : 3) : 0);
    events[events.length - 1].x = roundOne(origin.x);
    events[events.length - 1].y = roundOne(origin.y);
    moment(at + 6, 'goal');
    return scored;
  }
  function dropout(at: number, defender: Team) {
    team = defender;
    carrier = atSlot(defender, 9, at);
    ball = { x: coord(defender, 22), y: 35 };
    moment(at, 'restart');
    const receiver = other(defender);
    const catcher = actor(receiver, [3, 6, 7, 14], at + 10);
    fly(at + 2, 8, { x: coord(defender, 56 + rng() * 14), y: 18 + rng() * 34 }, catcher, 'kick', receiver, 13);
    nextPhase = 'ruck';
    aerialContest(at + 10, defender, receiver, catcher, true);
  }
  function touchKick(at: number, attack: Team, defence: Team, penalty: boolean) {
    const kicker = actor(attack, [8, 9, 9, 14], at);
    carrier = kicker;
    const kickSkill = attr(attack, kicker, 'kicking', at);
    const territorial = attack.tactics.kicking === 'Territorial';
    const aimTouch = penalty || (territorial && chance(.52 + (kickSkill - 12) * .032, .25, .74));
    const receiving = aimTouch && penalty ? attack : defence;
    const distance = (territorial ? TACTIC_TUNING.territorialKickDistance : TACTIC_TUNING.conservativeKickDistance) + (kickSkill - 11) * 1.45 + (rng() - .5) * 20;
    const mark = clamp(progress(attack) + distance, 4, 95);
    const location = { x: coord(attack, mark), y: aimTouch ? (ball.y > 35 ? 69 : 1) : 9 + rng() * 52 };
    const target = aimTouch ? undefined : actor(receiving, [10, 13, 14, 14], at + 9);
    record(at, 'kick', attack, aimTouch ? `${kicker.name} busca el touch` : `${kicker.name} juega al fondo`, kicker);
    fly(at, 9, location, target, 'kick', receiving, 16, aimTouch ? 'lineout' : 'catch');
    nextPhase = aimTouch ? 'lineout' : 'ruck';
    if (!aimTouch) aerialContest(at + 9, attack, receiving, target, false);
  }
  function scoreTry(at: number, scorer: Player) {
    const attack = team;
    ball = { x: coord(attack, 100), y: ball.y };
    record(at, 'try', attack, `Try de ${scorer.name}`, scorer, 5);
    moment(at, 'try');
    ball = { x: coord(attack, 76), y: ball.y };
    goal(at + 5, 'conversion', 24, Math.abs(ball.y - 35));
    restart(at + 15, attack);
  }
  function substitution(at: number, index: number) {
    const slot = [0, 3][index];
    for (const side of [home, away]) {
      const player = side.bench[index];
      if (!player || side.replacementStart.has(player.id) || !activeAt(side, side.lineup[slot], at)) continue;
      if (carrier?.id === side.lineup[slot].id) carrier = player;
      side.lineup[slot] = player;
      side.replacementStart.set(player.id, at);
      record(at, 'substitution', side, `Ingresa ${player.name} por ${side.club.players.find(p => p.id === side.startingIds[slot])?.name ?? 'su compañero'}`, player, 0, slot);
    }
  }

  function sanction(defence: Team, at: number) {
    // Keep this draw separate from the match sequence so an ordinary penalty has its prior outcomes.
    const cards = random(seed ^ hash(`${defence.club.id}/${at}/card`));
    const slots = allShirts.filter(slot => activeAt(defence, defence.lineup[slot], at));
    if (slots.length < 12) return;
    const slot = choose(slots, cards);
    const offender = defence.lineup[slot];
    const risk = clamp(.075 + (12 - attr(defence, offender, 'discipline', at)) * .009, .025, .16);
    const draw = cards();
    if (draw >= risk) return;
    const directRed = draw < risk * .075;
    const secondYellow = !directRed && events.some(e => e.type === 'yellowCard' && e.playerId === offender.id);
    const returnSecond = directRed || secondYellow ? undefined : Math.min(4800, at + 600);
    defence.suspendedUntil.set(offender.id, returnSecond ?? 4801);
    if (!directRed) record(at, 'yellowCard', defence, `${secondYellow ? 'Segunda amarilla' : 'Amarilla'} para ${offender.name}`, offender, 0, slot, returnSecond);
    if (directRed || secondYellow) record(at, 'redCard', defence, `${secondYellow ? 'Expulsión por doble amarilla' : 'Roja'} para ${offender.name}`, offender, 0, slot);
    moment(at, 'ruck');
  }

  restart(0, team);
  for (let half = 0; half < 2; half++) {
    const end = (half + 1) * 2400;
    second = half * 2400 + 11;
    while (second + 28 < end) {
      const duration = 26 + Math.floor(rng() * 19);
      if (second + Math.max(duration, 39) >= end) break;
      if (half === 1 && second >= 3600) substitution(second, 0);
      if (half === 1 && second >= 3960) substitution(second, 1);
      const attack = team, defence = other(team), t = attack.tactics, dt = defence.tactics;
      attack.analysis.phases++;
      if (progress(attack) > 50) attack.territorialPhases++;

      if (nextPhase === 'scrum' || nextPhase === 'lineout') {
        const phase = nextPhase;
        const scrum = phase === 'scrum';
        carrier = atSlot(attack, scrum ? 8 : 1);
        moment(second, phase);
        const skill = scrum ? scrumSkill : lineoutSkill;
        const contest = scrum ? dt.scrum === 'Presión' : dt.lineout === 'Competir';
        const conservative = scrum ? t.scrum === 'Estable' : t.lineout === 'Seguro';
        const advantage = edge(skill(attack, second) - skill(defence, second));
        const loss = chance((scrum ? .18 : .20) - advantage * (scrum ? .035 : .028) + (contest ? .078 : 0) - (conservative ? .035 : 0), .035, .68);
        const winner = loss ? defence : attack;
        const label = scrum ? 'scrum' : 'lineout';
        record(second + 9, phase, attack, loss ? `${defence.club.name} roba el ${label}` : `${attack.club.name} gana su ${label}`);
        if (loss) {
          turnover(second + 9, defence, `Recuperación en el ${label}`);
        } else if (!scrum && t.maul === 'Usar' && progress(attack) > 58) {
          carrier = actor(attack, jumpers, second + 9);
          ball = jog(0, ball.y < 35 ? 5 : -5);
          moment(second + 9, 'maul');
          const diff = maulSkill(attack, second) - maulSkill(defence, second);
          const gain = clamp(5 + diff * 1.4 + (rng() - .5) * 9 + (contest ? 2 : 0), 0, 14);
          if (chance(.11 - diff * .019, .03, .28)) {
            turnover(second + 14, defence, 'Maul detenido y recuperado');
          } else {
            ball = jog(direction(attack) * gain, 0);
            attack.analysis.metresGained += gain;
            if (progress(attack) >= 97) scoreTry(second + 14, carrier);
            else moment(second + 14, 'ruck');
          }
        } else {
          carrier = atSlot(winner, 8, second + 9);
          ball = jog(direction(winner) * (conservative ? 1 : 3) + (contest ? 3 : 0), scrum ? 0 : ball.y < 35 ? 6 : -6);
          moment(second + 9, 'catch');
        }
        nextPhase = 'ruck';
      } else {
        const territory = progress(attack);
        const tacticalKicking = t.kicking === 'Territorial';
        const offensive = t.mentality === 'Ofensiva', defensive = t.mentality === 'Defensiva';
        const defenceDiscipline = unit(defence, allShirts, { discipline: 3, decisions: 1 }, second);
        const rush = dt.defense === 'Rush';
        const penaltyChance = .095 + (11.5 - defenceDiscipline) * .013 + (rush ? TACTIC_TUNING.rushPenalty + Math.max(0, 11.5 - defenceDiscipline) * TACTIC_TUNING.rushPenaltyPerIndiscipline : 0);
        if (chance(penaltyChance, .035, .22)) {
          sanction(defence, second);
          const own = attack === home ? homeScore - awayScore : awayScore - homeScore, late = second > 3600;
          const choice = t.penalty ?? 'Según marcador';
          const takePoints = choice === 'Palos' ? territory > TACTIC_TUNING.postsFrom && chance(TACTIC_TUNING.postsChance, 0, 1)
            : choice === 'Touch' ? territory > 60 && territory < 80 && chance(TACTIC_TUNING.touchPointsChance, 0, 1)
            // Late on: behind by more than a converted try, kick to the corner; ahead or level, take the points.
            : late && own < -7 ? false
            : late && own >= 0 ? territory > TACTIC_TUNING.postsFrom
            : territory > 60 && (territory < 88 || t.maul === 'Evitar') && chance(.74 + (territory - 72) * .008, .55, .85);
          if (takePoints) {
            if (goal(second + 3, 'penalty', Math.hypot(100 - territory, (ball.y - 35) * .45), Math.abs(ball.y - 35))) restart(second + 15, attack);
            else dropout(second + 15, defence);
          } else {
            record(second, 'infringement', attack, `Penal a favor de ${attack.club.name}`);
            touchKick(second + 3, attack, defence, true);
          }
        } else if (territory < 67 && chance((territory < 36 ? .23 : .09) + (tacticalKicking ? TACTIC_TUNING.territorialKickChance : TACTIC_TUNING.conservativeKickChance) + (offensive ? TACTIC_TUNING.attackingKick : defensive ? TACTIC_TUNING.defensiveKick : 0), .035, .40)) {
          touchKick(second + 3, attack, defence, false);
        } else if (territory > 72 && second > 4440 && Math.abs(homeScore - awayScore) <= 3 && chance(.15, .15, .15)) {
          if (goal(second + 3, 'dropGoal', 100 - territory, Math.abs(ball.y - 35))) restart(second + 15, attack);
          else dropout(second + 15, defence);
        } else {
          const wide = chance((t.attack === '1-3-3-1' ? .55 : .30) + (offensive ? TACTIC_TUNING.attackingWide : defensive ? TACTIC_TUNING.defensiveWide : 0), 0, 1);
          const mentalityError = offensive ? TACTIC_TUNING.attackingError : defensive ? TACTIC_TUNING.defensiveError : 0;
          const mentalityBreak = offensive ? TACTIC_TUNING.attackingBreak : defensive ? TACTIC_TUNING.defensiveBreak : 0;
          const passer = carrier ?? atSlot(attack, 8);
          const runner = actor(attack, wide ? [9, 10, 11, 12, 13, 14] : pack);
          const tackler = actor(defence, wide ? backline : pack);
          const towardSpace = ball.y < 35 ? 1 : -1;
          const fast = t.ruck === 'Rápido';
          const coordination = rush ? unit(defence, wide ? backline : pack, { positioning: 2, decisions: 2, acceleration: 1 }, second) : 0;
          const pressure = rush ? clamp((coordination - 7) / 5, .2, 1.25) : 0;
          const passSkill = attr(attack, passer, 'passing') * .43 + attr(attack, runner, 'handling') * .36 + attr(attack, passer, 'decisions') * .21;
          const receiving = jog(-direction(attack) * (wide ? 3 : 1.3), towardSpace * (wide ? 10 + rng() * 13 : (rng() - .5) * 8));
          const passingError = chance(.073 + (11.5 - passSkill) * .010 + (wide ? .022 : 0) + pressure * TACTIC_TUNING.rushPressureError + (fast ? TACTIC_TUNING.fastPassError : 0) + mentalityError, .025, .26);
          carrier = passer;
          if (runner !== passer) fly(second + 2, 4, receiving, runner, 'pass', attack, 2.4);
          if (passingError) {
            record(second + 7, 'knockOn', attack, `Error de manejo de ${runner.name}`, runner);
            team = defence;
            carrier = atSlot(defence, 8, second + 7);
            nextPhase = 'scrum';
            moment(second + 7, 'scrum');
          } else {
            const attackSkill = wide
              ? attr(attack, runner, 'evasion') * .33 + attr(attack, runner, 'pace') * .26 + attr(attack, runner, 'acceleration') * .20 + attr(attack, passer, 'vision') * .21
              : attr(attack, runner, 'carrying') * .38 + attr(attack, runner, 'strength') * .29 + attr(attack, runner, 'technique') * .18 + attr(attack, runner, 'offload') * .15;
            const defenceSkill = attr(defence, tackler, 'tackling') * .48 + attr(defence, tackler, 'positioning') * .27 + attr(defence, tackler, 'decisions') * .15 + attr(defence, tackler, wide ? 'pace' : 'strength') * .10;
            const matchup = edge(attackSkill - defenceSkill);
            // Rush smothers ordinary gain but opens space behind the line if beaten wide.
            const breakChance = .14 + matchup * .019 + (wide ? .040 : 0) + (wide && rush ? TACTIC_TUNING.rushBreakBase + (1 - pressure) * TACTIC_TUNING.rushBreakOpen : 0) + (fast ? TACTIC_TUNING.fastBreak : 0) + mentalityBreak;
            const lineBreak = chance(breakChance, .025, .40);
            const congestion = territory > 85 ? (wide ? .2 : 1.1) : 0;
            const spaceBehind = wide && rush ? 6 + (1 - pressure) * 8 : 0;
            const gain = (lineBreak ? 13 + rng() * (wide ? 22 : 14) + spaceBehind : (wide ? 6.8 : 7.8) + (rng() - .5) * 9) + matchup * .55 + (fast ? TACTIC_TUNING.fastGain : 0) - pressure * TACTIC_TUNING.rushPressureGain - congestion;
            const physicalGain = clamp(gain, -5, 40);
            carrier = runner;
            moment(second + 7, 'carry');
            attack.analysis.metresGained += Math.max(0, Math.min(100 - progress(attack), physicalGain));
            const tryScored = progress(attack) + physicalGain >= 100;
            ball = jog(direction(attack) * physicalGain, (rng() - .5) * (wide ? 11 : 5));
            if (tryScored) {
              scoreTry(second + 13, runner);
            } else {
              moment(second + 13, 'tackle');
              const attackingSupport = unit(attack, [5, 6, 7, 8], { breakdown: 3, workRate: 1, strength: 1 }, second);
              const contest = unit(defence, [5, 6, 7], { breakdown: 3, workRate: 1, decisions: 1 }, second);
              const isolated = lineBreak && wide ? .045 : 0;
              const exposed = .15 + (contest - attackingSupport) * .021 + (fast ? TACTIC_TUNING.fastRuckExposure : 0) + isolated;
              if (chance(exposed, .035, .46)) turnover(second + 16, defence, `${defence.club.name} recupera en el ruck`);
              else moment(second + 16, 'ruck');
            }
          }
        }
      }
      second = Math.max(second + duration, timeline[timeline.length - 1].second + 2);
    }
    if (half === 0) {
      record(2400, 'halfTime', undefined, 'Entretiempo');
      moment(2400, 'halftime');
      homeDirection = -1;
      restart(2401, other(openingReceiver));
    }
  }
  record(4800, 'fullTime', undefined, 'Final del partido');
  moment(4800, 'fulltime');
  const homeLineup = [...home.startingIds, ...home.bench.map(p => p?.id ?? '')];
  const awayLineup = [...away.startingIds, ...away.bench.map(p => p?.id ?? '')];
  for (const side of [home, away]) {
    side.analysis.territory = Math.round(100 * side.territorialPhases / (side.analysis.phases || 1));
    side.analysis.metresGained = Math.round(side.analysis.metresGained);
  }
  const result: MatchResult = { homeId: homeClub.id, awayId: awayClub.id, homeScore, awayScore, homeTries, awayTries, seed, events, frames: [], homeTactics: { ...homeTactics }, awayTactics: { ...awayTactics }, timeline, homeLineup, awayLineup, cardEventsTracked: true, analysis: { home: home.analysis, away: away.analysis } };
  if (includeFrames) result.frames = buildFrames(homeClub, awayClub, result);
  return result;
}

const phases = ['restart', 'catch', 'pass', 'carry', 'tackle', 'ruck', 'maul', 'scrum', 'lineout', 'kick', 'try', 'goal', 'halftime', 'fulltime'] as const;
type ReplayPhase = typeof phases[number];
type PackedMoment = [number, number, number, number, number, number, number, number];
// The archived match already contains scores and lineups. Store geometry and phase as small numeric tuples.
function packTimeline(match: MatchResult): PackedMoment[] {
  const ids = [...match.homeLineup, ...match.awayLineup];
  return match.timeline.map(m => [
    m.second, Math.round(m.x * 10), Math.round(m.y * 10), Math.round((m.h ?? 0) * 10),
    phases.indexOf(m.phase!), ids.indexOf(m.carrierId ?? 'missing'), ids.indexOf(m.targetId ?? 'missing'),
    (m.possessionId === match.homeId ? 1 : 0) + (m.homeDirection === -1 ? 2 : 0),
  ]);
}
function unpackTimeline(match: MatchResult): ReplayMoment[] {
  const ids = [...match.homeLineup, ...match.awayLineup];
  let eventIndex = 0, homeScore = 0, awayScore = 0;
  return (match.replayTrack ?? []).map(([second, x, y, h, phaseIndex, carrierIndex, targetIndex, flags]) => {
    while (eventIndex < match.events.length && match.events[eventIndex].second <= second) {
      ({ homeScore, awayScore } = match.events[eventIndex++]);
    }
    const phase = phases[phaseIndex];
    const flight = phase === 'pass' || phase === 'kick' ? phase : undefined;
    return { second, x: x / 10, y: y / 10, h: h / 10 || undefined, phase, flight, carrierId: ids[carrierIndex], targetId: ids[targetIndex], possessionId: flags & 1 ? match.homeId : match.awayId, homeDirection: flags & 2 ? -1 : 1, homeScore, awayScore };
  });
}
function buildFrames(home: Club, away: Club, match: MatchResult): ReplayFrame[] {
  const track = match.timeline;
  const substitutions = match.events.filter(e => e.type === 'substitution');
  const cards = match.events.filter(e => e.type === 'yellowCard' || e.type === 'redCard');
  const oldReplay = !track[0]?.phase;
  const seconds = oldReplay ? [...new Set([...Array.from({ length: 241 }, (_, i) => i * 20), ...match.events.map(e => e.second)])].sort((a, b) => a - b) : track.map(m => m.second);
  let momentIndex = 0, eventIndex = 0, homeScore = 0, awayScore = 0;
  return seconds.map(second => {
    while (momentIndex + 1 < track.length && track[momentIndex + 1].second <= second) momentIndex++;
    while (eventIndex < match.events.length && match.events[eventIndex].second <= second) {
      ({ homeScore, awayScore } = match.events[eventIndex++]);
    }
    const m = track[momentIndex], next = track[Math.min(momentIndex + 1, track.length - 1)];
    const fraction = oldReplay && next.second > m.second ? (second - m.second) / (next.second - m.second) : 0;
    const bx = m.x + (next.x - m.x) * fraction, by = m.y + (next.y - m.y) * fraction;
    const players: ReplayPlayer[] = [];
    for (const side of [home, away]) {
      const isHome = side.id === home.id;
      const attacking = side.id === m.possessionId;
      const dir = (isHome ? 1 : -1) * (m.homeDirection ?? 1);
      const lineup = (isHome ? match.homeLineup : match.awayLineup).slice(0, 15);
      const tactics = isHome ? match.homeTactics : match.awayTactics;
      for (const sub of substitutions) {
        if (sub.second > second || sub.teamId !== side.id || !sub.playerId) continue;
        const slot = sub.slot ?? (sub.second < 3900 ? 0 : 1);
        lineup[slot] = sub.playerId;
      }
      for (let i = 0; i < 15; i++) {
        const id = lineup[i];
        if (cards.some(e => e.playerId === id && e.second <= second && second < (e.returnSecond ?? 4801))) continue;
        const isCarrier = id === m.carrierId;
        const isTarget = id === m.targetId;
        const forward = i < 8;
        const setPiece = m.phase === 'scrum' || m.phase === 'maul' || m.phase === 'ruck' || m.phase === 'tackle';
        const lineout = m.phase === 'lineout';
        const row = forward ? 0 : i < 10 ? 1 : 2;
        let dx = -dir * (attacking ? 3 + row * 3.5 : 5 + row * 3.5);
        let spread = forward ? (i - 3.5) * (tactics.attack === '1-3-3-1' ? 4.3 : 3.1) : (i - 11) * 8;
        if (setPiece && forward) {
          dx = -dir * (1 + Math.floor(i / 3) * 1.45);
          spread = (i % 3 - 1) * 1.65;
        }
        if (lineout && forward) {
          dx = -dir * 2.1;
          spread = (by < 35 ? 1 : -1) * (4.5 + i * 2.4);
        }
        if (m.phase === 'restart') {
          dx = -dir * (attacking ? 3 + row * 3 : 13 + row * 8);
          spread = (i - 7) * 4.1;
        }
        // Backs at a breakdown (cosmetic, replay only): the attack forms a deep diagonal line out to the open side,
        // the defence a flat line facing it, wings wide and the full-back deep. Forwards not in the ruck fan out as pods.
        const openSide = by < 35 ? 1 : -1;
        if ((m.phase === 'ruck' || m.phase === 'tackle' || m.phase === 'carry' || m.phase === 'pass' || m.phase === 'catch') && !forward) {
          const order = [0, 1, 4, 2, 3, 4, 5][i - 8], wing = i === 10 || i === 13, fullback = i === 14;
          const k = wing ? 5 : fullback ? 3 : order;
          const side = wing ? (i === 10 ? openSide : -openSide) : openSide;
          dx = attacking ? -dir * (1.5 + k * 1.9) : -dir * 1.8;
          spread = side * (wing ? 27 : 2.5 + k * 6.2);
          if (fullback) { dx = -dir * (attacking ? 11 : 17); spread = openSide * 6; }
          if (i === 8 && attacking) { dx = -dir * 1.2; spread = openSide * 1.5; }
        }
        if ((m.phase === 'ruck' || m.phase === 'tackle') && forward && i >= 3 && i !== 7 && (attacking ? i % 2 === 0 : i % 3 === 0)) {
          dx = -dir * (attacking ? 3.5 : 1.6); spread = (i % 4 < 2 ? openSide : -openSide) * (6 + (i % 3) * 4);
        }
        if (!attacking && tactics.defense === 'Rush' && !setPiece) dx += dir * 2;
        const offset = Math.sin(second / 23 + i * 2) * .65;
        let x = isCarrier ? bx : isTarget ? next.x : bx + dx + offset;
        let y = isCarrier ? by : isTarget ? next.y : by + spread;
        players.push({ id, teamId: side.id, number: i + 1, x: clamp(x, 0, 100), y: clamp(y, 0, 70) });
      }
    }
    const ballX = m.phase === 'try' && !oldReplay ? (bx < 50 ? 4 : 96) : bx;
    if (m.phase === 'try' && !oldReplay) for (const p of players) if (p.id === m.carrierId) p.x = ballX;
    return { second, players, ball: { x: ballX, y: by, h: m.h ?? 0 }, homeScore, awayScore, possessionId: m.possessionId, phase: m.phase, carrierId: m.carrierId, targetId: m.targetId, flight: m.flight, homeDirection: m.homeDirection };
  });
}

export function simulateFixture(state:LeagueState, fixtureId:string, tacticsByClub:Record<string,Tactics>={}):LeagueState {
  const fixture=state.fixtures.find(f=>f.id===fixtureId); if(!fixture) throw new Error('Partido no encontrado'); if(fixture.match) return state;
  const home=state.clubs.find(c=>c.id===fixture.homeId), away=state.clubs.find(c=>c.id===fixture.awayId); if(!home||!away) throw new Error('Club no encontrado');
  const fullMatch=generateMatch(home,away,tacticsByClub[home.id]??state.tactics[home.id],tacticsByClub[away.id]??state.tactics[away.id],state.seed^hash(fixture.id)^hash(String(state.season)),false,fixture.neutral===true);
  const match={...fullMatch,timeline:[],replayTrack:packTimeline(fullMatch)};
  const played=new Set([...match.homeLineup.slice(0,15),...match.awayLineup.slice(0,15)]);
  const benches=new Set([match.homeLineup[15],match.homeLineup[16],match.awayLineup[15],match.awayLineup[16]]);
  // A match costs 12 points (a replacement 4); the seven days until the next round recover 60 % of the deficit.
  // A starter every week settles around 92 %: rotation helps, but a full week of rest is not a collapse.
  const weekly=(f:number,loss:number)=>clamp(Math.round(100-.4*(100-f+loss)),35,100);
  const clubs=state.clubs.map(c=>c.id!==home.id&&c.id!==away.id?c:{...c,players:c.players.map(p=>({...p,fitness:weekly(p.fitness,played.has(p.id)?12:benches.has(p.id)?4:0)}))});
  return {...state,clubs,fixtures:state.fixtures.map(f=>f.id===fixtureId?{...f,match}:f)};
}
export function autoPlayRound(state:LeagueState):LeagueState {const next=state.fixtures.filter(f=>!f.match).reduce((n,f)=>Math.min(n,f.round),Infinity);return state.fixtures.filter(f=>f.round===next&&!f.match).reduce((s,f)=>simulateFixture(s,f.id),state);}
export function getStandings(state:LeagueState, division:Division):Standing[] {
  const rows=state.clubs.filter(c=>c.division===division).map(c=>({clubId:c.id,played:0,won:0,drawn:0,lost:0,pointsFor:0,pointsAgainst:0,tries:0,bonus:0,points:0}));
  const byId=Object.fromEntries(rows.map(r=>[r.clubId,r]));
  for(const f of state.fixtures.filter(f=>f.division===division&&f.match&&!f.stage)){const m=f.match!;const h=byId[f.homeId],a=byId[f.awayId];if(!h||!a)continue;h.played++;a.played++;h.pointsFor+=m.homeScore;h.pointsAgainst+=m.awayScore;a.pointsFor+=m.awayScore;a.pointsAgainst+=m.homeScore;h.tries+=m.homeTries;a.tries+=m.awayTries;
    if(m.homeScore>m.awayScore){h.won++;a.lost++;h.points+=4;} else if(m.awayScore>m.homeScore){a.won++;h.lost++;a.points+=4;} else {h.drawn++;a.drawn++;h.points+=2;a.points+=2;}
    for(const [row,tries,opponentTries,score,opponentScore] of [[h,m.homeTries,m.awayTries,m.homeScore,m.awayScore],[a,m.awayTries,m.homeTries,m.awayScore,m.homeScore]] as [Standing,number,number,number,number][]){const bonus=(tries>=opponentTries+3?1:0)+(score<opponentScore&&opponentScore-score<=7?1:0);row.bonus+=bonus;row.points+=bonus;}
  }
  return rows.sort((a,b)=>b.points-a.points||(b.pointsFor-b.pointsAgainst)-(a.pointsFor-a.pointsAgainst)||b.pointsFor-a.pointsFor||a.clubId.localeCompare(b.clubId));
}

/** Rebuild replay frames from the match seed and the tactics used when it was played. */
export function regenerateReplay(state:LeagueState, fixtureId:string):MatchResult {
  const fixture=state.fixtures.find(f=>f.id===fixtureId); if(!fixture?.match) throw new Error('El partido todavía no se jugó');
  const home=state.clubs.find(c=>c.id===fixture.homeId),away=state.clubs.find(c=>c.id===fixture.awayId);
  if(!home||!away) throw new Error('Club no encontrado');
  const { replayTrack, ...saved } = fixture.match;
  const match = { ...saved, timeline: replayTrack ? unpackTimeline(fixture.match) : saved.timeline };
  return { ...match, frames: buildFrames(home, away, match) };
}
export function trainPlayer(state: LeagueState, clubId: string, playerId: string, attribute: Attribute, evidence?: DevelopmentEvidence): LeagueState {
  if (!attributes.includes(attribute)) throw new Error('Atributo inválido');
  const club = state.clubs.find(c => c.id === clubId), player = club?.players.find(p => p.id === playerId);
  if (!player) throw new Error('Jugador no encontrado');
  if (!canDevelopAttribute(player, attribute, state.season)) return state;
  const round = state.fixtures.filter(f => !f.match && (f.homeId === clubId || f.awayId === clubId)).reduce((n, f) => Math.min(n, f.round), Infinity);
  if (!Number.isFinite(round)) throw new Error('No quedan fechas de entrenamiento esta temporada');
  if (state.trainingRounds?.[clubId] === round) throw new Error('El club ya entrenó en esta fecha');
  const trained = developPlayer(player, attribute, { seed: state.seed, season: state.season, round, evidence, mode: 'individual' });
  return {
    ...state,
    trainingRounds: { ...state.trainingRounds, [clubId]: round },
    clubs: state.clubs.map(c => c.id === clubId ? { ...c, players: c.players.map(p => p.id === playerId ? trained : p) } : c),
  };
}
export function setTactics(state:LeagueState, clubId:string, tactics:Tactics):LeagueState {
  if(!state.clubs.some(c=>c.id===clubId)) throw new Error('Club no encontrado');
  return {...state,tactics:{...state.tactics,[clubId]:{...tactics}}};
}

/** Sets the starting fifteen in shirt order, checking eligible players and positions. */
export function setLineup(state:LeagueState, clubId:string, playerIds:string[]):LeagueState {
  const club=state.clubs.find(c=>c.id===clubId); if(!club) throw new Error('Club no encontrado');
  if(playerIds.length!==15||new Set(playerIds).size!==15) throw new Error('La formación debe tener 15 jugadores distintos');
  for(let i=0;i<15;i++) { const p=club.players.find(p=>p.id===playerIds[i]); if(!p||p.squad!=='Plantel superior'||!canPlay(p,POSITIONS[i])||!available(p)) throw new Error(`Jugador no elegible para la posición ${i+1}`); }
  return {...state,clubs:state.clubs.map(c=>c.id===clubId?{...c,lineup:[...playerIds]}:c)};
}
function advanceAcademyPlayer(player: Player, clubId: string): Player {
  const age = player.age == null ? null : player.age + 1;
  if (player.squad === 'Plantel superior') return { ...player, age };
  const youthSeasons = (player.youthSeasons ?? 0) + 1;
  const threshold = player.squad === 'M17' ? 18 : 20;
  const graduate = age === null ? youthSeasons >= 2 : age >= threshold;
  const squad = graduate ? player.squad === 'M17' ? 'M19' : 'Plantel superior' : player.squad;
  return {
    ...player,
    age,
    squad,
    academyClubId: player.academyClubId ?? clubId,
    youthSeasons: graduate ? 0 : youthSeasons,
    seniorSquad: squad === 'Plantel superior' ? 'Pre B' : undefined,
  };
}
function uncoveredPositions(players: Player[], squad: Squad): number[] {
  const remaining = players.filter(p => p.squad === squad);
  return POSITIONS.flatMap((position, index) => {
    const playerIndex = remaining.findIndex(p => p.position === position);
    if (playerIndex === -1) return [index];
    remaining.splice(playerIndex, 1);
    return [];
  });
}
/**
 * Every M17 class has its own level (12/11/2026): a normal spread of about ±2 rating points around what the club
 * promises, and now and then a golden class (+5) or a weak one (-4). Bigger clubs get golden classes more often and
 * weak ones less (their base is already higher, since it follows the club strength). Deterministic per club and season.
 */
export const COHORT_LABELS = ['Floja', 'Normal', 'Buena', 'Muy buena', 'Dorada'] as const;
export function cohortLevel(club: Pick<Club, 'id' | 'strength'>, season: number, seed: number): { offset: number; label: typeof COHORT_LABELS[number] } {
  const rng = random(seed ^ hash(`${club.id}/${season}/cohort`));
  const size = clamp((club.strength - 10) / 2.5, -1.2, 1.2);
  const golden = clamp(.07 + .05 * size, .02, .14), weak = clamp(.07 - .04 * size, .02, .12);
  const roll = rng(), spread = (rng() + rng() + rng() - 1.5) * .7;
  const offset = roll < golden ? 1 + spread * .3 : roll > 1 - weak ? -.8 + spread * .3 : spread;
  const label = offset >= .85 ? 'Dorada' : offset >= .4 ? 'Muy buena' : offset >= .15 ? 'Buena' : offset > -.4 ? 'Normal' : 'Floja';
  return { offset, label };
}
/**
 * A club without a manager fills a hole in its XV between seasons: a player of its level arrives (from another club,
 * back from abroad or from its lower teams). Deterministic per club, season and position.
 */
export function replacementPlayer(club: Club, positionIndex: number, season: number, seed: number, names?: NameWeights): Player {
  const rng = random(seed ^ hash(`${club.id}/${season}/replacement/${positionIndex}`));
  // index + 15: the Intermedia tier, a notch below a Primera starter, so a hole is filled without lifting the club.
  const p = makePlayer(club.id, positionIndex + 15, club.strength, rng, 'Plantel superior', names);
  const taken = new Set(club.players.map(q => slug(q.name)));
  let name = p.name;
  for (const firstName of firstNames) { if (!taken.has(slug(name))) break; name = `${firstName} ${p.name.split(' ').slice(1).join(' ')}`; }
  return { ...p, id: `${club.id}-arrival-${season}-${positionIndex}`, name, age: 22 + Math.floor(rng() * 7), seniorSquad: 'Primera' };
}
/** Club strength implied by the current XV: the strength whose promised XV matches it. */
export function impliedStrength(club: Club): number {
  const xv = selection(club).slice(0, 15), actual = xv.reduce((n, p) => n + overall(p), 0) / Math.max(1, xv.length);
  const promised = (strength: number) => POSITIONS.reduce((n, position) => n + expectedOverall(position, strength + seniorSquadAdjustment('Primera')), 0) / 15;
  let lo = 2, hi = 20;
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (promised(mid) < actual) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function addAcademyIntake(club: Club, season: number, seed: number, names?: NameWeights, coverM19 = true): Player[] {
  const players = [...club.players];
  const existingIds = new Set(players.map(p => p.id));
  const existingNames = new Set(players.map(p => slug(p.name)));
  const intakeNames = new Set<string>();
  const rng = random(seed ^ hash(`${club.id}/${season}/academy`));
  const cohort = cohortLevel(club, season, seed);
  function add(index: number, squad: 'M17' | 'M19') {
    const entry = squad === 'M17' ? 'intake' : 'cover';
    const id = `${club.id}-academy-${season}-${squad.toLowerCase()}-${entry}-${index}`;
    if (existingIds.has(id)) return;
    const p = makePlayer(club.id, index, club.strength + (squad === 'M17' ? cohort.offset : 0), rng, squad, names, intakeNames);
    let name = p.name;
    for (const firstName of firstNames) {
      if (!existingNames.has(slug(name))) break;
      name = `${firstName} ${p.name.split(' ').slice(1).join(' ')}`;
    }
    if (existingNames.has(slug(name))) name = `${name} ${index + 1}`;
    existingIds.add(id);
    existingNames.add(slug(name));
    players.push({ ...p, id, name, age: squad === 'M17' ? 16 : 19, academyIntakeSeason: season, academyEntry: entry, youthSeasons: 0, ...(squad === 'M17' ? { academyCohort: cohort.label } : {}) } as Player);
  }
  // Each incoming class has a full XV; older M17 players stay until they graduate.
  for (let index = 0; index < POSITIONS.length; index++) add(index, 'M17');
  if (coverM19) {
    for (const index of uncoveredPositions(players, 'M19')) add(index, 'M19');
  }
  return players;
}

/** Complete current-season intakes made under the eight-player rule without changing older cohorts. */
export function completeCurrentAcademyIntake(state: LeagueState): LeagueState {
  const clubs = state.clubs.map(club => {
    const intake = club.players.filter(p => p.academyEntry === 'intake' && p.academyIntakeSeason === state.season);
    if (intake.length === 0 || intake.length >= POSITIONS.length) return club;
    const players = addAcademyIntake(club, state.season, state.seed, state.nameWeights, false);
    return players.length === club.players.length ? club : { ...club, players };
  });
  return clubs.some((club, index) => club !== state.clubs[index]) ? { ...state, clubs } : state;
}

const destinations = [
  { country: 'Francia', competition: 'Segunda división profesional' },
  { country: 'Italia', competition: 'Primera división' },
  { country: 'España', competition: 'Primera división' },
];
function updateOverseasCareer(career: OverseasCareer, season: number, seed: number): OverseasCareer {
  if (career.status !== 'abroad') return career;
  const age = career.player.age == null ? null : career.player.age + 1;
  if (age != null && age > 38) return { ...career, player: { ...career.player, age }, status: 'retired' };
  let player = { ...career.player, age };
  if (age != null && age <= 27) {
    const rng = random(seed ^ hash(`${career.player.id}/${season}/abroad-training`));
    const relevant = attributes.filter(a => ratingWeights[player.position][a]);
    for (let session = 0; session < 4; session++) {
      const attribute = relevant[Math.floor(rng() * relevant.length)];
      player = developPlayer(player, attribute, { seed, season, round: session + 1, mode: 'senior' });
    }
  } else if (age != null && age >= 33) {
    const attrs = { ...player.attributes };
    for (const key of ['pace', 'acceleration', 'stamina'] as const) attrs[key] = Math.max(1, attrs[key] - 1);
    player = { ...player, attributes: attrs };
  }
  return { ...career, player };
}
function overseasMove(club: Club, state: LeagueState, previouslyAbroad: Set<string>, evidenceFor?: (playerId: string) => DevelopmentEvidence | undefined): OverseasCareer | undefined {
  const target = { 'Top 14': 73, 'Primera A': 75, 'Primera B': 77 }[club.division];
  const eligible = club.players.filter(p => {
    if (p.squad !== 'Plantel superior' || p.age == null || p.age < 19 || p.age > 26 || p.injury || previouslyAbroad.has(p.id) || overall(p) < target) return false;
    if (club.players.filter(q => q.id !== p.id && q.squad === 'Plantel superior' && canPlay(q, p.position)).length < 3) return false;
    const evidence = evidenceFor?.(p.id);
    return Boolean(evidence && evidence.minutes >= 1050 && evidence.starts >= 10);
  }).sort((a, b) => overall(b) - overall(a) || a.id.localeCompare(b.id));
  for (const player of eligible) {
    const evidence = evidenceFor?.(player.id)!;
    const rng = random(state.seed ^ hash(`${player.id}/${state.season}/abroad`));
    const probability = clamp(.10 + (overall(player) - target) * .025 + (evidence.minutes - 1050) / 7500 + scoringEvidence(player, evidence) * .045, .10, .38);
    if (rng() >= probability) continue;
    const originClubId = player.academyClubId ?? club.id;
    return {
      player: { ...player, academyClubId: originClubId, development: developmentState(player), injury: null, fitness: 100 },
      originClubId,
      fromClubId: club.id,
      departedSeason: state.season + 1,
      destination: destinations[Math.floor(rng() * destinations.length)],
      status: 'abroad',
    };
  }
  return undefined;
}

/** Begins a new season after all fixtures are played; existing identities keep their ratings and history. */
export function advanceSeason(state: LeagueState, evidenceFor?: (playerId: string) => DevelopmentEvidence | undefined): LeagueState {
  if (state.fixtures.some(f => !f.match)) throw new Error('Todavía hay partidos pendientes');
  const season = state.season + 1;
  const divisions: Record<string, Division> = { ...((state as any).nextDivisions ?? {}) };
  if (!(state as any).nextDivisions) {
    const top = getStandings(state, 'Top 14'), a = getStandings(state, 'Primera A'), b = getStandings(state, 'Primera B');
    for (const row of top.slice(-2)) divisions[row.clubId] = 'Primera A';
    for (const row of a.slice(0, 2)) divisions[row.clubId] = 'Top 14';
    for (const row of a.slice(-2)) divisions[row.clubId] = 'Primera B';
    for (const row of b.slice(0, 2)) divisions[row.clubId] = 'Primera A';
  }
  const overseasCareers = (state.overseasCareers ?? []).map(c => updateOverseasCareer(c, season, state.seed));
  const abroadIds = new Set(overseasCareers.map(c => c.player.id));
  const news: CareerNews[] = [];
  const clubs = state.clubs.map(club => {
    let players = club.players.map(p => advanceAcademyPlayer(reviewDevelopment(p, evidenceFor?.(p.id), state.season, state.seed), club.id));
    const career = overseasMove({ ...club, players }, state, abroadIds, evidenceFor);
    if (career) {
      overseasCareers.push(career);
      abroadIds.add(career.player.id);
      players = players.filter(p => p.id !== career.player.id);
      news.push({ round: 0, season, clubId: club.id, kind: 'squad', playerId: career.player.id, text: `${career.player.name} se incorporó al rugby de ${career.destination.country} en la partida.` });
    }
    const next = { ...club, division: divisions[club.id] ?? club.division, players, lineup: career && club.lineup?.includes(career.player.id) ? undefined : club.lineup };
    next.players = addAcademyIntake(next, season, state.seed, state.nameWeights);
    return next;
  });
  return {
    ...state, season, clubs, overseasCareers, fixtures: createFixtures(clubs), trainingRounds: {},
    news: [...(state.news ?? []), ...news].slice(-2000),
    returnCandidates: createReturnCandidates(clubs, state.seed, season, state.returnRecords, state.returnObservedAt, overseasCareers),
  };
}

export interface ReturnRecord {
  id: string;
  name: string;
  birthDate: string | null;
  position: string;
  originClubId: string | null;
  currentClub: string | null;
  currentCountry: string | null;
  status: string;
  eligibleForGameMarket: boolean;
  observedAt?: string;
  sourceIds: string[];
}

// Editorial game estimates at the catalog date. These model established international
// players, club professionals and developing players separately on the same rating scale.
const overseasRatings: Record<string, number> = {
  'julian-montoya': 86, 'pablo-matera': 86, 'jeronimo-de-la-fuente': 76, 'rodrigo-isgro': 82,
  'bautista-delguy': 82, 'matias-moroni': 76, 'mayco-vivas': 81, 'boris-wenger': 78,
  'bautista-bernasconi': 79, 'facundo-bosch': 79, 'leonel-oviedo': 80, 'francisco-moreno': 77,
  'tomas-rapetti': 76, 'joel-sclavi': 84, 'efrain-elias': 80, 'guido-petti': 86,
  'tomas-lavanini': 81, 'pedro-rubiolo': 85, 'juan-martin-gonzalez': 87, 'marcos-kremer': 87,
  'facundo-isa': 85, 'joaquin-moro': 79, 'juan-martin-scelzo': 78, 'simon-benitez-cruz': 82,
  'gonzalo-garcia': 83, 'agustin-moyano': 77, 'tomas-albornoz': 87, 'geronimo-prisciantelli': 81,
  'santiago-chocobares': 87, 'lucio-cinti': 85, 'justo-piccardo': 80, 'mateo-carreras': 85,
  'ignacio-mendy': 81, 'juan-cruz-mallia': 87, 'santiago-carreras': 86, 'thomas-gallo': 83,
  'benjamin-elizalde': 74, 'ignacio-ruiz': 78, 'santiago-grondona': 81, 'benjamin-grondona': 73,
  'matias-medrano': 76, 'tobias-wade': 78, 'santiago-medrano': 79, 'franco-molina': 81,
};

function ageOnDate(birthDate: string | null, date: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > date) return null;
  const born = new Date(birthDate + 'T00:00:00Z');
  if (!Number.isFinite(born.getTime()) || born.toISOString().slice(0, 10) !== birthDate) return null;
  return Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - Number(date.slice(5) < birthDate.slice(5));
}
export function projectedReturnPlayer(record: ReturnRecord, season: number, observedAt: string): Player | undefined {
  const position = (record.position === 'Tercera línea' ? 'Ala' : record.position === 'Octavo' ? 'Número 8' : record.position) as Position;
  if (!POSITIONS.includes(position)) return undefined;
  const referenceAge = ageOnDate(record.birthDate, observedAt);
  const years = Math.max(0, season - Number(observedAt.slice(0, 4)));
  const age = referenceAge === null ? null : referenceAge + years;
  const decline = age === null || referenceAge === null ? 0 : (Math.max(0, age - 32) - Math.max(0, referenceAge - 32)) * 1.8;
  const development = age === null || referenceAge === null ? 0 : Math.max(0, Math.min(age, 27) - referenceAge) * .85;
  // The table rates the career level; past 30 a player is no longer at his peak (Julián Montoya, 33: 86 → 82).
  const peakLoss = referenceAge === null ? 0 : Math.max(0, referenceAge - 30) * 1.5;
  const target = clamp(Math.round((overseasRatings[record.id] ?? 74 + hash(record.id) % 6) - peakLoss + development - decline), 62, 91);
  const base = target * .19;
  let low = base - 3, high = base + 3;
  let attrs = createPlayerAttributes(position, base, record.id);
  for (let i = 0; i < 12; i++) {
    const middle = (low + high) / 2;
    const probe = createPlayerAttributes(position, middle, record.id);
    const difference = target - overall({ position, attributes: probe });
    if (Math.abs(difference) < Math.abs(target - overall({ position, attributes: attrs }))) attrs = probe;
    if (difference === 0) break;
    if (difference > 0) low = middle;
    else high = middle;
  }
  return {
    id: `prospect-${record.id}`, name: record.name, age, ageKnown: age !== null, birthDate: record.birthDate ?? undefined, position,
    squad: 'Plantel superior', seniorSquad: 'Primera', attributes: attrs, potential: Math.max(...Object.values(attrs)),
    fitness: 100, fictional: false, estimated: true, sourceRecordId: record.id, sourceIds: record.sourceIds,
  };
}

export function createReturnCandidates(clubs: Club[], seed: number, season: number, records: ReturnRecord[] = [], observedAt = '2026-11-10', overseasCareers: OverseasCareer[] = []): ReturnCandidate[] {
  const candidates: ReturnCandidate[] = [];
  const existing = new Set([
    ...clubs.flatMap(c => c.players.flatMap(p => p.fictional ? [] : [p.id, p.sourceRecordId])),
    ...overseasCareers.flatMap(c => [c.player.id, c.player.sourceRecordId]),
  ]);
  for (const record of records) {
    if (!record.originClubId || !clubs.some(c => c.id === record.originClubId) || !record.eligibleForGameMarket || record.status !== 'exterior') continue;
    if (!record.currentClub || !record.currentCountry || record.currentCountry === 'Argentina' || !record.sourceIds.length || existing.has(record.id) || existing.has(`prospect-${record.id}`)) continue;
    const player = projectedReturnPlayer(record, season, observedAt);
    if (!player || (player.age !== null && player.age > 38)) continue;
    const skill = overall(player);
    const rng = random(seed ^ hash(record.id) ^ hash(String(season)));
    const age = player.age;
    const contactable = age !== null && age >= (skill >= 82 ? 31 : 29) && skill >= 65;
    // Verified home-club attachment is a prerequisite. Age and declining overseas level raise
    // willingness, but the roll stays below certainty at every age.
    const willingness = age === null ? null : clamp(Math.round(12 + (age - 29) * 8 + (81 - skill) * 2 + rng() * 9), 3, 74);
    const note = age === null ? 'Edad sin fecha verificada; en observación.' : contactable ? 'Se puede sondear su predisposición simulada.' : 'En seguimiento. La etapa de carrera y el nivel proyectado limitan el contacto.';
    candidates.push({ origin: 'documented', id: player.id, homeClubId: record.originClubId, player, status: 'monitoring', note, willingness, contactable });
    existing.add(record.id);
  }
  for (const career of overseasCareers) {
    const { player, originClubId } = career;
    const age = player.age;
    if (career.status !== 'abroad' || age == null || age > 38 || !clubs.some(c => c.id === originClubId)) continue;
    const contactable = age >= 34 && overall(player) >= 58;
    const id = `in-game-return-${player.id}`;
    const rng = random(seed ^ hash(`${id}/${season}`));
    const willingness = clamp(Math.round(19 + (age - 34) * 9 + (75 - overall(player)) * 1.4 + rng() * 10), 3, 74);
    const note = contactable ? 'Puede evaluar un regreso al club donde se formó.' : 'Trayectoria simulada en el exterior. Todavía no considera un regreso.';
    candidates.push({ origin: 'simulated', id, homeClubId: originClubId, player, status: 'monitoring', note, willingness, contactable });
  }
  return candidates;
}

function candidateFor(state: LeagueState, clubId: string, candidateId: string): ReturnCandidate {
  const candidate = state.returnCandidates?.find(c => c.id === candidateId && c.homeClubId === clubId);
  if (!candidate) throw new Error('Regreso no disponible para este club');
  if (candidate.origin === 'simulated') {
    const career = state.overseasCareers?.find(c => c.player.id === candidate.player.id);
    if (!career || career.status !== 'abroad' || career.originClubId !== clubId) throw new Error('Regreso no disponible para este club');
  } else {
    const record = state.returnRecords?.find(r => r.id === candidate.player.sourceRecordId);
    if (candidate.player.fictional || !record?.eligibleForGameMarket || record.status !== 'exterior' || record.originClubId !== clubId) throw new Error('Regreso no disponible para este club');
  }
  return candidate;
}
export function contactReturn(state: LeagueState, clubId: string, candidateId: string): LeagueState {
  const candidate = candidateFor(state, clubId, candidateId);
  const round = state.fixtures.filter(f => !f.match && (f.homeId === clubId || f.awayId === clubId)).reduce((n, f) => Math.min(n, f.round), Infinity);
  if (!Number.isFinite(round)) throw new Error('No quedan fechas de contacto esta temporada');
  if (state.returnCandidates?.some(c => c.homeClubId === clubId && c.lastContactRound === round)) throw new Error('El club ya realizó un contacto en esta fecha');
  if (candidate.status !== 'monitoring' || !candidate.contactable || candidate.willingness === null) throw new Error('Este jugador todavía no está disponible para un contacto');
  const seasonKey = `${state.season}/${clubId}/${candidateId}`;
  // A club can call again next round, but it cannot reroll a player's simulated annual plans.
  const seasonAvailability = random(state.seed ^ hash(seasonKey))() * 100 < candidate.willingness;
  const timelyContact = random(state.seed ^ hash(`${seasonKey}/${round}`))() < .68;
  const ready = seasonAvailability && timelyContact;
  const updated: ReturnCandidate = { ...candidate, lastContactRound: round, status: ready ? 'ready' : 'monitoring', note: ready ? 'Aceptó evaluar el regreso en la simulación.' : 'Prefiere seguir en el exterior por ahora, en la simulación.' };
  return { ...state, returnCandidates: state.returnCandidates!.map(c => c.id === candidateId ? updated : c) };
}
export function signReturn(state: LeagueState, clubId: string, candidateId: string): LeagueState {
  const candidate = candidateFor(state, clubId, candidateId);
  if (candidate.status !== 'ready' || !candidate.contactable) throw new Error('Primero debe aceptar el contacto');
  const club = state.clubs.find(c => c.id === clubId);
  if (!club || state.clubs.some(c => c.players.some(p => p.id === candidate.player.id || (candidate.player.sourceRecordId && p.sourceRecordId === candidate.player.sourceRecordId)))) throw new Error('Jugador ya incorporado o club no encontrado');
  return {
    ...state,
    clubs: state.clubs.map(c => c.id === clubId ? { ...c, players: [...c.players, { ...candidate.player, academyClubId: clubId }] } : c),
    overseasCareers: candidate.origin === 'simulated' ? state.overseasCareers?.map(c => c.player.id === candidate.player.id ? { ...c, status: 'returned', returnedSeason: state.season } : c) : state.overseasCareers,
    returnCandidates: state.returnCandidates!.map(c => c.id === candidateId ? { ...c, status: 'signed' } : c),
  };
}
