import * as engine from './engine.js';
import { playerCareerStats } from './player-stats.js';
import { DIVISIONS, initialWorld, roundOf, applyClubAction, advanceWorld, advanceSeasonWorld, overall, ageOnDate, enrichRosterIdentities, trajectoryLabel as stageLabel, PARALLEL_CATEGORIES, parallelStandings, playoffState, PLAYOFF_RULES, applyCommunity, clubObjective, marketPlayers, transferInterest, TRAINING_FATIGUE, playerRole, SQUAD_LIMIT, YOUTH_PLANS, retrainOptions, MAX_RETRAINING, hasReplay } from './domain.js';

const app = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastEl = document.querySelector('#toast');
const defaultClub = 'regatas-bella-vista';
const offline = Boolean(window.__RM_CATALOG);
const ageText = player => {
  if (player.fictional) return player.age ?? '—';
  const record = catalog?.players.find(r=>r.id===player.sourceRecordId || (r.clubId===currentId() && normalize(r.name)===normalize(player.name)));
  const birthDate=record?.birthDate ?? player.birthDate ?? catalog?.returns?.players.find(r=>normalize(r.name)===normalize(player.name))?.birthDate;
  const date=world().simulationDate ?? catalog?.verifiedAt;
  const verifiedAge=ageOnDate(birthDate,date);
  if (verifiedAge !== null) return verifiedAge;
  const estimatedAge=ageOnDate(player.community?.birthDate ?? record?.estimatedBirthDate ?? player.estimatedBirthDate,date);
  return estimatedAge === null ? '—' : '~'+estimatedAge;
};
const communityNote = p => { const c = p.community ?? {}, parts = [];
  if (c.name) parts.push('nombre');
  if (c.birthDate && !p.ageKnown) parts.push('edad aproximada');
  if (c.position) parts.push('puesto');
  if (Number.isFinite(c.level)) parts.push('nivel sugerido '+c.level);
  if (c.active === false) parts.push('ya no juega en el club');
  if (c.active === true) parts.push('sigue en el club');
  return parts.length ? 'Corregido por la comunidad: '+parts.join(', ')+'.' : ''; };
// Career stage only; a stage the data cannot settle is not shown.
const trajectoryLabel = p => { const l=stageLabel(p); return l==='Historial incompleto' ? '' : l; };
const seasonsText = n => n+(n===1?' temporada':' temporadas');
const trajectoryTitle = p => { const t = p.trajectory; if (!t) return ''; return seasonsText(t.seasons)+' en Primera desde 2019'+(t.gameSeasons?', '+t.gameSeasons+' en la partida':''); };
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch {} },
};
const theme = () => document.documentElement.dataset.theme || store.get('tt-modern-theme') || 'dark';
const setTheme = value => { document.documentElement.dataset.theme = value; store.set('tt-modern-theme', value); };
document.documentElement.dataset.theme = theme();
const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4"/><circle cx="9" cy="7" r="4"/><path d="M16 3a4 4 0 0 1 0 8"/>',
  field: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 8h4v8H3m18-8h-4v8h4"/><circle cx="12" cy="12" r="2"/>',
  grow: '<path d="M12 22v-8M12 14C12 7 7 5 2 5c0 5 3 9 10 9Zm0 2c0-7 5-9 10-9 0 5-3 9-10 9Z"/>',
  medic: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
  cup: '<path d="M7 3h10v8a5 5 0 0 1-10 0V3Zm0 3H3v2a5 5 0 0 0 5 5m9-7h4v2a5 5 0 0 1-5 5m-4 3v5m-4 0h8"/>',
  return: '<path d="M9 10H4V5m0 5 4-4a8 8 0 1 1-3 9"/>',
  shield: '<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z"/>',
  link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(1 0) scale(.92 1)"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  play: '<path d="m8 5 12 7-12 7V5Z"/>',
  pause: '<path d="M9 5v14m6-14v14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  file: '<path d="M5 3h10l4 4v14H5V3Zm9 0v5h5M8 12h8m-8 4h8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14m0 12 4-4-4-4m4 4H7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3"/>',
};
const nav = [
  ['resumen','Portal','home'], ['plantel','Plantel','team'], ['medico','Centro médico','medic'],
  ['tacticas','Tácticas','field'], ['entrenamiento','Entrenamiento','pulse'], ['cantera','Cantera','grow'],
  ['regresos','Mercado','swap'], ['torneo','Competiciones','cup'], ['club','Club','shield'], ['liga','Liga con amigos','link'],
];
const navigation = [
  ['resumen','Portal',['resumen']],
  ['plantel','Plantel',['plantel','medico','jugador']],
  ['tacticas','Tácticas',['tacticas']],
  ['entrenamiento','Desarrollo',['entrenamiento','cantera']],
  ['regresos','Mercado',['regresos']],
  ['torneo','Competiciones',['torneo','partido']],
  ['club','Club',['club','liga']],
];
const profileTabs = [['perfil','Perfil'],['desarrollo','Desarrollo'],['estadisticas','Estadísticas'],['trayectoria','Trayectoria']];
// [key, label, group, [[option, what it does], ...]]. Each option has a cost and a benefit (TACTIC_TUNING in the engine).
const tacticsConfig = [
  ['mentality','Mentalidad','juego',[['Ofensiva','Pelota en la mano y a lo ancho: más quiebres, más errores de manejo y menos patadas.'],['Equilibrada','Lee cada fase según el terreno. Es el plan base.'],['Defensiva','Patea para ganar terreno y juega cerrado: menos errores y menos quiebres.']]],
  ['attack','Estructura de ataque','juego',[['1-3-3-1','Abrí la cancha con pods de tres forwards.'],['2-4-2','Agrupá cuatro forwards en el medio y jugá más cerrado.']]],
  ['defense','Sistema defensivo','juego',[['Drift','Cerrá de adentro hacia afuera, sin regalar espacio a la espalda.'],['Rush','Salí a presionar la línea de pase: corta el avance, pero concede penales y espacio si la línea no está coordinada.']]],
  ['kicking','Juego con el pie','juego',[['Conservador','Pocas patadas, largas al fondo de la cancha.'],['Territorial','Buscá el touch para jugar en campo rival.']]],
  ['ruck','Ruck','juego',[['Rápido','Acelerá la salida: más metros y quiebres, más pelotas perdidas.'],['Asegurar','Reforzá la limpieza para cuidar la posesión.']]],
  ['scrum','Scrum','parada',[['Estable','Priorizá la pelota propia.'],['Presión','Empujá para recuperar el scrum rival, con más riesgo en el propio.']]],
  ['lineout','Lineout','parada',[['Seguro','Lanzamientos cortos y seguros.'],['Competir','Saltá en los lanzamientos del rival para robarlos.']]],
  ['maul','Maul','parada',[['Evitar','Mové la pelota rápido después del lineout.'],['Usar','Armá el maul cerca del ingoal para empujar con el pack.']]],
  ['penalty','Penales','parada',[['Palos','Patear a los palos desde más lejos: puntos seguros si tenés buen pateador.'],['Touch','Ir al touch y al lineout casi siempre, buscando el try.'],['Según marcador','A los palos cerca del ingoal; al final, al touch si perdés por más de un try convertido y a los palos si ganás.']]],
];

const trainingConfig = [
  ['Equilibrado','pulse','Resistencia y recuperación.'],
  ['Ataque','target','Pase y circulación de la pelota.'],
  ['Defensa','shield','Tackle y control del contacto.'],
  ['Formaciones','field','Trabajo del pack en el scrum.'],
];
const positionAbbr = {'Pilar izquierdo':'PI','Hooker':'HK','Pilar derecho':'PD','Segunda línea':'2L','Ala':'ALA','Número 8':'N8','Medio scrum':'MS','Apertura':'AP','Wing':'W','Centro':'C','Fullback':'FB'};
const pitchSpots = [[29,25],[50,22],[71,25],[38,34],[62,34],[20,43],[80,43],[50,46],[39,55],[61,60],[15,68],[40,71],[64,75],[85,69],[50,88]];
const baseSquads = ['Primera', 'Intermedia', 'Pre A', 'Pre B'];
const divisions = Object.values(DIVISIONS);
const views = new Set([...nav.map(([key])=>key), 'partido', 'jugador']);

let catalog, catalogClubs, demo, league, me = {signedIn:false}, savedLeagues = [];
let demoClubId = store.get('tt-demo-club') || defaultClub;
let demoManager = '', hasDemoSave = false;
let entryStage = 'auth', authKind = 'login', leagueListState = 'idle';
let localProfileName=store.get('tt-local-profile') ?? '';
const localProfile = () => localProfileName;
const entryIdentity = () => offline ? localProfile() : me.signedIn ? me.name ?? 'manager' : null;
const activeEntryKey = 'tt-active-entry';
const invitationCode = () => {
  const url=new URL(location.href);
  const code=(url.searchParams.get('code') ?? url.hash.match(/^#liga\/([a-f0-9]{12})$/i)?.[1] ?? '').toUpperCase();
  return /^[A-F0-9]{12}$/.test(code)?code:'';
};
function readActiveEntry() {
  try { return JSON.parse(sessionStorage.getItem(activeEntryKey)); } catch { return null; }
}
function rememberEntry(mode, code=null) {
  try {
    if (mode) sessionStorage.setItem(activeEntryKey,JSON.stringify({mode,code,identity:entryIdentity()}));
    else sessionStorage.removeItem(activeEntryKey);
  } catch {}
}
function setEntry(stage) {
  entryStage=stage;
  if (stage) rememberEntry(null);
  window.scrollTo({top:0});
  render();
  document.querySelector('#entry-title')?.focus();
}
let page = 'resumen', mobileOpen = false, busy = false, toastTimer, modalPreviousFocus, replay;
let profileId = '', profileTab = 'perfil', profileBack = 'plantel';
let squad = 'Plantel superior', youthSquad = 'M19', positionFilter = '', playerFilter = '';
let clubSearch = '', clubDivision = 'Todas', explorerDivision = '';
let tournamentMode = 'Posiciones', selectedDivision, tournamentClub = '', tournamentRound, tournamentCategory = 'Primera';
let trainPick = '', retrainPick = '', retrainTo = '';
let tacticDraft, lineupDraft, editVersion, squadSort = {key:'',dir:1};
const watchedFixtures = new Map();

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] ?? icons.right) + '</svg>';
const tag = (label, type='') => '<span class="pill '+type+'">'+esc(label)+'</span>';
const button = (label, action, value='', variant='', glyph='', disabled=false) =>
  '<button type="button" class="btn '+variant+'" data-do="'+action+'" data-value="'+esc(value)+'"'+(disabled?' disabled':'')+'>'+ (glyph?icon(glyph):'') + esc(label)+'</button>';
const safeUrl = value => /^https:\/\//i.test(value ?? '') || /^\/(?!\/)/.test(value ?? '') ? esc(value) : '';
const imageUrl = value => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value ?? '') ? esc(value) : safeUrl(value);
const external = (label, url, classes='') => '<a class="'+classes+'" href="'+safeUrl(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
const initials = name => String(name ?? '').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const world = () => league?.world ?? demo;
const currentId = () => league?.myClubId ?? demoClubId;
const club = id => world().clubs.find(c=>c.id===id) ?? catalogClubs.get(id);
const currentClub = () => club(currentId());
const info = (id=currentId()) => catalogClubs.get(id);
const nameOf = id => club(id)?.name ?? 'Club';
const shortOf = id => club(id)?.shortName ?? nameOf(id);
const currentRound = () => roundOf(world());
const myMember = () => league?.members.find(member=>member.isMe);
const editable = () => !myMember()?.ready;
const storageLabel = () => me.storage==='local' ? 'Guardado en este servidor local' : 'Guardado online';
const leagueLabel = () => me.storage==='local' ? 'LIGA LOCAL' : 'LIGA ONLINE';
const editableNotice = () => editable() ? '' : '<div class="notice">Marcaste tu equipo como listo. Volvé a la liga y cambiá tu estado para editarlo.</div>';
const crest = (id, extra='') => {
  const item = info(id);
  const url = imageUrl(item?.crest?.localPath ?? item?.crest?.url);
  const fallback = '<span class="crest crest-fallback '+extra+'" aria-hidden="true"'+(url?' hidden':'')+'>'+esc(shortOf(id))+'</span>';
  return '<span class="crest-holder">'+(url?'<img class="crest '+extra+'" src="'+url+'" alt="" decoding="async" loading="'+(extra?'eager':'lazy')+'">':'')+fallback+'</span>';
};
const panel = (heading, html, aside='', classes='') => '<section class="panel '+classes+'"><header class="panel-head"><h3>'+esc(heading)+'</h3>'+aside+'</header>'+html+'</section>';
const empty = (label, glyph='file') => '<div class="empty">'+icon(glyph)+'<p>'+esc(label)+'</p></div>';
// The club name already lives in the top bar, so page headers carry only the title and one short line.
const intro = (label, title, subtitle, aside='') => '<header class="page-intro"><div><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div>'+aside+'</header>';
const ratingTone = value => value>=80?'r-elite':value>=72?'r-good':value>=64?'r-ok':value>=56?'r-low':'r-poor';
const attrTone = value => value>=16?'r-elite':value>=13?'r-good':value>=10?'r-ok':value>=7?'r-low':'r-poor';
const option = (label,value,selected) => '<option value="'+esc(value)+'"'+(value===selected?' selected':'')+'>'+esc(label)+'</option>';
const tabs = (items,active,action,label='Sección') => '<div class="tabs" role="group" aria-label="'+esc(label)+'">'+items.map(item=>'<button class="tab '+(item===active?'active':'')+'" type="button" aria-pressed="'+(item===active)+'" data-do="'+action+'" data-value="'+esc(item)+'">'+esc(item)+'</button>').join('')+'</div>';
const clubMatches = (id=currentId()) => world().fixtures.filter(f=>f.homeId===id||f.awayId===id).sort((a,b)=>a.round-b.round);
function watched() {
  const key = 'tt-watched-v1:'+ (league?.code ?? 'demo') + ':' + world().season + ':' + currentId();
  if (!watchedFixtures.has(key)) {
    let saved = [];
    try { saved = JSON.parse(store.get(key) ?? '[]'); } catch {}
    watchedFixtures.set(key,new Set(Array.isArray(saved)?saved:[]));
  }
  return {key,fixtures:watchedFixtures.get(key)};
}
function pendingReplay() {
  const {fixtures}=watched();
  return clubMatches().find(f=>f.match&&!fixtures.has(f.id));
}
function revealMatch(id) {
  const {key,fixtures}=watched();
  fixtures.add(id);
  store.set(key,JSON.stringify([...fixtures]));
}
// Round label: «Fecha N», or the playoff stage.
const roundLabel = f => f?.stage==='semi' ? 'Semifinal' : f?.stage==='final' ? (f.division==='Top 14'?'Final URBA':'Final por el ascenso') : 'Fecha '+f?.round;
const roundName = (r, division=currentClub().division) => { const f=world().fixtures.find(x=>x.round===r&&x.division===division); return f?roundLabel(f):'Fecha '+r; };
const nextMatch = () => pendingReplay() ?? clubMatches().find(f=>!f.match);
const resultVisible = (f,cutoff=pendingReplay()?.round ?? Infinity) => Boolean(f.match)&&f.round<cutoff;
const lastMatch = () => {
  const cutoff=pendingReplay()?.round ?? Infinity;
  return clubMatches().findLast(f=>resultVisible(f,cutoff));
};
function visibleStandings(division) {
  const pending=pendingReplay();
  return engine.getStandings(pending?{...world(),fixtures:world().fixtures.filter(f=>f.round<pending.round)}:world(),division);
}
const lineup = c => {
  const seniors = c.players.filter(p=>p.squad==='Plantel superior');
  return engine.effectiveLineup(c);
};
const strength = c => info(c.id)?.strength ?? Math.round(c.strength*5);
const clubCell = (id, classes='') => '<span class="club-cell '+classes+'">'+crest(id)+'<span>'+esc(nameOf(id))+'</span></span>';
const formFor = id => {
  const cutoff=pendingReplay()?.round ?? Infinity;
  return clubMatches(id).filter(f=>resultVisible(f,cutoff)).slice(-5).map(f=>{
    const diff=(f.match.homeScore-f.match.awayScore)*(f.homeId===id?1:-1);
    return diff>0?'G':diff<0?'P':'E';
  });
};
const formBadge = id => '<div class="form">'+(formFor(id).map(x=>'<span class="'+(x==='P'?'loss':x==='E'?'draw':'')+'">'+x+'</span>').join('')||'<small>—</small>')+'</div>';
const playerById = id => currentClub().players.find(p=>p.id===id) ?? world().returnCandidates?.find(c=>c.player.id===id)?.player ??
  world().clubs.find(c=>c.players.some(p=>p.id===id))?.players.find(p=>p.id===id) ??
  world().overseasCareers?.find(c=>c.player.id===id)?.player;
const overseasDestination = row => [row.destination?.competition,row.destination?.country].filter(Boolean).join(' · ');
const managerName = () => myMember()?.nickname ?? (demoManager || me.name || localProfile() || 'Mánager');
const contactFooter = () => '<footer class="contact-footer"><a href="mailto:felipechiesa05@gmail.com">Contacto</a></footer>';

function assignment(fixture) {
  const venue = info(fixture.homeId)?.venue?.name;
  const date = fixture.date ? new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(fixture.date+'T00:00:00Z')) : '';
  const referee = catalog.referees?.length ? catalog.referees[[...fixture.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%catalog.referees.length].name : '';
  return {venue,referee,date};
}

function contextNavigation(group) {
  if (page==='jugador') return profileTabs.map(([id,label])=>[label,'profile-tab',id,profileTab===id]);
  if (group[0]==='regresos') return ['Buscar jugadores','Regresos del exterior'].map(label=>[label,'market-tab',label,marketTab===label]);
  if (group[0]==='torneo') return ['Posiciones','Fixture'].map(label=>[label,'competition-nav',label,page==='torneo'&&tournamentMode===label]);
  if (group[0]==='resumen') return [];
  return group[2].filter(id=>id!=='jugador').map(id=>[nav.find(([key])=>key===id)[1],'page',id,page===id]);
}

function shell(content) {
  const c = currentClub(), pending = pendingReplay(), next = nextMatch();
  const round = page==='partido'&&replay ? replay.fixture.round : pending?.round ?? currentRound();
  const active = navigation.find(([, ,pages])=>pages.includes(page)) ?? navigation[0];
  const canAdvance = !league;
  const needsReady = league && !myMember()?.ready;
  const nextLabel = pending ? 'Continuar' : needsReady ? 'Estoy listo' : !canAdvance ? 'Esperando a '+league.members.filter(m=>!m.ready).length : !Number.isFinite(round) ? 'Nueva temporada' : 'Continuar';
  const topAction = pending ? 'replay' : needsReady ? 'ready' : canAdvance ? 'advance' : 'page';
  const clubColor = /^#[a-f0-9]{6}$/i.test(c.color) ? c.color : '#2361ce';
  const dark = theme()==='dark';
  const matchDate = next ? assignment(next).date : '';
  // Text on the club colour: dark on light colours (Regatas yellow), white on dark ones.
  const lum = hex => { const [r,g,b2] = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b2; };
  const clubInk = lum(clubColor) > .36 ? '#16130f' : '#ffffff';
  return '<a class="skip-link" href="#main-content">Saltar al contenido</a><div class="app-shell modern-manager" style="--club:'+clubColor+';--club-ink:'+clubInk+'">'+
    '<header class="clubbar"><div class="clubbar-row">'+
    '<button class="clubbar-crest" data-do="clubs" type="button" aria-label="'+(league?'Ver clubes':'Cambiar de club')+'" title="'+esc(c.name)+'">'+crest(c.id)+'</button>'+
    '<nav class="mainnav" aria-label="Menú principal">'+navigation.map(([id,label])=>'<button type="button" class="mainnav-item'+(active[0]===id?' active':'')+'" data-do="page" data-value="'+id+'"'+(active[0]===id?' aria-current="true"':'')+'>'+esc(label)+'</button>').join('')+'</nav>'+
    '<div class="clubbar-actions"><button class="icon-btn theme-toggle" type="button" data-do="theme" aria-label="Cambiar a modo '+(dark?'claro':'oscuro')+'">'+icon(dark?'sun':'moon')+'</button>'+
    '<div class="date-display"><small>'+esc(matchDate?matchDate+' '+world().season:world().season)+'</small><strong>'+(Number.isFinite(round)?esc(roundName(round)):'Fin de temporada')+'</strong></div>'+
    (page==='partido'&&replay?'':button(nextLabel,topAction,pending?.id ?? (topAction==='page'?'liga':''),'primary continue',needsReady&&!pending?'check':'right',busy))+'</div></div>'+
    '<div class="subbar"><strong class="subbar-club">'+esc(c.name)+'</strong><nav class="context-nav" aria-label="'+esc(active[1])+'">'+contextNavigation(active).map(([label,action,value,selected])=>'<button type="button" data-do="'+action+'" data-value="'+esc(value)+'"'+(selected?' class="active" aria-current="page"':'')+'>'+esc(label)+'</button>').join('')+'</nav><span class="subbar-right">'+(league?esc(league.name):'Modo offline')+' · '+esc(managerName())+'</span></div></header>'+
    '<main id="main-content" tabindex="-1" class="content view-'+page+'">'+content+contactFooter()+'</main>'+
    bottomNav()+'</div>';
}

// Phone navigation: the four screens used every round, plus «Más» with the rest. The top menu is hidden there.
const primaryNav = ['resumen','plantel','tacticas','torneo'];
function bottomNav() {
  const more = nav.filter(([id])=>!primaryNav.includes(id)), inMore = more.some(([id])=>id===page);
  const short = {torneo:'Torneo',resumen:'Portal'};
  const item = ([id,label0,glyph,label=short[id] ?? label0]) => '<button type="button" class="bottomnav-item'+(page===id?' active':'')+'" data-do="page" data-value="'+id+'"'+(page===id?' aria-current="page"':'')+'>'+icon(glyph)+'<span>'+esc(label)+'</span></button>';
  return (mobileOpen?'<div class="more-scrim" data-do="mobile"></div><div class="more-sheet" role="dialog" aria-label="Más secciones">'+more.map(([id,label,glyph])=>'<button type="button" class="more-item'+(page===id?' active':'')+'" data-do="page" data-value="'+id+'">'+icon(glyph)+'<span>'+esc(label)+(id==='liga'&&league?' · '+league.members.length:'')+'</span></button>').join('')+'</div>':'')+
    '<nav class="bottomnav" aria-label="Menú">'+nav.filter(([id])=>primaryNav.includes(id)).map(item).join('')+
    '<button type="button" class="bottomnav-item'+(inMore||mobileOpen?' active':'')+'" data-do="mobile" aria-expanded="'+mobileOpen+'">'+icon('menu')+'<span>'+(inMore?esc(nav.find(([id])=>id===page)[1]):'Más')+'</span></button></nav>';
}

function pitch(c, ids=lineup(c), large=false) {
  return '<div class="pitch '+(large?'formation-pitch':'')+'" aria-label="Formación del equipo">'+
    [8,24,50,76,92].map((y,i)=>'<span class="pitch-line '+(i===1||i===3?'dashed':'')+'" style="top:'+y+'%"></span>').join('')+
    '<span class="pitch-label" style="top:10%">INGOAL</span><span class="pitch-label" style="top:51%">MITAD</span>'+
    ids.map((id,i)=>{
      const p = c.players.find(x=>x.id===id);
      const [x,y] = pitchSpots[i];
      return p?'<button class="pitch-dot" type="button" style="left:'+x+'%;top:'+y+'%" data-do="player" data-value="'+esc(id)+'" title="'+esc(p.name)+'" aria-label="Dorsal '+(i+1)+', '+esc(p.name)+'">'+(i+1)+'<small>'+esc(p.name.split(' ').slice(1).join(' '))+'</small></button>':'';
    }).join('')+'</div>';
}

function fixtureCard(fixture) {
  if (!fixture) return panel('Próximo partido', empty('Ya se jugaron todos tus partidos.', 'cup'), '', 'match-card');
  const {venue,referee,date} = assignment(fixture);
  return panel('Próximo partido',
    '<div class="fixture-teams"><div class="fixture-team">'+crest(fixture.homeId)+'<strong>'+esc(shortOf(fixture.homeId))+'</strong></div><div class="versus">VS<small>FECHA '+fixture.round+'</small></div><div class="fixture-team">'+crest(fixture.awayId)+'<strong>'+esc(shortOf(fixture.awayId))+'</strong></div></div>'+
    '<div class="match-meta">'+[date,venue ?? nameOf(fixture.homeId)].filter(Boolean).map(esc).join(' · ')+'<br>'+(referee?'Árbitro · '+esc(referee):'')+'</div>'+
    (fixture.match?button('Continuar','replay',fixture.id,'primary','play'):button('Preparar el partido','page','tacticas','ghost','field')), tag(fixture.division,'neutral'), 'match-card');
}

// Parallel categories (Intermedia, Pre A, Pre B, M19, M17): result of a fixture, hidden like Primera until the replay.
const parallelResult = (f,cat,cutoff=pendingReplay()?.round ?? Infinity) => f.round<cutoff ? world().parallel?.results?.[f.id]?.[cat] : undefined;
const parallelForm = (id,cat) => clubMatches(id).map(f=>[f,parallelResult(f,cat)]).filter(([,r])=>r).slice(-5).map(([f,r])=>{
  const diff=(r[0]-r[1])*(f.homeId===id?1:-1);return diff>0?'G':diff<0?'P':'E';});
// Table zones: URBA playoffs, direct promotion and relegation.
const zoneOf = (division, pos, n) => division==='Top 14' ? (pos<=4?'z-playoff':pos>n-2?'z-down':'') : pos===1?'z-up':pos<=5?'z-playoff':(division==='Primera A'&&pos>n-2)?'z-down':'';
const zoneLegend = division => '<div class="zone-legend">'+(division==='Top 14'?'<span class="z-playoff">Semifinales (1º–4º)</span><span class="z-down">Descenso</span>':'<span class="z-up">Ascenso directo</span><span class="z-playoff">Playoff por el ascenso (2º–5º)</span>'+(division==='Primera A'?'<span class="z-down">Descenso</span>':''))+'</div>';
// Playoff bracket: semi-finals and final, with the result only once it can be seen.
function playoffBracket(division) {
  const st = playoffState(world(), division); if (!st.semis.length) return '';
  const cutoff = pendingReplay()?.round ?? Infinity;
  const tie = f => { if (!f) return '<div class="tie empty"><small>A definir</small></div>'; const seen=resultVisible(f,cutoff), win=seen?playoff(f,st):null;
    return '<div class="tie">'+[[f.homeId,f.match?.homeScore],[f.awayId,f.match?.awayScore]].map(([id,sc])=>'<div class="tie-team'+(win===id?' won':'')+'"><span class="seed">'+(st.seedOf(id) ?? '')+'</span>'+clubCell(id)+'<b>'+(seen?sc:'')+'</b></div>').join('')+'</div>'; };
  const champ = st.winner && resultVisible(st.final,cutoff) ? '<div class="bracket-champ">'+icon('trophy')+'<span>'+(division==='Top 14'?'Campeón URBA':'Asciende')+'</span>'+clubCell(st.winner)+'</div>' : '';
  return panel(st.rule.title+' · '+division,'<div class="bracket"><div class="bracket-col"><small>Semifinales</small>'+st.semis.map(tie).join('')+'</div><div class="bracket-col final"><small>'+esc(st.rule.title)+' · cancha neutral</small>'+tie(st.final)+champ+'</div></div>'+
    (division!=='Top 14'?'<p class="training-note">El 1º ('+esc(nameOf(st.table[0]?.clubId))+') asciende directo; el ganador de la final, también.</p>':''));
}
const playoff = (f, st) => { const m=f.match; if (!m) return null; if (m.homeScore!==m.awayScore) return m.homeScore>m.awayScore?f.homeId:f.awayId; if (m.homeTries!==m.awayTries) return m.homeTries>m.awayTries?f.homeId:f.awayId; return (st.seedOf(f.homeId) ?? 99)<=(st.seedOf(f.awayId) ?? 99)?f.homeId:f.awayId; };
function standingsTable(division, compact=false, cat='Primera') {
  const rows = cat==='Primera' ? visibleStandings(division) : parallelStandings(world(),division,cat,pendingReplay()?.round ?? Infinity);
  const badge = id => cat==='Primera' ? formBadge(id) : '<div class="form">'+(parallelForm(id,cat).map(x=>'<span class="'+(x==='P'?'loss':x==='E'?'draw':'')+'">'+x+'</span>').join('')||'<small>—</small>')+'</div>';
  const slice = compact?rows.slice(0,6):rows;
  const mine = rows.findIndex(row=>row.clubId===currentId());
  const listed = compact && mine>=6 ? [...slice,rows[mine]] : slice;
  return '<div class="table-wrap"><table><thead><tr><th scope="col">Pos.</th><th scope="col">Club</th><th scope="col">PJ</th>'+
    (compact?'':'<th scope="col" class="col-d">G</th><th scope="col" class="col-d">E</th><th scope="col" class="col-d">P</th><th scope="col" class="col-d">PF</th><th scope="col" class="col-d">PC</th><th scope="col">Dif.</th><th scope="col" class="col-d">Bonus</th>')+
    '<th scope="col">Pts</th><th scope="col"'+(compact?'':' class="col-d"')+'>Racha</th></tr></thead><tbody>'+
    listed.map(r=>'<tr class="'+(r.clubId===currentId()?'highlight ':'')+(cat==='Primera'?zoneOf(division,rows.indexOf(r)+1,rows.length):'')+'"><td>'+ (rows.indexOf(r)+1) +'</td><td>'+clubCell(r.clubId)+'</td><td>'+r.played+'</td>'+
    (compact?'':'<td class="col-d">'+r.won+'</td><td class="col-d">'+r.drawn+'</td><td class="col-d">'+r.lost+'</td><td class="col-d">'+r.pointsFor+'</td><td class="col-d">'+r.pointsAgainst+'</td><td>'+(r.pointsFor-r.pointsAgainst)+'</td><td class="col-d">'+r.bonus+'</td>')+
    '<td class="points">'+r.points+'</td><td'+(compact?'':' class="col-d"')+'>'+badge(r.clubId)+'</td></tr>').join('')+'</tbody></table></div>';
}

function dashboard() {
  const c = currentClub(), next = nextMatch(), last = lastMatch();
  const tab = (label,route) => button(label,'page',route,'ghost small','right');
  const rosters = [...baseSquads,'M19','M17'].map(group=>{
    const count=c.players.filter(p=>p.squad===group||(p.squad==='Plantel superior'&&p.seniorSquad===group)).length;
    return '<button type="button" data-do="portal-squad" data-value="'+group+'"><span>'+group+'</span><small>'+count+' jugadores</small>'+icon('right')+'</button>';
  }).join('');
  const result = last ? panel('Último resultado',
    '<div class="portal-result">'+crest(last.homeId)+'<div><strong>'+last.match.homeScore+' – '+last.match.awayScore+'</strong><small>'+esc(roundLabel(last))+' · '+esc(shortOf(last.homeId))+' / '+esc(shortOf(last.awayId))+'</small></div>'+crest(last.awayId)+'</div>',
    hasReplay(last)?button('Repetición','replay',last.id,'ghost small','play'):'') : '';
  return '<div class="portal-heading"><div><h1>Portal del club</h1><span>'+esc(c.division)+' · Temporada '+world().season+'</span></div>'+
    (!league?button('Cambiar de modo','entry-mode','','ghost small','link'):'')+'</div>'+
    '<div class="portal-grid">'+
      '<div class="portal-column" id="portal-inbox" tabindex="-1">'+inboxPanel(c)+panel('Equipos del club','<div class="portal-club-roster">'+rosters+'</div>')+'</div>'+
      '<div class="portal-column" id="portal-match" tabindex="-1">'+fixtureCard(next)+result+upcomingPanel(c,next)+newsPanel(c)+'</div>'+
      '<div class="portal-column">'+panel(c.division,standingsTable(c.division,true),tab('Tabla','torneo'),'portal-standings')+playerLeadersPanel(c)+categoriesPanel(c)+playoffBracket(c.division)+'</div>'+
      '<div class="portal-column">'+rivalPanel(c,next)+weekPanel(c)+'</div>'+
    '</div>';
}

const xvLevel = c => { const ids=lineup(c), xs=ids.map(id=>c.players.find(p=>p.id===id)).filter(Boolean); return xs.length?Math.round(xs.reduce((n,p)=>n+overall(p),0)/xs.length):null; };
const rankOf = (id, division) => { const rows=visibleStandings(division), i=rows.findIndex(r=>r.clubId===id); return rows[i]?.played ? {pos:i+1,pts:rows[i].points} : null; };
const homeRow = (label, value, extra='') => '<div class="home-row"><span>'+esc(label)+'</span><strong>'+value+'</strong>'+extra+'</div>';

/** Next opponent: table, form, XV level against yours, best player and this season's previous meeting. */
function rivalPanel(c, next) {
  if (!next) return '';
  const rid = next.homeId===c.id ? next.awayId : next.homeId, r = club(rid);
  if (!r?.players) return '';
  const mine = xvLevel(c), theirs = xvLevel(r), rk = rankOf(rid, r.division);
  const star = r.players.filter(p=>p.squad==='Plantel superior'&&engine.available(p)).sort((a,b)=>overall(b)-overall(a))[0];
  const meeting = clubMatches(c.id).findLast(f=>f.id!==next.id&&(f.homeId===rid||f.awayId===rid)&&resultVisible(f));
  const share = mine&&theirs ? Math.round(100*mine/(mine+theirs)) : 50;
  const gap = mine&&theirs ? mine-theirs : 0;
  return panel('Rival · '+shortOf(rid),
    '<div class="rival-head">'+crest(rid)+'<div><strong>'+esc(nameOf(rid))+'</strong><small>'+(next.homeId===c.id?'Visitante en tu cancha':'Local')+'</small></div>'+formBadge(rid)+'</div>'+
    '<div class="duel"><span>'+esc(shortOf(c.id))+' <b>'+(mine ?? '—')+'</b></span><span><b>'+(theirs ?? '—')+'</b> '+esc(shortOf(rid))+'</span>'+
      '<div class="duel-bar" aria-hidden="true"><i style="width:'+share+'%"></i></div><small>'+(gap>1?'Tu XV es superior':gap<-1?'Su XV es superior':'XV parejos')+' · nivel promedio del XV</small></div>'+
    homeRow('Posición', rk ? rk.pos+'º · '+rk.pts+' pts' : '—')+
    (star?homeRow('Figura', esc(star.name)+' <span class="rating '+ratingTone(overall(star))+'">'+overall(star)+'</span>', '<small>'+esc(positionAbbr[star.position] ?? star.position)+'</small>'):'')+
    (meeting?homeRow('Último cruce', (meeting.homeId===c.id?meeting.match.homeScore+' - '+meeting.match.awayScore:meeting.match.awayScore+' - '+meeting.match.homeScore), '<small>Fecha '+meeting.round+'</small>'):''),
    button('Informe','rival-report',rid,'ghost small','target'));
}

// Match analysis by the assistant coach, from the engine's per-team analysis of a played match.
const UNIT_NAMES = {openPlay:'el juego abierto',scrum:'el scrum',lineout:'el lineout',maul:'el maul',kicking:'el juego con el pie',discipline:'la disciplina'};
function matchAnalysis(f, id) {
  const m=f.match, home=f.homeId===id, rival=home?f.awayId:f.homeId;
  const us=home?m.homeScore:m.awayScore, them=home?m.awayScore:m.homeScore, tries=home?m.homeTries:m.awayTries, theirTries=home?m.awayTries:m.homeTries;
  const lines=[(us>them?'Ganamos ':us<them?'Perdimos ':'Empatamos ')+us+'-'+them+' '+(home?'de local':'de visitante')+' contra '+nameOf(rival)+': '+tries+(tries===1?' try':' tries')+' a '+theirTries+'.'];
  const a=m.analysis?.[home?'home':'away'], b=m.analysis?.[home?'away':'home'];
  let tip='';
  if (a&&b) {
    const diffs=Object.keys(UNIT_NAMES).map(k=>[k,(a[k]??0)-(b[k]??0)]).sort((x,y)=>y[1]-x[1]);
    const best=diffs[0], worst=diffs.at(-1);
    if (best[1]>0.3) lines.push('Fuimos superiores en '+UNIT_NAMES[best[0]]+'.');
    if (worst[1]<-0.3) lines.push('Sufrimos en '+UNIT_NAMES[worst[0]]+'.');
    if (Number.isFinite(a.territory)) lines.push('Territorio: '+Math.round(a.territory)+'%'+(a.metresGained?' · '+Math.round(a.metresGained)+' metros ganados':'')+(Number.isFinite(a.turnoversWon)?' · '+a.turnoversWon+' pelotas recuperadas':'')+'.');
    tip = worst[1]<-0.3 ? {scrum:'En el scrum conviene «Estable» hasta que el pack mejore.',lineout:'Para el lineout, probá «Seguro»: lanzamientos cortos.',maul:'Si el maul no avanza, mejor «Evitar» y mover la pelota.',kicking:'Con el pie perdimos terreno: trabajá patada en las sesiones individuales.',discipline:'Hicimos demasiados penales: una defensa «Drift» arriesga menos.',openPlay:'Nos costó con la pelota en la mano: un ruck «Asegurar» da más continuidad.'}[worst[0]] : (a.territory<45?'Jugamos mucho en nuestro campo: un juego con el pie «Territorial» puede ayudar.':'');
  }
  const xv=lineup(currentClub()).map(i=>currentClub().players.find(p=>p.id===i)).filter(Boolean);
  const tired=xv.filter(p=>p.fitness<85);
  if (tired.length) tip+=(tip?' ':'')+tired.length+(tired.length===1?' titular llega cansado':' titulares llegan cansados')+' ('+tired.slice(0,3).map(p=>p.name.split(' ').slice(-1)[0]).join(', ')+'): pensá en rotar.';
  return lines.join(' ')+(tip?' '+tip:'');
}
// Rival scouting: probable XV, where they are strong (recent matches, else the squad by lines) and how they play.
function rivalScouting(rid) {
  const r=club(rid), xv=engine.effectiveLineup(r).map(id=>r.players.find(p=>p.id===id)).filter(Boolean);
  const avg=xs=>xs.length?Math.round(xs.reduce((n,p)=>n+overall(p),0)/xs.length):0;
  const recent=clubMatches(rid).filter(f=>resultVisible(f)&&f.match.analysis).slice(-3);
  const strengths=[];
  if (recent.length) {
    const mean=k=>recent.reduce((n,f)=>n+(f.match.analysis[f.homeId===rid?'home':'away'][k]??0),0)/recent.length;
    const all=Object.keys(UNIT_NAMES).map(k=>[k,mean(k)]).sort((a,b)=>b[1]-a[1]);
    strengths.push('Fuertes en '+UNIT_NAMES[all[0][0]]+' y '+UNIT_NAMES[all[1][0]]+'; más flojos en '+UNIT_NAMES[all.at(-1)[0]]+(recent.length===1?' (último partido).':' (últimos '+recent.length+' partidos).'));
    const terr=recent.reduce((n,f)=>n+(f.match.analysis[f.homeId===rid?'home':'away'].territory??50),0)/recent.length;
    strengths.push(terr>=53?'Juegan en campo rival: presionan y patean para ganar terreno.':terr<=47?'Suelen jugar en su campo y salir de contra.':'Reparten el juego en las dos mitades.');
  }
  const pack=avg(xv.slice(0,8)), backs=avg(xv.slice(8));
  strengths.push(pack>backs+2?'Su fuerte es el pack (forwards '+pack+' contra backs '+backs+'): esperá scrum, maul y juego cerrado.':backs>pack+2?'Su fuerte son los backs ('+backs+' contra '+pack+' del pack): van a buscar abrir la cancha.':'Equipo parejo entre forwards ('+pack+') y backs ('+backs+').');
  const t=world().tactics?.[rid];
  if (t?.attack) strengths.push('Plan habitual: '+[t.mentality ?? 'Equilibrada',t.attack,'defensa '+t.defense,'pie '+t.kicking.toLowerCase()].join(' · ')+'.');
  const kicker=xv[9];
  return {r,xv,strengths,kicker,pack,backs};
}
function showRivalReport(rid) {
  const {r,xv,strengths}=rivalScouting(rid), rk=rankOf(rid,r.division), injured=r.players.filter(p=>p.squad==='Plantel superior'&&p.injury).length;
  const row=(p,i)=>'<li><span class="num">'+(i+1)+'</span><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.position)+'</small></span><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span></li>';
  showModal('Informe del rival · '+r.name,
    '<div class="player-detail-top">'+crest(rid)+'<div><h2>'+esc(r.name)+'</h2><p>'+esc(r.division)+' · '+(rk?rk.pos+'º con '+rk.pts+' pts':'sin partidos')+(injured?' · '+injured+(injured===1?' lesionado':' lesionados'):'')+'</p></div>'+formBadge(rid)+'</div>'+
    '<h3 class="spaced">Cómo juegan</h3><ul class="scout-notes">'+strengths.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+
    '<h3 class="spaced">XV probable</h3><div class="scout-xv"><ol>'+xv.slice(0,8).map(row).join('')+'</ol><ol start="9">'+xv.slice(8).map((p,i)=>row(p,i+8)).join('')+'</ol></div>',
    button('Preparar el partido','page','tacticas','primary','field')+button('Cerrar','close-modal','','ghost'),true);
}
// Inbox: board, staff and assistant messages. Read state is kept per browser.
const readSet = () => { try { return new Set(JSON.parse(store.get('tt-read') ?? '[]')); } catch { return new Set(); } };
const markRead = id => { const r=readSet(); r.add(id); store.set('tt-read', JSON.stringify([...r].slice(-400))); };
const NEWS_FROM = {injury:['Cuerpo médico','medic'],recovery:['Cuerpo médico','check'],training:['Preparador físico','pulse'],youth:['Coordinador de juveniles','grow'],squad:['Secretaría del club','team'],transfer:['Mánager deportivo','swap']};
function inboxItems(c) {
  const season=world().season, cutoff=pendingReplay()?.round ?? Infinity, items=[], obj=clubObjective(world(),c.id);
  items.push({id:'board-'+c.id+'-'+season,round:0,from:'Comisión directiva',glyph:'shield',title:'Objetivo '+season+': '+obj.text.toLowerCase(),body:'Exigencia '+obj.level.toLowerCase()+'. El plantel es el '+obj.rank+'º más fuerte de '+c.division+' y esperamos que termines '+(obj.target===2?'1º o 2º':'entre los '+obj.target+' primeros')+'. Contamos con vos.'});
  for (const n of clubNews(c)) { const [from,glyph]=NEWS_FROM[n.kind] ?? ['Club','file']; items.push({id:'n-'+season+'-'+n.round+'-'+n.kind+'-'+(n.playerId ?? '')+'-'+n.text.length,round:n.round,from,glyph,title:n.text.split('. ')[0].replace(/\.$/,''),body:n.text}); }
  for (const f of clubMatches(c.id).filter(f=>resultVisible(f,cutoff))) {
    const home=f.homeId===c.id, us=home?f.match.homeScore:f.match.awayScore, them=home?f.match.awayScore:f.match.homeScore;
    items.push({id:'an-'+f.id,round:f.round+.1,from:'Segundo entrenador',glyph:'target',title:'Análisis: '+(us>them?'victoria':us<them?'derrota':'empate')+' '+us+'-'+them+' ante '+shortOf(home?f.awayId:f.homeId),body:matchAnalysis(f,c.id),action:hasReplay(f)?['Ver repetición','replay',f.id]:null});
  }
  const next=nextMatch();
  if (next&&!next.match) { const rid=next.homeId===c.id?next.awayId:next.homeId; items.push({id:'rv-'+next.id,round:next.round-.5,from:'Analista de video',glyph:'field',title:'Informe del rival: '+nameOf(rid),body:rivalScouting(rid).strengths.join(' '),action:['XV probable','rival-report',rid]}); }
  return items.sort((a,b)=>b.round-a.round);
}
let inboxOpen = null, inboxAll = false;
function inboxPanel(c) {
  const items=inboxItems(c), read=readSet(), unread=items.filter(i=>!read.has(i.id)).length, shown=inboxAll?items:items.slice(0,6);
  return panel('Buzón','<div class="inbox">'+shown.map(i=>{const open=inboxOpen===i.id;
    return '<div class="inbox-item'+(read.has(i.id)?'':' unread')+(open?' open':'')+'"><button type="button" class="inbox-head" data-do="inbox" data-value="'+esc(i.id)+'" aria-expanded="'+open+'">'+icon(i.glyph)+'<span><small>'+esc(i.from)+(i.round>=1?' · Fecha '+Math.ceil(i.round):'')+'</small><strong>'+esc(i.title)+'</strong></span>'+(read.has(i.id)?'':'<i class="dot" aria-label="Sin leer"></i>')+'</button>'+
      (open?'<div class="inbox-body"><p>'+esc(i.body)+'</p>'+(i.action?button(i.action[0],i.action[1],i.action[2],'small','right'):'')+'</div>':'')+'</div>';}).join('')+'</div>'+
    '<div class="panel-body center action-row" style="justify-content:center">'+(items.length>6?button(inboxAll?'Ver menos':'Ver todos ('+items.length+')','inbox-all','','ghost small'):'')+(unread?button('Marcar todo como leído','inbox-read-all','','ghost small','check'):'')+'</div>',
    unread?tag(unread+(unread===1?' sin leer':' sin leer'),'blue'):'');
}

/** What the manager can still do before the next round. */
function weekPanel(c) {
  const round = currentRound(), open = Number.isFinite(round);
  const ids = engine.effectiveLineup(c), seniors = c.players.filter(p=>p.squad==='Plantel superior');
  const injured = c.players.filter(p=>p.injury), xvInjured = seniors.filter(p=>p.injury&&(c.lineup ?? []).includes(p.id));
  const sessionDone = world().trainingRounds?.[c.id]===round;
  const learning = c.players.filter(p=>p.retraining).length;
  const ready = (world().returnCandidates ?? []).filter(x=>x.homeClubId===c.id&&x.status==='ready').length;
  const plan = world().youthTraining?.[c.id] ?? 'Integral', t = world().tactics?.[c.id] ?? {};
  const row = (glyph, label, status, ok, target) => '<button type="button" class="todo '+(ok?'ok':'todo-open')+'" data-do="page" data-value="'+target+'">'+icon(ok?'check':glyph)+'<span><strong>'+esc(label)+'</strong><small>'+esc(status)+'</small></span>'+icon('right')+'</button>';
  return panel('Esta semana', '<div class="todo-list">'+
    row('field','XV titular', xvInjured.length ? xvInjured.length+(xvInjured.length===1?' lesionado: entra el mejor disponible':' lesionados: entran los mejores disponibles') : ids.length+' jugadores listos', !xvInjured.length, 'tacticas')+
    row('target','Plan de juego', (t.mentality ?? 'Equilibrada')+' · '+(t.attack ?? '1-3-3-1')+' · '+(t.defense ?? 'Drift'), true, 'tacticas')+
    (open?row('pulse','Sesión individual', sessionDone ? 'Hecha en esta fecha' : 'Disponible en esta fecha', sessionDone, 'entrenamiento'):'')+
    row('grow','Reconversiones', learning ? learning+' de '+MAX_RETRAINING+' en curso' : 'Ninguna en curso', true, 'entrenamiento')+
    row('medic','Centro médico', injured.length ? injured.length+(injured.length===1?' lesionado':' lesionados') : 'Plantel sano', !injured.length, 'medico')+
    row('grow','Cantera', 'Plan '+plan, true, 'cantera')+
    (ready?row('return','Regresos', ready+(ready===1?' jugador dispuesto a volver':' jugadores dispuestos a volver'), false, 'regresos'):'')+
    '</div>');
}

const statsCutoff = () => (pendingReplay()?.round ?? Infinity)-1;
const statCell = value => value==null?'—':esc(value);
function playerLeadersPanel(c) {
  const throughRound = statsCutoff();
  const rows = c.players.filter(p=>p.squad==='Plantel superior')
    .map(player=>{
      const {rows,season}=playerCareerStats(world(),player.id,{throughRound,recentLimit:0});
      return {player,stats:rows.find(row=>row.season===season&&row.clubId===c.id)};
    })
    .filter(({stats})=>stats?.appearances>0)
    .sort((a,b)=>(b.stats.tries ?? -1)-(a.stats.tries ?? -1)||(b.stats.points ?? -1)-(a.stats.points ?? -1)||b.stats.appearances-a.stats.appearances)
    .slice(0,5);
  if (!rows.length) return panel('Estadísticas del plantel',empty('Se registran al jugar partidos de Primera.','pulse'),
    button('Plantel','page','plantel','ghost small','right'),'portal-leaders');
  const body='<div class="table-wrap"><table><thead><tr><th scope="col">Jugador</th><th scope="col" title="Partidos jugados">PJ</th><th scope="col">Tries</th><th scope="col" title="Puntos">Pts</th></tr></thead><tbody>'+
    rows.map(({player,stats})=>'<tr><td><button class="player-name" type="button" data-do="player" data-value="'+esc(player.id)+'">'+esc(player.name)+'</button></td><td>'+statCell(stats.appearances)+'</td><td>'+statCell(stats.tries)+'</td><td>'+statCell(stats.points)+'</td></tr>').join('')+'</tbody></table></div>';
  return panel('Estadísticas del plantel',body,tag(String(world().season),'neutral'),'portal-leaders');
}

function upcomingPanel(c, next) {
  // Rounds already played but not yet watched still count as upcoming: nothing gives the result away.
  const rest = clubMatches(c.id).filter(f=>(!f.match||!resultVisible(f))&&f.id!==next?.id).slice(0,5);
  if (!rest.length) return '';
  return panel('Próximas fechas','<div class="upcoming">'+rest.map(f=>{
    const rid = f.homeId===c.id ? f.awayId : f.homeId, rk = rankOf(rid, c.division), {date} = assignment(f);
    return '<div class="upcoming-row"><small>F'+f.round+'</small>'+crest(rid)+'<span class="up-name"><strong>'+esc(nameOf(rid))+'</strong><small>'+(f.homeId===c.id?'Local':'Visitante')+(date?' · '+esc(date):'')+'</small></span><small>'+(rk?rk.pos+'º':'')+'</small></div>';
  }).join('')+'</div>',button('Fixture','page','torneo','ghost small','right'));
}

/** News of the club up to the last round whose result can be seen (no spoilers while a replay is pending). */
function clubNews(c) {
  const cutoff=pendingReplay()?.round ?? Infinity, season=world().season;
  return (world().news ?? []).filter(n=>n.clubId===c.id&&n.season===season&&n.round<cutoff);
}
function categoriesPanel(c) {
  const f=clubMatches(c.id).findLast(f=>parallelResult(f,'Intermedia'));
  if (!f) return '';
  const home=f.homeId===c.id, rival=home?f.awayId:f.homeId;
  const rows=PARALLEL_CATEGORIES.map(cat=>{const r=parallelResult(f,cat),own=home?r[0]:r[1],other=home?r[1]:r[0];
    const pos=parallelStandings(world(),c.division,cat,pendingReplay()?.round ?? Infinity).findIndex(x=>x.clubId===c.id)+1;
    return '<tr><td>'+esc(cat)+'</td><td><span class="result-chip '+(own>other?'win':own<other?'loss':'draw')+'">'+(own>other?'G':own<other?'P':'E')+'</span> '+own+' – '+other+'</td><td>'+pos+'º</td></tr>';}).join('');
  return panel('Otras categorías · fecha '+f.round,'<p class="training-note">Contra '+esc(nameOf(rival))+(home?' (local)':' (visitante)')+'</p><div class="table-wrap"><table><thead><tr><th scope="col">Categoría</th><th scope="col">Resultado</th><th scope="col">Tabla</th></tr></thead><tbody>'+rows+'</tbody></table></div>',button('Tablas','page','torneo','ghost small','right'));
}

function newsPanel(c) {
  const news=clubNews(c), last=news.at(-1)?.round;
  const items=news.filter(n=>n.round===last);
  if (!items.length) return '';
  return panel('Novedades · fecha '+last,'<ul class="news-list">'+items.map(n=>'<li class="news-'+n.kind+'">'+icon(n.kind==='injury'?'medic':n.kind==='training'?'pulse':'check')+'<span>'+esc(n.text)+'</span></li>').join('')+'</ul>',button('Centro médico','page','medico','ghost small','right'));
}
function trainingPage() {
  const c = currentClub(), focus = world().training?.[c.id] ?? 'Equilibrado';
  const seniors = c.players.filter(p=>p.squad==='Plantel superior').sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const disabled = !editable()||busy;
  // Individual session: one per round, +1 to an attribute below the player's potential.
  const next = Number.isFinite(currentRound()) ? currentRound() : null, usedSession = world().trainingRounds?.[c.id]===next;
  const tp = seniors.find(p=>p.id===trainPick&&!p.injury) ?? [...seniors].filter(p=>!p.injury).sort((a,b)=>overall(b)-overall(a))[0];
  // Session: pick a player from the list, then tap +1 on an attribute. The card shows the fitness cost first.
  const starters = new Set(lineup(c)), tpw = tp ? (Object.entries(engine.ratingWeights?.[tp.position] ?? {}).sort((a,b)=>b[1]-a[1]).map(([k])=>k)) : [];
  const attrsOrdered = tp ? Object.entries(engine.ATTRIBUTE_LABELS).sort(([a],[b])=>(tpw.indexOf(a)===-1?99:tpw.indexOf(a))-(tpw.indexOf(b)===-1?99:tpw.indexOf(b))) : [];
  const pickList = '<div class="train-pick">'+seniors.filter(p=>!p.injury).sort((a,b)=>overall(b)-overall(a)).map(p=>'<button type="button" class="train-pick-row'+(p.id===tp?.id?' selected':'')+'" data-do="train-pick" data-value="'+esc(p.id)+'"><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span><span><strong>'+esc(p.name)+'</strong><small>'+esc(positionAbbr[p.position])+(starters.has(p.id)?' · XV':'')+'</small></span><span class="fit-mini" style="--f:'+Math.round(p.fitness)+'%">'+Math.round(p.fitness)+'%</span></button>').join('')+'</div>';
  const card = !tp ? empty('No hay jugadores disponibles.','team') :
    '<div class="train-card"><div class="train-card-head"><span class="rating big-rating '+ratingTone(overall(tp))+'">'+overall(tp)+'</span><div><h3>'+esc(tp.name)+'</h3><small>'+esc(tp.position)+(starters.has(tp.id)?' · titular':'')+(playerProjection(tp)==null?'':' · proyección '+playerProjection(tp)+'/100')+'</small></div>'+
    '<div class="fit-change"><small>Físico</small><strong>'+Math.round(tp.fitness)+'%</strong>'+icon('right')+'<strong class="after">'+Math.max(35,Math.round(tp.fitness)-TRAINING_FATIGUE)+'%</strong></div></div>'+
    (starters.has(tp.id)?'<div class="notice">Es titular: si lo entrenás ahora llega al partido con '+Math.max(35,Math.round(tp.fitness)-TRAINING_FATIGUE)+'% de físico.</div>':'')+
    '<div class="train-attrs">'+attrsOrdered.map(([k,l])=>{const v=tp.attributes[k], full=!canDevelop(tp,k), key=tpw.indexOf(k)>-1&&tpw.indexOf(k)<6;
      return '<div class="train-attr'+(key?' key':'')+'"><span>'+esc(l)+'</span><span class="attr-track"><i style="width:'+(v/20*100)+'%"></i></span><strong class="'+attrTone(v)+'">'+v+'</strong>'+
        button(full?'—':'+1','train-player',tp.id+'|'+k,'small'+(full?' ghost':''),'',disabled||usedSession||full||!next)+'</div>';}).join('')+'</div>'+
    '<p class="training-note">Podés hacer una sesión por fecha. Entrenar cuesta '+TRAINING_FATIGUE+' puntos de físico y puede mejorar el atributo en 1. La edad y la cercanía a su proyección influyen en el progreso. Los atributos destacados son los más importantes para su puesto.</p></div>';
  const session = !next ? empty('No quedan fechas esta temporada.','pulse') : '<div class="train-session">'+pickList+card+'</div>';
  // Position retraining.
  const learning = c.players.filter(p=>p.retraining);
  const rp = seniors.find(p=>p.id===retrainPick) ?? seniors.find(p=>!p.retraining&&retrainOptions(p).length);
  const opts = rp && !rp.retraining ? retrainOptions(rp) : [];
  const to = opts.some(o=>o.to===retrainTo) ? retrainTo : opts[0]?.to;
  const preview = rp && to ? overall({...rp,position:to}) : null;
  const current = learning.length ? '<div class="table-wrap"><table><thead><tr><th scope="col">Jugador</th><th scope="col">Cambio</th><th scope="col">Avance</th><th scope="col">Nivel en el puesto</th><th scope="col"></th></tr></thead><tbody>'+
    learning.map(p=>{const r=p.retraining,done=r.weeksTotal-r.weeksLeft;return '<tr><td><button type="button" class="player-name" data-do="player" data-value="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong></button>'+(p.injury?'<small class="injury-tag">'+icon('medic')+'Lesionado: no avanza</small>':'')+'</td><td>'+esc(positionAbbr[p.position])+' → '+esc(positionAbbr[r.to])+'</td><td><div class="fitness-label">'+r.weeksLeft+' sem.<span class="fitness" aria-hidden="true"><i style="width:'+Math.round(100*done/r.weeksTotal)+'%"></i></span></div></td><td><span class="rating '+ratingTone(overall({...p,position:r.to}))+'">'+overall({...p,position:r.to})+'</span></td><td>'+button('Cancelar','cancel-retrain',p.id,'ghost small','',disabled)+'</td></tr>';}).join('')+'</tbody></table></div>' : '';
  const form = learning.length>=MAX_RETRAINING ? '<p class="training-note">Hay '+MAX_RETRAINING+' reconversiones en curso: es el máximo a la vez.</p>' :
    '<div class="train-form"><label>Jugador<select id="retrain-player">'+seniors.filter(p=>!p.retraining&&retrainOptions(p).length).map(p=>option(p.name+' · '+positionAbbr[p.position]+((p.positions??[]).length>1?' ('+p.positions.filter(x=>x!==p.position).map(x=>positionAbbr[x]).join(', ')+')':''),p.id,rp?.id)).join('')+'</select></label>'+
    '<label>Nuevo puesto<select id="retrain-to">'+opts.map(o=>option(o.to+' · '+o.weeks+' semanas',o.to,to)).join('')+'</select></label>'+
    button('Empezar reconversión','retrain',(rp?.id ?? '')+'|'+(to ?? ''),'primary','check',disabled||!to)+'</div>'+
    (preview!==null?'<p class="training-note">'+esc(rp.name)+': '+overall(rp)+' de '+esc(rp.position.toLowerCase())+'; en el puesto nuevo rendiría '+preview+' con sus atributos actuales.</p>':'');
  const stats = [['Plan',focus,'plantel superior'],['Sesión',usedSession?'Usada':next?'Disponible':'—','fecha '+(next ?? '—')],['Reconversiones',learning.length+'/'+MAX_RETRAINING,'en curso'],['Físico medio',Math.round(seniors.reduce((n,p)=>n+p.fitness,0)/Math.max(1,seniors.length))+'%','plantel superior']];
  return intro(c.name,'Centro de entrenamiento','Plan semanal, sesiones individuales y reconversión de puestos.')+editableNotice()+
    '<div class="stat-row train-stats">'+stats.map(([l,v,sub])=>'<div class="panel stat"><small>'+l+'</small><strong>'+esc(v)+'</strong><span class="sub">'+esc(sub)+'</span></div>').join('')+'</div>'+
    '<div class="train-layout"><div class="train-main">'+panel('Sesión individual',session,tag(usedSession?'USADA':'DISPONIBLE',usedSession?'neutral':'blue'))+'</div>'+
    '<div class="stack">'+panel('Plan del plantel superior','<div class="training-choices">'+trainingConfig.map(([name,glyph,description])=>'<button type="button" class="training-choice '+(name===focus?'active':'')+'" aria-pressed="'+(name===focus)+'" data-do="training" data-value="'+name+'"'+(disabled?' disabled':'')+'>'+icon(glyph)+'<strong>'+name+'</strong><small>'+description+'</small></button>').join('')+'</div><p class="training-note">El plan se guarda al elegirlo y hace crecer de a poco a los jugadores en desarrollo. Los juveniles tienen su propio plan en Cantera.</p>')+panel('Reconversión de puesto',current+form+'<p class="training-note">Solo entre puestos parecidos: primera línea entre sí, segunda y tercera línea, medio scrum y apertura, centros y tres cuartos. Tarda de 4 a 8 semanas (fechas); un lesionado no avanza y la pretemporada completa lo pendiente. Al terminar, el jugador puede elegirse en ese puesto.</p>',tag(learning.length+' / '+MAX_RETRAINING,'neutral'))+'</div></div>';
}

// Injury history of a player: the log kept on the player, or the news of older saves.
const injuryLog = (c,p) => p.injuries?.length ? p.injuries : (world().news ?? []).filter(n=>n.clubId===c.id&&n.kind==='injury'&&n.playerId===p.id).map(n=>({season:n.season,round:n.round,name:(n.text.split(': ')[1] ?? '').split('.')[0],weeks:+(n.text.match(/Baja estimada: (\d+)/)?.[1] ?? 0)}));
let medicalFilter = 'Todos';
function medicalPage() {
  const c=currentClub(), cutoff=pendingReplay()?.round ?? Infinity, season=world().season;
  // While a replay is pending, injuries from that round are not shown yet.
  const hidden=(p,e)=>e.season===season&&e.round>=cutoff;
  const squadOf=['M19','M17'].includes(medicalFilter)?medicalFilter:'Plantel superior';
  const rows=c.players.filter(p=>p.squad===squadOf).map(p=>{
    const log=injuryLog(c,p).filter(e=>!hidden(p,e)), current=p.injury&&!(p.injury.since>=cutoff&&season===world().season)?p.injury:null;
    return {p,log,current,thisSeason:log.filter(e=>e.season===season).length};
  }).filter(r=>medicalFilter!=='Lesionados'||r.current)
    .sort((a,b)=>(b.current?.weeksOut ?? -1)-(a.current?.weeksOut ?? -1)||b.log.length-a.log.length||a.p.name.localeCompare(b.p.name,'es'));
  const injured=rows.filter(r=>r.current).length, total=rows.reduce((n,r)=>n+r.thisSeason,0);
  const table='<div class="med-list">'+rows.map(({p,log,current,thisSeason})=>
    '<details class="med-row'+(current?' is-injured':'')+'"'+(current?' open':'')+'><summary>'+
      '<span class="med-state">'+(current?icon('medic'):icon('check'))+'</span>'+
      '<span class="med-name"><strong>'+esc(p.name)+'</strong><small>'+esc(positionAbbr[p.position] ?? p.position)+' · '+Math.round(p.fitness)+'% físico</small></span>'+
      '<span class="med-now">'+(current?'<b>'+esc(current.name)+'</b><small>'+current.weeksOut+(current.weeksOut===1?' semana':' semanas')+' afuera</small>':'<small>Disponible</small>')+'</span>'+
      '<span class="med-count" title="Lesiones esta temporada / en total"><b>'+thisSeason+'</b><small>'+log.length+' en total</small></span></summary>'+
      (log.length?'<ul class="med-history">'+log.slice().reverse().map(e=>'<li><span>'+e.season+' · Fecha '+e.round+'</span><strong>'+esc(e.name)+'</strong><small>'+(e.weeks?e.weeks+(e.weeks===1?' semana':' semanas'):'')+'</small></li>').join('')+'</ul>':'<p class="med-empty">Sin lesiones registradas.</p>')+
    '</details>').join('')+'</div>';
  return intro('Club','Centro médico','Un lesionado no puede jugar: si estaba en tu XV, lo reemplaza el mejor disponible de su puesto. Tocá un jugador para ver sus lesiones.')+
    '<div class="stat-row med-stats">'+[['Lesionados',injured,'ahora'],['Lesiones',total,'esta temporada'],['Físico medio',Math.round(c.players.filter(p=>p.squad==='Plantel superior').reduce((n,p)=>n+p.fitness,0)/Math.max(1,c.players.filter(p=>p.squad==='Plantel superior').length))+'%','plantel superior'],['Más lesionado',rows.slice().sort((a,b)=>b.thisSeason-a.thisSeason)[0]?.thisSeason?esc(rows.slice().sort((a,b)=>b.thisSeason-a.thisSeason)[0].p.name.split(' ').slice(-1)[0]):'—','esta temporada']].map(([l,v,sub])=>'<div class="panel stat"><small>'+l+'</small><strong>'+v+'</strong><span class="sub">'+sub+'</span></div>').join('')+'</div>'+
    tabs(['Todos','Lesionados','M19','M17'],medicalFilter,'medical-filter','Jugadores')+
    panel('Plantilla',rows.length?table:empty('No hay jugadores lesionados.','medic'),tag(injured+(injured===1?' lesionado':' lesionados'),injured?'blue':'neutral'));
}

function seniorGroup(p, starters) {
  return p.seniorSquad ?? (starters.includes(p.id)?'Primera':'Intermedia');
}

function playerTable(players, promote=false) {
  if (!players.length) return empty('No hay jugadores que coincidan con estos filtros.', 'team');
  const seniors = players[0].squad==='Plantel superior';
  const starters = seniors ? lineup(currentClub()) : [];
  // Tap a column header to sort by it; tap again to reverse.
  const ageNum = p => { const t=String(ageText(p)).replace('~',''); return t==='—'?999:Number(t); };
  const keys = {name:p=>p.name, team:p=>baseSquads.indexOf(seniorGroup(p,starters))*100+(starters.includes(p.id)?0:1), position:p=>engine.POSITIONS.indexOf(p.position), age:ageNum, level:p=>-overall(p), potential:p=>-(playerProjection(p) ?? 0), fitness:p=>-p.fitness};
  if (squadSort.key&&keys[squadSort.key]) { const f=keys[squadSort.key]; players=[...players].sort((a,b)=>{const x=f(a),y=f(b);return (typeof x==='string'?x.localeCompare(y,'es'):x-y)*squadSort.dir;}); }
  const th = (key,label,cls='') => '<th scope="col"'+(cls?' class="'+cls+'"':'')+' aria-sort="'+(squadSort.key===key?(squadSort.dir>0?'ascending':'descending'):'none')+'"><button type="button" class="sort-th'+(squadSort.key===key?' active':'')+'" data-do="sort" data-value="'+key+'">'+label+(squadSort.key===key?(squadSort.dir>0?' ▲':' ▼'):'')+'</button></th>';
  return '<div class="table-wrap"><table><thead><tr>'+th('name','Jugador')+(seniors?th('team','Equipo','col-team'):'')+th('position','Puesto')+th('age','Edad','col-age')+th('level','Nivel')+th('potential','Proy.','col-pot')+th('fitness','Físico','col-fit')+(promote?'<th scope="col">Gestión</th>':'')+'</tr></thead><tbody>'+
    players.map(p=>'<tr><td><button type="button" class="player-name" data-do="player" data-value="'+esc(p.id)+'">'+avatar(p)+'<span><strong>'+esc(p.name)+'</strong>'+(p.injury?'<small class="injury-tag" title="'+esc(p.injury.name)+'">'+icon('medic')+'Lesionado · '+p.injury.weeksOut+' sem.</small>':'')+(p.community?.active===false?'<small class="badge-generated" title="La comunidad indica que ya no juega en el club">Ya no está</small>':'')+(!p.fictional&&trajectoryLabel(p)?'<small class="trajectory-tag" title="'+esc(trajectoryTitle(p))+'">'+esc(trajectoryLabel(p))+'</small>':'')+'</span></button></td>'+
    (seniors?'<td class="col-team">'+esc(seniorGroup(p,starters))+(starters.includes(p.id)?' <small>· XV</small>':'')+'</td>':'')+
    '<td><span class="pos-full">'+esc(p.position)+'</span><span class="pos-short" title="'+esc(p.position)+'">'+esc(positionAbbr[p.position] ?? p.position)+'</span></td><td class="col-age">'+esc(ageText(p))+'</td><td><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span></td><td class="col-pot">'+projectionValue(p)+'</td><td class="col-fit"><div class="fitness-label">'+Math.round(p.fitness)+'%<span class="fitness" aria-hidden="true"><i style="width:'+p.fitness+'%"></i></span></div></td>'+
    (promote?'<td>'+button('Promover','promote',p.id,'small','grow',!editable()||busy)+'</td>':'')+'</tr>').join('')+'</tbody></table></div>';
}

function filteredSeniors() {
  const c = currentClub(), ids = lineup(c);
  return c.players.filter(p=>p.squad==='Plantel superior' &&
    (squad==='Plantel superior'||seniorGroup(p,ids)===squad) &&
    (!positionFilter||p.position===positionFilter) &&
    normalize(p.name).includes(normalize(playerFilter)));
}

function squadPage() {
  const c = currentClub();
  const groupTabs = ['Plantel superior', ...baseSquads];
  return intro(c.name,'Plantel','',button('Editar formación','page','tacticas','primary','field'))+
    tabs(groupTabs,squad,'squad','Planteles')+
    '<div class="toolbar"><input type="search" id="player-filter" aria-label="Buscar jugador" placeholder="Buscar por nombre" value="'+esc(playerFilter)+'"><select id="position-filter" aria-label="Filtrar por puesto">'+option('Todos los puestos','',positionFilter)+
    [...new Set(engine.POSITIONS)].map(p=>option(p,p,positionFilter)).join('')+'</select><small class="right" id="player-count">'+filteredSeniors().length+' jugadores</small></div>'+
    panel(squad,'<div id="player-results">'+playerTable(filteredSeniors())+'</div>');
}

// Flat 2D rugby shirt from the club's kit design (research/club-kits.json): pattern, colours and collar.
let kitSeq = 0;
const SHIRT_PATH = 'M21 4 9 9 2 23l9 5 4-6v34h34V22l4 6 9-5-7-14-12-5c-2 4-6 7-11 7S23 8 21 4Z';
const designOf = (c, away=false) => { const d=info(c.id)?.kitDesign, k=away&&d?.away?d.away:d?.home;
  if (k?.colors?.length) return k;
  const a=hexOk(c.color)?c.color:'#1f5f7a', b=hexOk(c.secondaryColor)?c.secondaryColor:'#ffffff'; return {pattern:'plain',colors:[a],collar:b,shorts:b,socks:a}; };
function kitPattern(d, id) {
  const [a,b=a,c3] = d.colors, cs=[a,b,c3].filter(Boolean);
  switch (d.pattern) {
    case 'hoops': return Array.from({length:8},(_,i)=>'<rect x="0" y="'+(i*8)+'" width="64" height="8" fill="'+esc(cs[i%cs.length])+'"/>').join('');
    case 'stripes': return Array.from({length:8},(_,i)=>'<rect x="'+(i*8)+'" y="0" width="8" height="64" fill="'+esc(cs[i%cs.length])+'"/>').join('');
    case 'halves': return '<rect width="32" height="64" fill="'+esc(a)+'"/><rect x="32" width="32" height="64" fill="'+esc(b)+'"/>';
    case 'quarters': return '<rect width="64" height="64" fill="'+esc(b)+'"/><rect width="32" height="30" fill="'+esc(a)+'"/><rect x="32" y="30" width="32" height="34" fill="'+esc(a)+'"/>';
    case 'sash': return '<rect width="64" height="64" fill="'+esc(a)+'"/><path d="M0 8 8 0l56 56-8 8Z" fill="'+esc(b)+'"/>';
    case 'chevron': return '<rect width="64" height="64" fill="'+esc(a)+'"/><path d="M0 18 32 34 64 18v10L32 44 0 28Z" fill="'+esc(b)+'"/>';
    default: return '<rect width="64" height="64" fill="'+esc(a)+'"/>';
  }
}
const kitShirt = (d, n='', extra='') => { const id='k'+(++kitSeq), ink=inkFor(d.colors[0]);
  return '<svg class="shirt '+extra+'" viewBox="0 0 64 60" aria-hidden="true"><defs><clipPath id="'+id+'"><path d="'+SHIRT_PATH+'"/></clipPath></defs>'+
    '<g clip-path="url(#'+id+')">'+kitPattern(d,id)+'</g><path d="'+SHIRT_PATH+'" fill="none" stroke="#0005" stroke-width="1"/>'+
    '<path d="M21 4c2 4 6 7 11 7s9-3 11-7" fill="none" stroke="'+esc(d.collar ?? ink)+'" stroke-width="3.2"/>'+
    (n!==''?'<rect x="21" y="27" width="22" height="17" rx="2" fill="#fff" opacity=".88"/><text x="32" y="40.5" text-anchor="middle" font-size="14" font-weight="800" font-family="Barlow Condensed,Arial Narrow,sans-serif" fill="#16130f">'+n+'</text>':'')+'</svg>'; };
const kitFull = d => '<svg class="kit-full" viewBox="0 0 64 100" aria-hidden="true">'+kitShirt(d).replace('<svg class="shirt " viewBox="0 0 64 60" aria-hidden="true">','<g>').replace(/<\/svg>$/,'</g>')+
  '<path d="M15 58h34l2 18H35l-3-6-3 6H13Z" fill="'+esc(d.shorts ?? '#fff')+'" stroke="#0005"/><rect x="16" y="80" width="11" height="18" rx="2" fill="'+esc(d.socks ?? d.colors[0])+'" stroke="#0005"/><rect x="37" y="80" width="11" height="18" rx="2" fill="'+esc(d.socks ?? d.colors[0])+'" stroke="#0005"/></svg>';
const shirt = (n, color, trim, extra='', c=currentClub()) => kitShirt(designOf(c), n, extra);
const kitColors = c => { const d=designOf(c), a=d.colors[0], b=d.colors[1] ?? d.collar ?? inkFor(a); return [a, colorGap(a,b)<40?inkFor(a):b]; };
// Shirt spots on a vertical pitch (attacking up): front row at the back of the pack, full-back deepest.
const shirtSpots = [[30,21],[50,19],[70,21],[38,33],[62,33],[16,38],[84,38],[50,45],[30,56],[56,60],[10,74],[34,72],[64,72],[90,74],[50,88]];
let tacticsOpen = false, swapPick = null;
function pitchLines() {
  return '<svg class="rugby-lines" viewBox="0 0 70 100" preserveAspectRatio="none" aria-hidden="true">'+
    '<rect x="3" y="3" width="64" height="94" fill="none" stroke="#fff" stroke-width=".45"/>'+
    [9,91].map(y=>'<line x1="3" x2="67" y1="'+y+'" y2="'+y+'" stroke="#fff" stroke-width=".55"/>').join('')+
    [27,73].map(y=>'<line x1="3" x2="67" y1="'+y+'" y2="'+y+'" stroke="#fff" stroke-width=".45"/>').join('')+
    '<line x1="3" x2="67" y1="50" y2="50" stroke="#fff" stroke-width=".55"/>'+
    [40,60].map(y=>'<line x1="3" x2="67" y1="'+y+'" y2="'+y+'" stroke="#fff" stroke-width=".35" stroke-dasharray="2 1.6"/>').join('')+
    [14,86].map(y=>'<line x1="3" x2="67" y1="'+y+'" y2="'+y+'" stroke="#fff" stroke-width=".3" stroke-dasharray="1.4 2.2"/>').join('')+
    [8,18,52,62].map(x=>[14,27,40,50,60,73,86].map(y=>'<line x1="'+x+'" x2="'+x+'" y1="'+(y-1.2)+'" y2="'+(y+1.2)+'" stroke="#fff" stroke-width=".3"/>').join('')).join('')+
    [9,91].map(y=>'<line x1="32.2" x2="37.8" y1="'+y+'" y2="'+y+'" stroke="#fff" stroke-width="1.1"/>').join('')+
    '</svg>';
}
function shirtButton(p, n, i, colors, selected) {
  const out = !p ? '' : p.injury ? ' injured' : '';
  return '<button type="button" class="shirt-slot'+(selected?' selected':'')+out+'" data-do="swap" data-value="'+(p?esc(p.id):'')+'" data-slot="'+i+'"'+(p?' title="'+esc(p.name+' · '+p.position+' · '+overall(p))+'"':'')+(!editable()||busy?' disabled':'')+'>'+
    shirt(n,colors[0],colors[1])+'<span class="shirt-name">'+(p?esc(p.name.split(' ').slice(-1)[0]):'—')+'</span>'+(p?'<span class="shirt-meta"><b class="'+ratingTone(overall(p))+'">'+overall(p)+'</b>'+positionAbbr[p.position]+' · '+Math.round(p.fitness)+'%</span>':'')+'</button>';
}
function tacticsPage() {
  const c = currentClub(), seniors = c.players.filter(p=>p.squad==='Plantel superior');
  const t = {...engine.DEFAULT_TACTICS, ...(tacticDraft ?? world().tactics[c.id] ?? {})}, ids = lineupDraft ?? lineup(c);
  const pending = tacticDraft || lineupDraft, colors = kitColors(c);
  const byId = id => seniors.find(p=>p.id===id);
  // Bench of 8 with cover for every unit (as a real matchday 23): hooker, prop, lock, back row, scrum-half,
  // fly-half or centre, back three, then the best player left.
  const pool = seniors.filter(p=>!ids.includes(p.id)&&!p.injury).sort((a,b)=>overall(b)-overall(a)), bench=[];
  for (const need of [['Hooker'],['Pilar izquierdo','Pilar derecho'],['Segunda línea'],['Ala','Número 8'],['Medio scrum'],['Apertura','Centro'],['Wing','Fullback'],null]) {
    const pick = pool.find(p=>!bench.includes(p)&&(!need||need.some(pos=>engine.canPlay(p,pos)))); if (pick) bench.push(pick);
  }
  const rest = seniors.filter(p=>!ids.includes(p.id)&&!bench.includes(p)).sort((a,b)=>a.position.localeCompare(b.position,'es')||overall(b)-overall(a));
  const pickedSlot = swapPick?.slot, pickedId = swapPick?.id;
  const level = Math.round(ids.map(byId).filter(Boolean).reduce((n,p)=>n+overall(p),0)/15);
  const summary = [t.mentality ?? 'Equilibrada', t.attack, t.defense, 'Pie '+t.kicking.toLowerCase(), 'Penales: '+t.penalty].join(' · ');
  const drawer = tacticsOpen ? '<div class="drawer-scrim" data-do="tactics-panel"></div><aside class="tactics-drawer" aria-label="Tácticas"><header><h3>Tácticas</h3>'+button('','tactics-panel','','ghost small','close')+'</header>'+
    [['juego','Plan de juego'],['parada','Pelota parada']].map(([group,title])=>'<h4>'+title+'</h4>'+tacticsConfig.filter(x=>x[2]===group).map(([key,label,,options])=>'<div class="tactic-option"><label>'+label+'</label><div class="segmented" role="group" aria-label="'+label+'">'+options.map(([v])=>'<button type="button" class="'+(t[key]===v?'active':'')+'" aria-pressed="'+(t[key]===v)+'" data-do="tactic" data-value="'+esc(key+'|'+v)+'"'+(!editable()||busy?' disabled':'')+'>'+esc(v)+'</button>').join('')+'</div><p>'+esc(options.find(([v])=>v===t[key])?.[1] ?? '')+'</p></div>').join('')).join('')+
    '<div class="drawer-foot">'+button('Guardar tácticas','save-tactics','','primary','check',!editable()||busy||!tacticDraft)+'<p class="training-note">Ninguna opción es mejor siempre: contra un rival parejo, cada una mueve el resultado en menos de dos puntos.</p></div></aside>' : '';
  return '<header class="page-intro tactics-head"><div><h1>Formación</h1><p>'+esc(summary)+'</p></div><div class="action-row">'+
      button('Tácticas','tactics-panel','','primary','target')+'</div></header>'+editableNotice()+
    (pending?'<div class="notice unsaved save-bar"><span>Cambios sin guardar</span><span class="action-row">'+button('Descartar','discard-tactics','','ghost small')+(tacticDraft?button('Guardar tácticas','save-tactics','','primary small','check',!editable()||busy):'')+(lineupDraft?button('Guardar XV','save-lineup','','primary small','check',!editable()||busy):'')+'</span></div>':'')+
    '<div class="formation-layout"><section class="formation-board">'+
      '<div class="board-top"><span>'+icon('field')+' XV titular · nivel '+level+'</span><small>'+(swapPick?'Elegí con quién cambiarlo':'Tocá una camiseta y después otra o un suplente para cambiarlos')+'</small></div>'+
      '<div class="rugby-pitch">'+pitchLines()+'<span class="pitch-brand">'+esc(c.shortName ?? c.name)+'</span>'+
        ids.map((id,i)=>{const [x,y]=shirtSpots[i];return '<div class="shirt-spot" style="left:'+x+'%;top:'+y+'%">'+shirtButton(byId(id),i+1,i,colors,pickedSlot===i)+'</div>';}).join('')+'</div>'+
      '<div class="bench-row"><h4>Suplentes</h4><div class="bench-line">'+bench.map((p,k)=>shirtButton(p,16+k,'',colors,pickedId===p.id&&pickedSlot===undefined)).join('')+'</div></div>'+
    '</section>'+
    '<aside class="panel squad-side"><header class="panel-head"><h3>Resto del plantel</h3></header><div class="squad-pick">'+
      rest.map(p=>'<button type="button" class="squad-pick-row'+(pickedId===p.id&&pickedSlot===undefined?' selected':'')+(p.injury?' injured':'')+'" data-do="swap" data-value="'+esc(p.id)+'" data-slot=""'+(!editable()||busy||p.injury?' disabled':'')+'><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.position)+(p.injury?' · lesionado':' · '+Math.round(p.fitness)+'%')+'</small></span></button>').join('')+
    '</div></aside></div>'+drawer;
}

const youthIcons = {Integral:'grow',Técnica:'target',Física:'pulse',Contacto:'shield',Juego:'field'};
function academy() {
  const c = currentClub(), youth = c.players.filter(p=>p.squad===youthSquad);
  const focus = world().training?.[c.id] ?? 'Equilibrado', plan = world().youthTraining?.[c.id] ?? 'Integral';
  const cutoff = pendingReplay()?.round ?? Infinity;
  const place = cat => { const rows=parallelStandings(world(),c.division,cat,cutoff), i=rows.findIndex(r=>r.clubId===c.id); return rows[i]?.played ? (i+1)+'º de '+rows.length+' · '+rows[i].points+' pts' : 'Sin partidos'; };
  const juniors = c.players.filter(p=>p.squad==='M19'||p.squad==='M17');
  // Prospects: the highest ceiling first, then the current level.
  const prospects = [...juniors].sort((a,b)=>(playerProjection(b) ?? overall(b))-(playerProjection(a) ?? overall(a))).slice(0,5);
  const intake=c.players.filter(p=>p.academyIntakeSeason===world().season&&p.academyEntry==='intake');
  const intakePanel=intake.length?panel('Camada '+world().season,'<div class="academy-intake">'+intake.map(p=>'<button type="button" class="player-name" data-do="player" data-value="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><small>'+esc(p.position)+' · '+esc(p.squad)+'</small></button>').join('')+'</div>',tag(intake.length+' incorporaciones','neutral')):'';
  return intro(c.name,'Cantera','Desarrollá juveniles, seguí sus torneos y promovelos al plantel superior.')+editableNotice()+
    '<div class="academy-cards">'+
    ['M19','M17'].map(s=>'<button class="panel academy-card" type="button" data-do="youth" data-value="'+s+'"><small>'+s+'</small><div class="display">'+c.players.filter(p=>p.squad===s).length+'</div><p>'+esc(place(s))+'</p></button>').join('')+
    '<div class="panel academy-card"><small>PLAN JUVENIL</small><div class="display training-title">'+esc(plan)+'</div><p>'+esc(YOUTH_PLANS[plan]?.text ?? '')+'</p></div></div>'+
    panel('Plan juvenil','<div class="training-choices youth-plans">'+Object.entries(YOUTH_PLANS).map(([name,{text}])=>'<button type="button" class="training-choice '+(name===plan?'active':'')+'" aria-pressed="'+(name===plan)+'" data-do="youth-training" data-value="'+esc(name)+'"'+(!editable()||busy?' disabled':'')+'>'+icon(youthIcons[name])+'<strong>'+esc(name)+'</strong><small>'+esc(text)+'</small></button>').join('')+'</div><p class="training-note">Los juveniles pueden mejorar después de cada fecha. La asistencia a partidos, la edad y el plan influyen en la evolución. Contacto prioriza forwards. Técnica y Juego priorizan backs. Integral reparte el trabajo según el puesto.</p>')+
    '<div class="two-col spaced">'+
    panel('Promesas',prospects.length?'<div class="table-wrap"><table><thead><tr><th scope="col">Jugador</th><th scope="col">Cat.</th><th scope="col">Puesto</th><th scope="col">Nivel</th><th scope="col">Proy.</th></tr></thead><tbody>'+prospects.map(p=>'<tr><td><button type="button" class="player-name" data-do="player" data-value="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong></button></td><td>'+esc(p.squad)+'</td><td>'+esc(positionAbbr[p.position] ?? p.position)+'</td><td><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span></td><td>'+projectionValue(p)+'</td></tr>').join('')+'</tbody></table></div>':empty('No hay juveniles en el club.','grow'),tag('Proyección','neutral'))+
    panel('Torneo '+youthSquad+' · '+c.division,standingsTable(c.division,true,youthSquad),button('Tabla completa','page','torneo','ghost small','right'))+
    '</div>'+
    (intakePanel?'<div class="spaced">'+intakePanel+'</div>':'')+
    '<div class="spaced">'+tabs(['M19','M17'],youthSquad,'youth','Divisiones juveniles')+
    panel('Plantel '+youthSquad,playerTable(youth,youthSquad==='M19'),tag('Desarrollo','neutral'))+'</div>';
}

function parallelFixtureList(fixtures, cat) {
  if (!fixtures.length) return empty('No hay partidos en este filtro.', 'calendar');
  return fixtures.map(f=>{const r=parallelResult(f,cat);
    return '<div class="fixture-row"><small>'+esc(roundLabel(f))+'</small>'+clubCell(f.homeId,'home')+
      '<div class="fixture-score">'+(r?r[0]+' – '+r[1]:'VS')+'</div>'+clubCell(f.awayId)+
      tag(r?(r[2]+'–'+r[3]+' tries'):(world().parallel?.results?.[f.id]?'Reservado':'Pendiente'),'neutral')+'</div>';}).join('');
}

function fixtureList(fixtures) {
  if (!fixtures.length) return empty('No hay partidos en este filtro.', 'calendar');
  const pending=pendingReplay();
  return fixtures.map(f=>{
    const {venue,referee,date}=assignment(f);
    const visible=resultVisible(f,pending?.round ?? Infinity);
    return '<div class="fixture-row"><small>'+esc(roundLabel(f))+'</small>'+clubCell(f.homeId,'home')+
      '<div class="fixture-score">'+(visible?f.match.homeScore+' – '+f.match.awayScore:'VS')+'</div>'+clubCell(f.awayId)+
      ((visible&&hasReplay(f))||f.id===pending?.id?button('Replay','replay',f.id,'small','play'):tag(visible?'Sin repetición':f.match?'Reservado':'Pendiente','neutral'))+
      '<div class="fixture-location">'+[date,venue ?? nameOf(f.homeId)].filter(Boolean).map(esc).join(' · ')+(referee?' · Árbitro asignado en juego: '+esc(referee):'')+'</div></div>';
  }).join('');
}

function tournament() {
  const division = selectedDivision ?? currentClub().division, cat = tournamentCategory;
  const maxRound = Math.max(1,...world().fixtures.filter(f=>f.division===division).map(f=>f.round));
  const pending=pendingReplay();
  const round = tournamentRound ?? pending?.round ?? (Number.isFinite(currentRound())?currentRound():maxRound);
  const filtered = world().fixtures.filter(f=>f.division===division && (tournamentClub?(f.homeId===tournamentClub||f.awayId===tournamentClub):f.round===round)).sort((a,b)=>a.round-b.round);
  return intro('COMPETICIONES URBA','Torneo','Resultados y calendario de la temporada.',tag('TEMPORADA '+world().season,'neutral'))+

    tabs(divisions,division,'division','División del torneo')+
    tabs(['Primera',...PARALLEL_CATEGORIES],cat,'category','Categoría')+
    (tournamentMode==='Posiciones'
      ?(cat==='Primera'?playoffBracket(division):'')+panel('Tabla · '+division+(cat==='Primera'?'':' · '+cat),standingsTable(division,false,cat)+(cat==='Primera'?zoneLegend(division):''))+'<p class="training-note spaced">Victoria 4 pts · Empate 2 pts · Bonus por marcar al menos tres tries más que el rival o perder por hasta siete puntos.'+(cat==='Primera'?'':' '+cat+' juega el mismo fixture que Primera y se simula con la fuerza de su plantel, sin repetición.')+'</p>'
      :'<div class="toolbar"><select id="fixture-club" aria-label="Fixture por club">'+option('Todos los clubes','',tournamentClub)+
      world().clubs.filter(c=>c.division===division).map(c=>option(c.name,c.id,tournamentClub)).join('')+'</select>'+
      (tournamentClub?'':'<select id="fixture-round" aria-label="Fecha del fixture">'+Array.from({length:maxRound},(_,i)=>option(roundName(i+1,division),i+1,round)).join('')+'</select>')+'</div>'+
      panel((tournamentClub?'Calendario · '+nameOf(tournamentClub):roundName(round,division))+(cat==='Primera'?'':' · '+cat),cat==='Primera'?fixtureList(filtered):parallelFixtureList(filtered.filter(f=>!f.stage),cat),tag(filtered.some(f=>f.date)?'Fixture oficial 2026':'Fixture simulado','neutral')));
}

// Local market: players of clubs without a manager. Amateur rugby, nobody is paid: they move for minutes and closeness.
let marketTab = 'Buscar jugadores', marketLimit = 40;
const marketQuery = {offer:'',text:'',position:'',division:'',club:'',min:'',distance:'',role:'',sort:'best'};
const interestTone = x => x>=.45?'r-elite':x>=.25?'r-good':x>=.12?'r-ok':'r-poor';
const interestLabel = x => x>=.45?'Alto':x>=.25?'Medio':x>=.12?'Bajo':'Muy bajo';
function marketRows() {
  const c = currentClub(), term = normalize(marketQuery.text);
  const rows = marketPlayers(world(), c.id, marketQuery.offer||undefined).filter(r=>(!term||normalize(r.player.name).includes(term))&&(!marketQuery.position||r.player.position===marketQuery.position)&&
    (!marketQuery.division||r.division===marketQuery.division)&&(!marketQuery.club||r.clubId===marketQuery.club)&&(!marketQuery.min||overall(r.player)>=+marketQuery.min)&&
    (!marketQuery.distance||(r.distance ?? 999)<=+marketQuery.distance)&&(!marketQuery.role||(marketQuery.role==='reserva'?r.now!=='XV':r.now===marketQuery.role)));
  const by = {best:(a,b)=>b.chance*overall(b.player)-a.chance*overall(a.player), interest:(a,b)=>b.chance-a.chance||overall(b.player)-overall(a.player), level:(a,b)=>overall(b.player)-overall(a.player), distance:(a,b)=>(a.distance ?? 999)-(b.distance ?? 999)};
  return rows.sort(by[marketQuery.sort] ?? by.interest);
}
function marketTable() {
  const c = currentClub(), rows = marketRows(), round = currentRound(), t = world().transfers ?? {};
  const used = t.contacts?.[c.id]===world().season+'-'+round, refused = new Set(t.refused?.[c.id] ?? []);
  const full = c.players.filter(p=>p.squad==='Plantel superior').length>=SQUAD_LIMIT;
  if (!rows.length) return empty('Ningún jugador coincide con estos filtros.','search');
  return '<div class="table-wrap"><table class="market-table"><thead><tr><th>Jugador</th><th>Club</th><th class="col-d">Juega en</th><th>Puesto</th><th>Nivel</th><th class="col-d">Distancia</th><th>Interés</th><th></th></tr></thead><tbody>'+
    rows.slice(0,marketLimit).map(r=>{const p=r.player, age=ageText(p);
      return '<tr><td><button type="button" class="player-name" data-do="player" data-value="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong></button><small class="block">'+(age==='—'?'Edad —':esc(age)+' años')+'</small></td>'+
      '<td>'+clubCell(r.clubId,'small')+'<small class="block">'+esc(r.division)+'</small></td>'+
      '<td class="col-d">'+esc(r.now)+' <small>→ '+esc(r.then)+'</small></td>'+
      '<td><span class="pos-full">'+esc(p.position)+'</span><span class="pos-short">'+esc(positionAbbr[p.position] ?? p.position)+'</span></td>'+
      '<td><span class="rating '+ratingTone(overall(p))+'">'+overall(p)+'</span></td>'+
      '<td class="col-d">'+(r.distance===null?'—':r.distance+' km')+'</td>'+
      '<td><div class="interest"><span class="rating '+interestTone(r.chance)+'">'+Math.round(r.chance*100)+'%</span><small>'+interestLabel(r.chance)+'</small></div></td>'+
      '<td>'+(refused.has(p.id)?'<small>Dijo que no</small>':button('Contactar','contact-player',p.id+'|'+(marketQuery.offer||''),'small','link',!editable()||busy||used||full||!Number.isFinite(round)))+'</td></tr>';}).join('')+
    '</tbody></table></div>'+(rows.length>marketLimit?'<div class="panel-body center">'+button('Ver más ('+(rows.length-marketLimit)+')','market-more','','ghost small')+'</div>':'');
}
function patchMarket() { const el=document.querySelector('#market-results'); if (el) { el.innerHTML=marketTable(); const n=document.querySelector('#market-count'); if (n) n.textContent=marketRows().length+' jugadores'; } }
function market() {
  const c = currentClub();
  const intro_ = intro(c.name,'Mercado','Los jugadores consideran el rol, los minutos y la cercanía del club.');
  if (marketTab!=='Buscar jugadores') return intro_+returnsMarket();
  const round = currentRound(), t = world().transfers ?? {}, used = t.contacts?.[c.id]===world().season+'-'+round;
  const others = world().clubs.filter(x=>x.id!==c.id&&!(world().managedClubs ?? []).includes(x.id)).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const sel = (key,label,opts) => '<select data-market="'+key+'" aria-label="'+label+'">'+opts.map(([l,v])=>option(l,v,marketQuery[key])).join('')+'</select>';
  const moves = (world().news ?? []).filter(n=>n.kind==='transfer'&&n.clubId===c.id&&n.season===world().season).slice(-8).reverse();
  return intro_+editableNotice()+
    '<div class="notice blue">'+icon('swap')+' Un contacto por fecha y hasta 4 incorporaciones por temporada. El interés sube si el club queda cerca, si en tu plantel jugaría más que en el suyo (de Pre A o Pre B a tu XV) y si sube de división; baja con la edad. Si dice que no, no se lo puede volver a contactar en la temporada. Los clubes con manager no se pueden tocar.'+(used?' <strong>Ya hiciste el contacto de esta fecha.</strong>':'')+'</div>'+
    '<div class="offer-bar"><span>'+icon('swap')+'<strong>Rol que le ofrecés</strong></span>'+[['','Según su nivel'],['XV','Titular en el XV'],['Primera','Plantel de Primera'],['Intermedia','Intermedia'],['Pre A','Pre A']].map(([v,l])=>'<button type="button" class="chip'+(marketQuery.offer===v?' active':'')+'" data-do="market-offer" data-value="'+v+'">'+l+'</button>').join('')+'<small>Prometer más de lo que va a jugar ayuda, pero solo te creen la mitad.</small></div>'+
    '<div class="toolbar market-filters"><input type="search" id="market-text" placeholder="Buscar jugador" aria-label="Buscar jugador" value="'+esc(marketQuery.text)+'">'+
    sel('position','Puesto',[['Todos los puestos',''],...[...new Set(engine.POSITIONS)].map(p=>[p,p])])+
    sel('division','División',[['Todas las divisiones',''],...divisions.map(d=>[d,d])])+
    sel('club','Club',[['Todos los clubes',''],...others.map(x=>[x.name,x.id])])+
    sel('min','Nivel',[['Cualquier nivel',''],['50 o más','50'],['60 o más','60'],['70 o más','70'],['75 o más','75']])+
    sel('distance','Distancia',[['Cualquier distancia',''],['Hasta 10 km','10'],['Hasta 20 km','20'],['Hasta 40 km','40']])+
    sel('role','Juega en',[['Cualquier equipo',''],['Fuera del XV','reserva'],['Pre A','Pre A'],['Pre B','Pre B'],['Intermedia','Intermedia']])+
    sel('sort','Ordenar',[['Mejor opción','best'],['Más interesados','interest'],['Mejor nivel','level'],['Más cerca','distance']])+
    '<small class="right" id="market-count">'+marketRows().length+' jugadores</small></div>'+
    panel('Jugadores','<div id="market-results">'+marketTable()+'</div>')+
    (moves.length?'<div class="spaced">'+panel('Movimientos de la temporada','<ul class="news-list">'+moves.map(n=>'<li class="news-transfer">'+icon(n.text.includes('no aceptó')?'close':'swap')+'<span>'+esc(n.text)+'</span></li>').join('')+'</ul>')+'</div>':'');
}

function returnsMarket() {
  const c = currentClub();
  const observed = catalog.returns.players.filter(p=>p.eligibleForGameMarket&&p.status==='exterior');
  const overseas = (world().overseasCareers ?? []).filter(row=>row.originClubId===c.id);
  const candidates = (world().returnCandidates ?? []).flatMap(candidate=>{
    if (candidate.homeClubId!==c.id) return [];
    if (candidate.origin==='simulated') {
      const career=overseas.find(row=>row.player.id===candidate.player.id);
      return career?[{candidate,record:{originClub:c.name,currentClub:career.destination?.competition,currentCountry:career.destination?.country},simulated:true}]:[];
    }
    if (candidate.player.fictional) return [];
    const record=observed.find(p=>p.originClubId===c.id&&normalize(p.name)===normalize(candidate.player.name));
    return record?[{candidate,record,simulated:false}]:[];
  });
  const contactRound=clubMatches().find(f=>!f.match)?.round ?? Infinity;
  const roundContact=(world().returnCandidates ?? []).some(candidate=>candidate.homeClubId===c.id&&candidate.lastContactRound===contactRound);
  return '<div class="notice blue">La etapa de carrera y el nivel del jugador influyen en la respuesta al contacto.</div>'+editableNotice()+
    (candidates.length?'<div class="market-grid">'+candidates.map(({candidate,record,simulated})=>{
      const p=candidate.player, age=ageText(p), ready=candidate.status==='ready', signed=candidate.status==='signed';
      const contacted=candidate.lastContactRound===contactRound;
      const canContact=candidate.contactable!==false;
      const willingness=Number.isFinite(candidate.willingness)?Math.round(candidate.willingness)+'%':'—';
      return '<section class="panel market-player">'+tag(signed?'Incorporado':ready?'Dispuesto a volver':'En seguimiento')+(simulated?tag('Carrera simulada','neutral'):'')+
        '<h2>'+esc(p.name)+'</h2><p>'+esc(p.position)+' · '+(age==='—'?'Edad sin dato':age+' años')+'</p>'+
        '<dl class="market-facts"><div><dt>Club de origen</dt><dd>'+esc(record.originClub)+'</dd></div>'+
        '<div><dt>En el exterior</dt><dd>'+esc([record.currentClub,record.currentCountry].filter(Boolean).join(' · '))+'</dd></div>'+
        '<div><dt>Predisposición</dt><dd>'+willingness+'</dd></div></dl>'+
        '<div class="market-meta"><span class="rating">'+overall(p)+'</span><small>Nivel proyectado para el puesto · /100</small></div>'+
        '<p class="spaced">'+esc(candidate.note)+'</p>'+
        (candidate.lastContactRound?'<p>Último contacto · Fecha '+candidate.lastContactRound+'</p>':'')+
        button('Ver perfil','player',p.id,'ghost','team')+
        (signed?'':ready?button('Incorporar al plantel','sign-return',candidate.id,'primary','return',!editable()||busy):
          button(contacted?'Contactado en esta fecha':!canContact?'Contacto no disponible':roundContact?'Ya contactaste a un jugador':'Contactar','contact-return',candidate.id,'primary','link',!editable()||busy||!canContact||roundContact||!Number.isFinite(contactRound)))+'</section>';
    }).join('')+'</div>':panel('Oportunidades para '+c.name,empty('Tu club no tiene regresos disponibles en esta temporada.', 'return')))+
    (overseas.length?'<div class="spaced">'+panel('Trayectorias simuladas en el exterior','<div class="list-cards">'+overseas.map(row=>
      '<article><button type="button" class="player-name" data-do="player" data-value="'+esc(row.player.id)+'"><strong>'+esc(row.player.name)+'</strong></button><small>'+
      esc(overseasDestination(row))+' · '+row.departedSeason+' · '+(row.status==='returned'?'Regresó':row.status==='retired'?'Retirado':'En el exterior')+'</small></article>').join('')+'</div>')+'</div>':'')+
    '<div class="spaced">'+
    panel('Jugadores en el exterior','<div class="list-cards">'+observed.map(p=>
      '<article><strong>'+esc(p.name)+'</strong><small>'+esc(p.originClub)+' · '+esc([p.currentClub,p.currentCountry].filter(Boolean).join(', '))+'</small></article>').join('')+'</div>')+
    '</div>';
}

function clubPage() {
  const c = currentClub(), d = info();
  const kits = d.kits ? [['Titular',d.kits.home],['Alternativa',d.kits.away]].filter(([,item])=>item) : [];
  const history = d.historical2026;
  const values = [['Sede',d.venue?.name],['Dirección',d.venue?.address],['Localidad',d.city],['Fundación',/^\d{4}-\d{2}-\d{2}$/.test(d.founded ?? '')?d.founded.split('-').reverse().join('/'):d.founded],['Capitán',d.captain],['Fuerza',strength(c)+'/100'],['División',c.division]].filter(([,v])=>v);
  const won = (world().honours ?? []).filter(h=>h.clubId===c.id);
  const urba = d.honours?.urbaTitles ?? 0, top = won.filter(h=>h.division==='Top 14');
  const others = (world().parallel?.champions ?? []).filter(h=>h.clubId===c.id);
  const obj = clubObjective(world(), c.id), rank = rankOf(c.id, c.division);
  const onTrack = rank ? rank.pos<=obj.target : null;
  const trophy = (n,label,sub) => '<div class="trophy"><span class="trophy-icon">'+icon('trophy')+'</span><strong>'+n+'</strong><span>'+esc(label)+'</span>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';
  const honours = '<div class="trophies">'+
    trophy(urba+top.length,'Campeonatos URBA',(top.length?top.length+' en la partida · ':'')+(top.at(-1)?.season ?? d.honours?.lastTitle ? 'último: '+(top.at(-1)?.season ?? d.honours.lastTitle) : 'sin títulos todavía'))+
    trophy(won.filter(h=>h.division!=='Top 14').length,'Títulos de Primera A/B',won.filter(h=>h.division!=='Top 14').map(h=>h.season+' · '+h.division).join(', ') || 'en la partida')+
    trophy(others.length,'Otras categorías',others.length ? [...new Set(others.map(h=>h.category))].join(', ') : 'Intermedia, Pre A, Pre B, M19, M17')+
    '</div>';
  const objective = '<div class="objective"><div class="objective-level lvl-'+normalize(obj.level)+'"><small>Exigencia</small><strong>'+esc(obj.level)+'</strong></div>'+
    '<div class="objective-text"><strong>'+esc(obj.text)+'</strong><small>La comisión directiva espera que termines '+(obj.target===2?'1º o 2º':'entre los '+obj.target+' primeros')+' de '+obj.n+'. El plantel es el '+obj.rank+'º más fuerte de '+esc(c.division)+'.</small>'+
    '<span class="objective-status '+(onTrack===null?'':onTrack?'ok':'bad')+'">'+(onTrack===null?'Todavía sin partidos':onTrack?'Vas '+rank.pos+'º: cumpliendo':'Vas '+rank.pos+'º: por debajo del objetivo')+'</span></div></div>';
  return intro('Club',c.name,[d.venue?.name,d.city].filter(Boolean).join(' · '),button('Explorar clubes','explorer','','ghost','shield'))+
    '<section class="panel club-detail-header">'+crest(c.id)+'<div><div class="eyebrow">'+esc(c.division)+(d.founded?' · Fundado en '+esc(d.founded):'')+'</div><h2>'+esc(c.name)+'</h2></div></section>'+
    '<div class="two-col spaced">'+panel('Datos del club','<dl class="info-list club-info">'+values.map(([key,value])=>'<div><dt>'+key+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>')+
      '<div class="stack">'+panel('Objetivo de la temporada',objective,tag('TEMPORADA '+world().season,'neutral'))+panel('Palmarés',honours)+'</div></div>'+
    (history?'<div class="spaced">'+panel('Temporada 2026 real','<dl class="info-list club-info row4"><div><dt>Posición</dt><dd>'+history.rank+'º</dd></div><div><dt>PJ · G · E · P</dt><dd>'+history.played+' · '+history.wins+' · '+history.draws+' · '+history.losses+'</dd></div><div><dt>Puntos</dt><dd>'+history.tablePoints+'</dd></div></dl>')+'</div>':'')+
    '<div class="spaced">'+panel('Camisetas','<div class="panel-body kit-grid flat-kits">'+[['Titular',designOf(c),d.kits?.home],['Alternativa',d.kitDesign?.away?designOf(c,true):null,d.kits?.away]].filter(([,kit,record])=>kit||record).map(([label,kit,record])=>{
      // Flat 2D kits drawn from research/club-kits.json (the user prefers them to the old 3D illustrations).
      return '<article class="kit">'+(kit?kitFull(kit):'')+
        '<h3>'+label+'</h3>'+(record?.description?'<p>'+esc(record.description)+'</p>':'')+'</article>';
    }).join('')+'</div>')+'</div>';
}

function availableClubOptions(selected) {
  return divisions.map(division=>'<optgroup label="'+division+'">'+demo.clubs.filter(c=>c.division===division)
    .sort((a,b)=>a.name.localeCompare(b.name,'es')).map(c=>option(c.name,c.id,selected)).join('')+'</optgroup>').join('');
}

const demoDescription = () => esc(nameOf(demoClubId))+' · temporada '+demo.season;
const demoBox = () => panel('Partida offline','<div class="panel-body demo-box"><p>Se guarda en este navegador. '+demoDescription()+'.</p>'+button('Empezar de nuevo','reset-demo','','ghost small','return',busy)+'</div>')+'<div class="spaced"></div>';

function authForm(kind) {
  const login = kind==='login';
  return '<form class="panel-body" data-auth="'+kind+'">'+
    (login?'<div class="field"><label for="log-user">Usuario o mail</label><input id="log-user" name="login" autocomplete="username" required></div>'+
      '<div class="field"><label for="log-pass">Contraseña</label><input id="log-pass" name="password" type="password" autocomplete="current-password" required></div>':
      '<div class="field"><label for="reg-user">Usuario</label><input id="reg-user" name="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_.]{3,20}" autocomplete="username" required></div>'+
      '<div class="field"><label for="reg-mail">Mail</label><input id="reg-mail" name="email" type="email" autocomplete="email" required></div>'+
      '<div class="field"><label for="reg-pass">Contraseña</label><input id="reg-pass" name="password" type="password" minlength="8" autocomplete="new-password" required></div>')+
    '<button type="submit" class="btn primary"'+(busy?' disabled':'')+'>'+icon(login?'link':'check')+(login?'Iniciar sesión':'Crear cuenta')+'</button></form>';
}

function leagueOptions() {
  const form = (kind,fields,label)=>'<form class="panel-body" data-league-form="'+kind+'">'+fields+
    '<div class="field"><label for="'+kind+'-nickname">Nombre del mánager</label><input id="'+kind+'-nickname" name="nickname" maxlength="32" value="'+esc((me.name??'').slice(0,32))+'" required></div>'+
    '<div class="field"><label for="'+kind+'-club">Club</label><select id="'+kind+'-club" name="clubId">'+availableClubOptions(defaultClub)+'</select></div>'+
    '<button type="submit" class="btn primary"'+(busy?' disabled':'')+'>'+icon(kind==='create'?'shield':'link')+label+'</button></form>';
  const create = '<div class="field"><label for="league-name">Nombre de la liga</label><input id="league-name" name="name" maxlength="60" required></div>';
  const join = '<div class="field"><label for="league-code">Código de invitación</label><input id="league-code" name="code" maxlength="12" pattern="[a-fA-F0-9]{12}" placeholder="12 caracteres" value="'+invitationCode()+'" spellcheck="false" autocapitalize="characters" required></div>';
  const list = savedLeagues.length?savedLeagues.map(l=>'<div class="member-row">'+crest(l.clubId)+'<div><strong>'+esc(l.name)+'</strong><small>'+esc(nameOf(l.clubId))+'</small></div>'+button('Abrir liga','open-league',l.code,'small','right',busy)+'</div>').join(''):
    leagueListState==='loading'?'<p class="panel-body">Cargando tus ligas…</p>':leagueListState==='error'?'<div class="panel-body"><p>No se pudieron cargar tus ligas.</p>'+button('Reintentar','retry-leagues','','ghost small','return')+'</div>':
    empty('Todavía no participás en ninguna liga.','link');
  return '<div id="saved-leagues">'+panel('Mis ligas',list)+'</div><div class="two-col spaced">'+panel('Crear liga privada',form('create',create,'Crear liga'))+panel('Unirme a una liga',form('join',join,'Unirme'))+'</div>';
}

function entryScreen() {
  let title, body;
  if (entryStage==='auth') {
    title=offline?'Perfil local':'Iniciá sesión';
    body=offline?panel('Tu perfil en este navegador','<form class="panel-body" id="local-profile"><div class="field"><label for="local-name">Nombre del perfil</label><input id="local-name" name="nickname" maxlength="32" autocomplete="nickname" required></div><button type="submit" class="btn primary">Continuar</button></form>'):
      '<div class="entry-auth">'+tabs(['Iniciar sesión','Crear cuenta'],authKind==='login'?'Iniciar sesión':'Crear cuenta','entry-auth','Acceso')+
      panel(authKind==='login'?'Ingresá a tu cuenta':'Registrá tu cuenta',authForm(authKind))+'</div>';
  } else if (entryStage==='mode') {
    title='Elegí cómo jugar';
    body='<div class="two-col entry-modes">'+
      panel('Modo offline','<div class="panel-body prose"><p>'+(hasDemoSave?'Tu partida guardada · '+demoDescription()+'.':'Dirigí un club en una partida que se guarda en este navegador.')+'</p>'+
      button(hasDemoSave?'Continuar partida':'Jugar offline','entry-offline','','primary','play',busy)+'</div>')+
      panel('Liga con amigos','<div class="panel-body prose"><p>'+(offline?'Las ligas están disponibles en la versión web con servidor.':'Creá una liga privada, unite con un código o retomá una liga existente.')+'</p>'+
      (offline?'':button('Abrir ligas','entry-online','','primary','team',busy))+'</div>')+'</div>';
  } else if (entryStage==='offline') {
    title='Prepará tu partida offline';
    body=panel('Mánager y club','<form class="panel-body" id="offline-setup"><div class="field"><label for="offline-name">Nombre del mánager</label><input id="offline-name" name="nickname" maxlength="32" value="'+esc((demoManager||me.name||localProfile()||'').slice(0,32))+'" required></div><div class="field"><label for="offline-club">Club</label><select id="offline-club" name="clubId">'+availableClubOptions(demoClubId)+'</select></div><button type="submit" class="btn primary">Entrar al menú</button></form>');
  } else {
    title='Liga con amigos';
    body=leagueOptions();
  }
  const controls = entryStage==='auth'?'':entryStage==='mode'?
    button(offline?'Cambiar perfil':'Cerrar sesión',offline?'reset-local-profile':'logout','','ghost small','close',busy):
    button('Volver a los modos','entry-mode','','ghost small','return',busy);
  return '<div class="app-shell modern-manager entry-shell"><header class="clubbar"><div class="clubbar-row"><strong class="entry-brand">Rugby Manager 27</strong>'+
    '<button class="icon-btn theme-toggle" type="button" data-do="theme" aria-label="Cambiar tema">'+icon(theme()==='dark'?'sun':'moon')+'</button></div></header>'+
    '<main class="content entry-content"><header class="page-intro"><h1 tabindex="-1" id="entry-title">'+title+'</h1>'+controls+'</header>'+body+contactFooter()+'</main></div>';
}
function leaguePage() {
  if (league) {
    const own = myMember(), allReady = league.members.every(m=>m.ready);
    const pending=pendingReplay();
    const round = pending?.round ?? currentRound(), next = Number.isFinite(round);
    return intro('MULTIJUGADOR PRIVADO',league.name,next?'Fecha '+round+' · Cada manager prepara su propio club.':'Terminó la temporada '+world().season+'.',tag(leagueLabel()))+
      '<div class="two-col">'+panel(storageLabel(),'<div class="panel-body prose"><p>Compartí el código con tus amigos. Cada persona inicia sesión, entra a Liga de amigos y elige un club libre.</p><div class="code-box"><strong>'+esc(league.code)+'</strong>'+button('Copiar código','copy-code','','ghost small','link')+'</div><p>El código sirve para unirse a la liga. Si el sitio tiene acceso privado, habilitá también el acceso a tus invitados.</p></div>')+
      panel(next?'Preparación de la fecha':'Cambio de temporada','<div class="panel-body prose"><p>'+(next?'Cada manager prepara su club y marca «Estoy listo». Cuando el último lo marca, la fecha se juega sola y cada uno mira su partido.':'Cuando todos confirman, arranca la temporada siguiente, con los ascensos y descensos de los playoffs.')+'</p>'+
      '<div class="action-row">'+(pending?button('Continuar','replay',pending.id,'primary','play'):button(own?.ready?'Quitar estado de listo':'Estoy listo','ready','','primary','check',busy)+
      '')+'</div>'+
      '<p>'+(pending?'Tu próximo partido está listo: apretá «Continuar» para jugarlo.':'Faltan: '+league.members.filter(m=>!m.ready).map(m=>esc(m.nickname)).join(', ')+'.')+'</p></div>')+'</div>'+
      '<div class="spaced">'+panel('Managers',league.members.map(m=>'<div class="member-row">'+crest(m.clubId)+'<div><strong>'+esc(m.nickname)+(m.isMe?' · Vos':'')+'</strong><small>'+esc(nameOf(m.clubId))+'</small></div>'+tag(m.ready?'Listo':'Preparando',m.ready?'':'neutral')+'</div>').join(''),tag(league.members.length+' / 42','neutral'))+'</div>'+
      '<div class="action-row spaced">'+button('Cambiar de partida','offline','','ghost','right',busy)+'</div>';
  }
  const label = intro('MULTIJUGADOR PRIVADO','Liga con amigos','Cada persona dirige un club en una temporada compartida.');
  if (offline) return label+demoBox()+panel('Liga con amigos','<p class="panel-body">Las ligas están disponibles en la versión web con servidor.</p>')+'<div class="action-row spaced">'+button('Cambiar de modo','entry-mode','','ghost small','right',busy)+'</div>';
  return label+demoBox()+leagueOptions()+
    '<div class="action-row spaced">'+button('Cambiar de modo','entry-mode','','ghost small','right',busy)+button('Cerrar sesión','logout','','ghost small','close',busy)+'</div>';
}

const replayPhases = {
  restart:'Reinicio', catch:'Recepción', pass:'Pase', carry:'Avance', tackle:'Tackle',
  ruck:'Ruck', maul:'Maul', scrum:'Scrum', lineout:'Lineout', kick:'Patada',
  try:'Try', goal:'Patada a los palos', halftime:'Entretiempo', fulltime:'Final',
};
// Replay dots wear each club's colours; the away side switches to its second colour when both look alike.
const hexOk = v => /^#[a-f0-9]{6}$/i.test(v ?? '');
const rgb = v => [1,3,5].map(i=>parseInt(v.slice(i,i+2),16));
const colorGap = (a,b) => { const x=rgb(a), y=rgb(b); return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]); };
const inkFor = v => { const [r,g,b]=rgb(v); return (r*299+g*587+b*114)/1000>150?'#16130f':'#ffffff'; };
function kitStyle(homeId, awayId) {
  const h = club(homeId), a = club(awayId);
  const home = hexOk(h?.color) ? h.color : '#226e9b';
  let away = hexOk(a?.color) ? a.color : '#ad3d50';
  if (colorGap(home,away) < 90) away = hexOk(a?.secondaryColor) && colorGap(home,a.secondaryColor) >= 90 ? a.secondaryColor : (colorGap(home,'#f4f1ea')>=90?'#f4f1ea':'#1d1d1f');
  return '--home-kit:'+home+';--home-ink:'+inkFor(home)+';--away-kit:'+away+';--away-ink:'+inkFor(away);
}
const abbr = id => { const n=shortOf(id); return n.length<=4 ? n.toUpperCase() : n.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,3).toUpperCase() || n.slice(0,3).toUpperCase(); };
// Advertising boards: the game name, URBA in the middle, the home club and invented local sponsors (no away club).
const GAME_NAME = 'Rugby Manager 27';
const SPONSORS = ['SEGUROS LA PAMPA','CERVECERÍA DEL SUR','AGUA DE LOS ANDES','TRANSPORTES DEL OESTE','FERRETERÍA EL PILAR','LA TERCERA PARRILLA'];
function boards(fixture, side) {
  const home = nameOf(fixture.homeId).toUpperCase();
  const names = side==='top' ? [GAME_NAME,SPONSORS[0],'URBA','URBA',SPONSORS[1],home] : [home,SPONSORS[2],'URBA','URBA',SPONSORS[3],GAME_NAME];
  return '<div class="boards boards-'+side+'" aria-hidden="true">'+names.map(n=>'<span class="board '+(n==='URBA'?'b-urba':n===GAME_NAME?'b-game':n===home?'b-home':'b-sponsor')+'">'+esc(n)+'</span>').join('')+'</div>';
}
// Full rugby markings on a 100 × 70 pitch (try lines at 7 and 93), posts, line numbers and URBA painted at halfway.
// Full rugby markings on a 100 × 70 pitch (try lines at 7 and 93). The SVG stretches to the pitch box, so lines keep a
// fixed pixel width (non-scaling stroke) and every text or round mark is HTML placed in %: nothing gets distorted.
function replayLines() {
  const L = (x1,y1,x2,y2,w=1.5,dash='') => '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="#fff" stroke-width="'+w+'" vector-effect="non-scaling-stroke"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
  const at = (x,y) => 'left:'+x+'%;top:'+(y/70*100)+'%';
  const num = (x,y,t) => '<span class="line-num" style="'+at(x,y)+'">'+t+'</span>';
  return '<svg class="replay-lines" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true">'+
    '<rect x="1.2" y="1.2" width="97.6" height="67.6" fill="none" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>'+
    L(7,1.2,7,68.8,2.2)+L(93,1.2,93,68.8,2.2)+L(50,1.2,50,68.8,2)+L(26,1.2,26,68.8,1.8)+L(74,1.2,74,68.8,1.8)+
    L(41.4,1.2,41.4,68.8,1.3,'7 6')+L(58.6,1.2,58.6,68.8,1.3,'7 6')+L(11.3,1.2,11.3,68.8,1.2,'4 10')+L(88.7,1.2,88.7,68.8,1.2,'4 10')+
    [6,16,54,64].map(y=>[11.3,26,41.4,50,58.6,74,88.7].map(x=>L(x-.9,y,x+.9,y,1.2)).join('')).join('')+
    [7,93].map(x=>L(x,31.5,x,38.5,3)).join('')+
    '</svg>'+
    [7,93].map(x=>'<span class="post" style="'+at(x,31.5)+'"></span><span class="post" style="'+at(x,38.5)+'"></span>').join('')+
    [[11.3,'5'],[26,'22'],[41.4,'10'],[58.6,'10'],[74,'22'],[88.7,'5']].map(([x,t])=>num(x+(x<50?2.2:-2.2),10.5,t)+num(x+(x<50?2.2:-2.2),59.5,t)).join('')+
    '<span class="grass-logo" style="'+at(50,35)+'">URBA</span>';
}
function replayPage() {
  if (!replay) return intro('PARTIDOS','Replay 2D','Seleccioná un partido jugado desde el fixture.')+button('Ir al torneo','page','torneo','primary','cup');
  const {fixture, match} = replay;
  const {venue,referee} = assignment(fixture);
  return intro(roundLabel(fixture).toUpperCase()+' · '+fixture.division,'Replay 2D',[venue,referee?'Árbitro: '+referee:''].filter(Boolean).join(' · '),'<div class="action-row replay-actions" id="replay-actions"></div>')+
    '<section class="panel replay-panel replay-full"><div class="stadium" style="'+kitStyle(fixture.homeId,fixture.awayId)+'">'+
    '<div class="scoreboard tv-score"><span class="tv-team home">'+crest(fixture.homeId)+'<strong class="replay-home">'+esc(abbr(fixture.homeId))+'</strong></span><span class="score" id="replay-score">0 – 0</span><span class="tv-team away"><strong class="replay-away">'+esc(abbr(fixture.awayId))+'</strong>'+crest(fixture.awayId)+'</span><span class="clock" id="replay-clock">00:00</span></div>'+
    '<div class="stand stand-top" aria-hidden="true"></div>'+boards(fixture,'top')+
    '<div class="pitch match-pitch" data-do="toggle-replay" aria-label="Cancha: tocá para reproducir o pausar">'+replayLines()+
    '<svg class="replay-flight" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true"><line id="replay-trail" hidden></line></svg>'+
    // One dot per shirt (team + number). A player sent off or in the sin bin is missing from some frames: his dot hides.
    [fixture.homeId,fixture.awayId].flatMap(team=>Array.from({length:15},(_,i)=>'<span class="pitch-dot '+(team===fixture.awayId?'away':'home')+'" data-replay-dot="'+esc(team+'|'+(i+1))+'">'+(i+1)+'</span>')).join('')+
    '<span id="replay-ball-shadow" class="replay-ball-shadow" aria-hidden="true"></span><span id="replay-ball" class="ball" aria-hidden="true"></span><span id="replay-carrier" class="replay-carrier" hidden></span>'+
    '<span class="big-play" id="replay-bigplay" aria-hidden="true">'+icon('play')+'</span><div class="replay-flash" id="replay-flash" aria-live="polite"></div></div>'+
    boards(fixture,'bottom')+'<div class="stand stand-bottom" aria-hidden="true"></div></div>'+
    '<div class="replay-bar"><button type="button" class="btn small" data-do="toggle-replay">'+icon(replay.playing?'pause':'play')+(replay.playing?'Pausar':'Reproducir')+'</button>'+
      '<span class="replay-now"><strong id="replay-phase">Saque inicial</strong><span id="replay-possession"></span></span>'+
      '<span class="speed-chips">'+[1,2,4].map(x=>'<button type="button" class="chip'+(replay.speed===x?' active':'')+'" data-do="replay-speed" data-value="'+x+'">'+x+'×</button>').join('')+'</span></div>'+
    '<p class="commentary" id="replay-commentary"></p><div class="events feed" id="match-events"></div><p class="replay-seek-help" id="replay-seek-help" hidden></p></section>'+
    '<div id="replay-report"></div>';
}

function replayReport({match,fixture}) {
  const metrics = [
    ['openPlay','Juego abierto'],['scrum','Scrum'],['lineout','Lineout'],['maul','Maul'],['kicking','Juego con el pie'],
    ['discipline','Disciplina'],['fitness','Estado físico'],['dayForm','Forma del día'],
    ['phases','Fases con pelota'],['territory','Territorio'],['turnoversWon','Recuperaciones'],['metresGained','Metros ganados'],
  ];
  const home=match.analysis?.home, away=match.analysis?.away;
  const format = new Intl.NumberFormat('es-AR',{maximumFractionDigits:1});
  const value = (key,n) => {
    if (!Number.isFinite(n)) return '—';
    if (key==='dayForm') return (n>0?'+':'')+format.format(n)+'%';
    if (key==='territory'||key==='fitness') return format.format(n)+'%';
    return format.format(n);
  };
  const rows = home&&away ? metrics.filter(([key])=>typeof home[key]==='number'&&typeof away[key]==='number') : [];
  const summary = '<div class="panel-body match-final"><small>RESULTADO FINAL</small><strong>'+match.homeScore+' – '+match.awayScore+'</strong><small>Tries '+match.homeTries+' – '+match.awayTries+'</small></div>';
  return '<div class="spaced">'+panel('Balance del partido',summary+(rows.length?'<div class="table-wrap"><table><thead><tr><th scope="col">Indicador</th><th scope="col">'+esc(shortOf(fixture.homeId))+'</th><th scope="col">'+esc(shortOf(fixture.awayId))+'</th></tr></thead><tbody>'+
    rows.map(([key,label])=>'<tr><th scope="row">'+label+'</th><td>'+value(key,home[key])+'</td><td>'+value(key,away[key])+'</td></tr>').join('')+'</tbody></table></div><p class="training-note spaced">El XV, el estado físico y el plan de juego influyen en el rendimiento. La forma del día añade variación propia del partido. Son indicadores de esta simulación.</p>':''))+'</div>';
}

const renderers = {resumen:dashboard,jugador:playerPage,plantel:squadPage,medico:medicalPage,tacticas:tacticsPage,entrenamiento:trainingPage,cantera:academy,torneo:tournament,regresos:market,club:clubPage,liga:leaguePage,partido:replayPage};
function render() {
  if (!catalog || !demo) return;
  if (entryStage) { app.innerHTML=entryScreen(); return; }
  const notice=league?.world.migrationNotice&&page!=='partido'?'<p class="notice blue">'+esc(league.world.migrationNotice)+'</p>':'';
  app.innerHTML = shell(notice+renderers[page]());
  if (page==='partido'&&replay) setupReplay();
}

function notify(message, error=false) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = 'show'+(error?' error':'');
  toastTimer = setTimeout(()=>{ toastEl.className=''; },4500);
}

function showModal(title, content, footer='', wide=false) {
  modalPreviousFocus ??= document.activeElement;
  modalRoot.innerHTML = '<div class="modal-backdrop"><section class="modal '+(wide?'wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="dialog-title">'+
    '<header class="modal-head"><h2 id="dialog-title">'+esc(title)+'</h2><button class="icon-btn" type="button" data-do="close-modal" aria-label="Cerrar">'+icon('close')+'</button></header>'+
    '<div class="modal-body">'+content+'</div>'+(footer?'<footer class="modal-foot">'+footer+'</footer>':'')+'</section></div>';
  app.inert = true;
  modalRoot.querySelector('button').focus();
}
function closeModal() {
  modalRoot.innerHTML = '';
  app.inert = false;
  if (modalPreviousFocus?.isConnected) modalPreviousFocus.focus();
  modalPreviousFocus = null;
}

// Shirt numbers: the XV wears 1–15 by slot, the rest of Primera 16–23, then the squad by level. Juniors per category.
const dorsalCache = new WeakMap();
function dorsals(c) {
  if (dorsalCache.has(c)) return dorsalCache.get(c);
  const map = new Map(), ids = lineup(c), seniors = c.players.filter(p=>p.squad==='Plantel superior');
  ids.forEach((id,i)=>map.set(id,i+1));
  const rest = seniors.filter(p=>!map.has(p.id)).sort((a,b)=>(seniorGroup(a,ids)==='Primera'?0:1)-(seniorGroup(b,ids)==='Primera'?0:1)||overall(b)-overall(a));
  rest.forEach((p,i)=>map.set(p.id,16+i));
  for (const sq of ['M19','M17']) c.players.filter(p=>p.squad===sq).sort((a,b)=>engine.POSITIONS.indexOf(a.position)-engine.POSITIONS.indexOf(b.position)||overall(b)-overall(a)).forEach((p,i)=>map.set(p.id,i+1));
  dorsalCache.set(c,map); return map;
}
const clubOfPlayer = id => world().clubs.find(c=>c.players.some(p=>p.id===id))?.id ?? world().overseasCareers?.find(row=>row.player.id===id)?.originClubId ?? currentId();
const avatar = (p, extra='') => { const c=club(clubOfPlayer(p.id)), [k1,k2]=kitColors(c), n=dorsals(c).get(p.id);
  return '<span class="player-avatar kit-avatar '+extra+'" style="--k1:'+esc(k1)+';--k2:'+esc(k2)+';--ki:'+esc(inkFor(k1))+'" title="Dorsal '+(n ?? '—')+'">'+(n ?? '—')+'</span>'; };
// Editor: real players → community data (every league); invented players → this league only.
function playerEditor(p) {
  const pos = '<label>Puesto<select name="position"><option value="">Sin cambios</option>'+[...new Set(engine.POSITIONS)].map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></label>';
  if (p.fictional) {
    if (!currentClub().players.some(x=>x.id===p.id)) return '';
    return '<form id="edit-player-form" class="community-form editor-form" data-player-id="'+esc(p.id)+'">'+
      '<label class="wide">Nombre y apellido<input name="name" maxlength="60" value="'+esc(p.name)+'"></label>'+
      '<label>Edad<input type="number" name="age" min="15" max="45" value="'+esc(p.age ?? '')+'"></label>'+pos+
      '<p class="community-help wide">Jugador inventado: el cambio vale solo en esta partida.</p>'+
      '<div class="wide action-row">'+button('Cancelar','close-modal','','ghost small')+'<button class="btn primary small" type="submit"'+(!editable()?' disabled':'')+'>'+icon('check')+'Guardar cambios</button></div></form>';
  }
  if (offline) return '<p class="community-help">Para corregir datos de jugadores reales abrí la versión con servidor.</p>';
  if (!me.signedIn) return '<p class="community-help">Iniciá sesión en Liga para corregir datos de jugadores reales.</p>';
  return '<form id="community-form" class="community-form editor-form" data-player-id="'+esc(p.sourceRecordId)+'">'+
    '<label class="wide">Nombre y apellido<input name="name" maxlength="60" placeholder="'+esc(p.name)+'"></label>'+
    '<label>Edad aproximada<input type="number" name="age" min="15" max="45" inputmode="numeric" placeholder="'+esc(String(ageText(p)).replace('~','').replace('—',''))+'"></label>'+pos+
    '<label>¿Sigue en el club?<select name="active"><option value="">Sin cambios</option><option value="true">Sí</option><option value="false">No</option></select></label>'+
    '<label>Nivel sugerido (30–95)<input type="number" name="level" min="30" max="95" inputmode="numeric" placeholder="'+overall(p)+'"></label>'+
    '<label class="wide">Comentario de estadísticas<textarea name="stats" maxlength="300" rows="2" placeholder="Ej.: muy buen pateador, rápido, le cuesta el tackle…"></textarea></label>'+
    '<p class="community-help wide">Lo ven todas las ligas. Nombre, edad y puesto se corrigen enseguida; el nivel sugerido mueve su valoración de a poco.</p>'+
    '<div class="wide action-row">'+button('Cancelar','close-modal','','ghost small')+'<button class="btn primary small" type="submit">'+icon('check')+'Enviar corrección</button></div></form>';
}
const attributeGroups = [
  ['Técnicos',['passing','handling','kicking','goalKicking','tackling','breakdown','scrummaging','lineout','maul','carrying','offload','technique']],
  ['Mentales',['vision','decisions','positioning','discipline','leadership','workRate','composure']],
  ['Físicos',['pace','acceleration','agility','strength','stamina','jumping','evasion']],
];
const profileRow = (label,value) => '<div><dt>'+esc(label)+'</dt><dd>'+value+'</dd></div>';
const profileFact = (label,value) => profileRow(label,esc(value ?? '—'));
const profileData = rows => '<dl class="profile-facts">'+rows.filter(Boolean).join('')+'</dl>';
const ageLabel = p => ageText(p)==='—'?'Sin dato':String(ageText(p)).replace(/^~/,'')+' años'+(String(ageText(p)).startsWith('~')?' aprox.':'');

function playerSourceLinks(p) {
  const index = new Map([...(catalog.sources ?? []),...(catalog.youth.sources ?? []),...(catalog.returns.sources ?? [])].map(source=>[source.id,source]));
  return [...new Set([...(p.sourceIds ?? []),...(p.positionSourceIds ?? [])])].map(id=>index.get(id)).filter(source=>source?.url)
    .map(source=>external(source.title ?? source.id,source.url)).join('');
}

function profilePositions(p) {
  const positions = new Set([p.position,...(p.positions ?? [])]);
  const dots = engine.POSITIONS.map((position,i)=>{
    const [x,y]=pitchSpots[i], state=position===p.position?' main':positions.has(position)?' secondary':'';
    return '<span class="role-dot'+state+'" style="left:'+x+'%;top:'+y+'%" aria-hidden="true">'+(i+1)+'</span>';
  }).join('');
  return panel('Puestos',
    '<div class="role-pitch" role="img" aria-label="'+esc('Puestos que puede jugar: '+[...positions].join(', '))+'">'+
    [8,24,50,76,92].map(y=>'<span class="pitch-line" style="top:'+y+'%"></span>').join('')+dots+'</div>'+
    '<ul class="role-list">'+[...positions].map((position,i)=>'<li><i class="'+(i===0?'main':'secondary')+'"></i>'+esc(position)+'</li>').join('')+'</ul>');
}

function profileAttributes(p) {
  const groups = attributeGroups.map(([label,keys])=>'<section class="attribute-group"><h4>'+label+'</h4><dl>'+
    keys.map(key=>{
      const value=p.attributes[key];
      return '<div><dt>'+esc(engine.ATTRIBUTE_LABELS[key])+'</dt><dd class="'+attrTone(value)+'">'+(Number.isFinite(value)?Math.round(value):'—')+'</dd></div>';
    }).join('')+'</dl></section>').join('');
  return panel('Atributos','<div class="profile-attributes">'+groups+'</div>',tag('1–20','neutral'));
}

function profileSummary(p,c,owned) {
  const editor = playerEditor(p), canEditHere = Boolean(editor)&&!editor.startsWith('<p');
  const comments = p.community?.comments?.length ? '<div class="profile-comments"><h4>Comunidad</h4><ul>'+p.community.comments.slice().reverse().map(comment=>'<li>'+esc(comment)+'</li>').join('')+'</ul></div>' : '';
  const sources = playerSourceLinks(p);
  const facts = profileData([
    profileFact(owned?'Club':'Club de referencia',c.name),
    profileFact('Edad',ageLabel(p)),
    profileFact('Nacimiento',p.fictional?'Simulado':p.birthDate ?? 'Sin dato'),
    profileFact('Categoría',p.squad==='Plantel superior'?p.seniorSquad ?? p.squad:p.squad),
    profileFact('Rol en el plantel',owned&&p.squad==='Plantel superior'?playerRole(c,p):'—'),
    trajectoryLabel(p)?profileFact('Trayectoria',trajectoryLabel(p)):'',
  ]);
  return panel('Información del jugador',facts+
    (communityNote(p)?'<p class="profile-note">'+esc(communityNote(p))+'</p>':'')+comments+
    (canEditHere?'<div class="profile-actions">'+button('Editar datos','edit-player',p.id,'small','file')+'</div>':editor?'<div class="profile-note">'+editor+'</div>':''));
}

function profileCondition(p,c) {
  const injury = p.injury&&p.injury.since<(pendingReplay()?.round ?? Infinity)?p.injury:null;
  const facts = profileData([
    profileFact('Estado físico',Math.round(p.fitness)+'%'),
    profileFact('Disponibilidad',injury?injury.name+' · '+injury.weeksOut+' sem.':'Disponible'),
    profileFact('Plan actual',p.squad==='Plantel superior'?world().training?.[c.id] ?? 'Equilibrado':world().youthTraining?.[c.id] ?? 'Integral'),
    p.retraining?profileFact('Reconversión',p.retraining.to+' · '+p.retraining.weeksLeft+' sem.'):'',
  ]);
  return panel('Estado físico y entrenamiento',facts);
}

function profileDevelopment(p,c,owned) {
  const projection = development(p);
  const picker = owned&&p.squad==='Plantel superior' ?
    '<form id="assign-senior" class="profile-actions action-row" data-player-id="'+esc(p.id)+'"><label for="senior-squad">Equipo</label><select id="senior-squad" name="seniorSquad"'+(!editable()?' disabled':'')+'>'+baseSquads.map(label=>option(label,label,seniorGroup(p,lineup(c)))).join('')+'</select><button class="btn small" type="submit"'+(!editable()?' disabled':'')+'>Guardar equipo</button></form>' : '';
  const actions = owned ? '<div class="profile-actions">'+
    (p.squad==='Plantel superior'?button('Entrenamiento individual','profile-train',p.id,'primary small','pulse'):button('Abrir cantera','page','cantera','primary small','grow'))+
    (p.squad==='M19'?button('Promover','promote',p.id,'small','grow',!editable()||busy):'')+'</div>' : '';
  return '<div class="two-col">'+profileCondition(p,c)+panel('Desarrollo',
    profileData([profileFact('Nivel actual',overall(p)+'/100'),profileFact('Proyección actual',projection.projection==null?'Sin dato':projection.projection+'/100'),
      projection.originalProjection==null?'':profileFact('Proyección inicial',projection.originalProjection+'/100'),
      projection.trainingGains==null?'':profileFact('Mejoras registradas',projection.trainingGains)])+
    '<p class="profile-note">La proyección puede cambiar con su desarrollo en la partida.</p>'+picker+actions)+'</div>';
}

const statsColumns = [
  ['appearances','PJ','Partidos jugados'],['starts','Tit.','Partidos como titular'],['minutes','Min.','Minutos jugados'],
  ['tries','Tries','Tries'],['conversionsMade','Conv.','Conversiones acertadas'],['conversionPercentage','Prec.','Precisión en conversiones'],
  ['penaltyGoals','Pen.','Penales acertados'],['dropGoals','Drops','Drops acertados'],
  ['yellowCards','TA','Tarjetas amarillas'],['redCards','TR','Tarjetas rojas'],['points','Pts','Puntos'],
];
const statValue = (key,row) => {
  if (row[key]==null) return '—';
  if (key==='conversionPercentage') return Math.round(row[key])+'%';
  if (key==='conversionsMade'&&row.conversionAttempts!=null) return row[key]+'/'+row.conversionAttempts;
  if (key==='penaltyGoals'&&row.penaltyAttempts!=null) return row[key]+'/'+row.penaltyAttempts;
  return statCell(row[key]);
};
function statTable(rows,columns,contextLabel) {
  return '<div class="table-wrap" tabindex="0" aria-label="'+esc(contextLabel)+'"><table class="profile-stats-table"><thead><tr>'+
    '<th scope="col">'+esc(contextLabel)+'</th>'+columns.map(([,short,label])=>'<th scope="col" title="'+label+'">'+short+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(({label,stats})=>'<tr><th scope="row">'+label+'</th>'+columns.map(([key])=>'<td>'+statValue(key,stats)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function profileStats(p,career=false) {
  const {rows,season,seasonTotals,careerTotals,coverage}=playerCareerStats(world(),p.id,{throughRound:statsCutoff()});
  const current=career?rows:rows.filter(row=>row.season===season);
  const heading=career?'Estadísticas de carrera':'Estadísticas · '+season;
  const columns=profileTab==='perfil'?statsColumns.filter(([key])=>['appearances','tries','conversionsMade','yellowCards','points'].includes(key)):statsColumns;
  const context=career?'Temporada · competición':'Competición';
  const entries=current.map(row=>({
    label:esc((career?row.season+' · ':'')+row.competition)+(row.clubId?'<small>'+esc(nameOf(row.clubId))+'</small>':''),
    stats:row,
  }));
  if (entries.length) entries.push({label:'Total',stats:career?careerTotals:seasonTotals});
  return panel(heading,entries.length ? statTable(entries,columns,context)+
    '<p class="profile-note">'+(coverage.hasPartialRecords?'Algunos partidos tienen datos incompletos. ':'')+'Partidos de Primera en la partida. «—» indica un dato sin registro o un cálculo sin intentos.</p>':
    empty('Todavía no hay estadísticas individuales de Primera.','pulse'),'','profile-stats');
}
function recentForm(p) {
  const {recent}=playerCareerStats(world(),p.id,{throughRound:statsCutoff()});
  if (!recent.length) return panel('Últimas actuaciones',empty('Todavía no hay actuaciones registradas en Primera.','calendar'));
  const rows=recent.map(row=>({
    label:esc(nameOf(row.opponentId))+'<small>'+esc((row.season===world().season?'':row.season+' · ')+(row.stage==='semi'?'Semifinal':row.stage==='final'?'Final':'Fecha '+row.round))+(row.started?' · Titular':'')+'</small>',
    stats:row,
  }));
  return panel('Últimas actuaciones',statTable(rows,statsColumns.filter(([key])=>['minutes','tries','conversionsMade','yellowCards','points'].includes(key)),'Rival'));
}
function profileTrajectory(p,c) {
  const history = p.trajectory;
  const facts = profileData([
    profileFact('Club de referencia',c.name),
    trajectoryLabel(p)?profileFact('Etapa',trajectoryLabel(p)):'',
    history?profileFact('Temporadas documentadas en Primera',history.seasons):'',
    history?.gameSeasons?profileFact('Temporadas en la partida',history.gameSeasons):'',
    history?.unknownSeasons?profileFact('Temporadas con cobertura incompleta',history.unknownSeasons):'',
  ]);
  const abroad = (world().overseasCareers ?? []).filter(row=>row.player?.id===p.id);
  const movements=abroad.length?'<ul class="profile-movements">'+abroad.map(row=>'<li><strong>'+esc(overseasDestination(row))+'</strong><span>Salida simulada · '+esc(row.departedSeason)+(row.returnedSeason?' · Regreso '+esc(row.returnedSeason):row.status==='retired'?' · Retirado':'')+'</span></li>').join('')+'</ul>':'';
  return '<div class="two-col">'+panel('Trayectoria',facts+movements)+profileStats(p,true)+'</div>';
}

const development = p => engine.developmentProfile(p);
const playerProjection = p => development(p).projection;
const projectionValue = p => playerProjection(p)==null?'—':playerProjection(p)+' <small>/100</small>';
const canDevelop = (p,key) => engine.canDevelopAttribute(p,key,world().season);
const stars = value => Number.isFinite(value)?'<span class="profile-stars" style="--stars:'+Math.max(0,Math.min(100,value))+'%" aria-hidden="true">★★★★★</span>':'';

function playerPage() {
  const p = playerById(profileId);
  if (!p) return panel('Jugador no disponible',empty('El jugador ya no está en el plantel activo.','team'),button('Volver al plantel','page','plantel','small'));
  const c = club(clubOfPlayer(p.id)), owned = c.id===currentId()&&c.players.some(x=>x.id===p.id);
  const projected = playerProjection(p);
  const header = '<header class="profile-header">'+avatar(p,'big')+'<div class="profile-identity"><h1>'+esc(p.name)+'</h1>'+
    '<p>'+esc(p.position)+' · '+esc(ageLabel(p))+' · '+esc(c.name)+'</p></div>'+
    '<div class="profile-ratings"><div><small>Nivel actual</small>'+stars(overall(p))+'<strong class="'+ratingTone(overall(p))+'">'+overall(p)+'<small> /100</small></strong></div>'+
    '<div><small>Proyección</small>'+stars(projected)+'<strong>'+(projected==null?'—':projected+'<small> /100</small>')+'</strong></div></div>'+
    (()=>{ const ed=playerEditor(p); return ed&&!ed.startsWith('<p')?button('Editar jugador','edit-player',p.id,'primary small','file'):''; })()+
    button('Volver','profile-back','','ghost small')+'</header>';
  let content;
  switch (profileTab) {
    case 'desarrollo': content=profileDevelopment(p,c,owned); break;
    case 'estadisticas': content='<div class="profile-tables">'+profileStats(p)+recentForm(p)+profileStats(p,true)+'</div>'; break;
    case 'trayectoria': content=profileTrajectory(p,c); break;
    default: content='<div class="profile-grid">'+profilePositions(p)+profileAttributes(p)+profileSummary(p,c,owned)+'</div>'+
      '<div class="profile-lower">'+profileCondition(p,c)+profileStats(p,true)+recentForm(p)+'</div>'; break;
  }
  return header+content;
}

function showPlayer(id, edit=false) {
  const p = playerById(id);
  if (!p) return;
  if (page!=='jugador') profileBack=page==='partido'?'plantel':page;
  if (profileId!==id) profileTab='perfil';
  profileId=id;
  changePage('jugador');
  if (edit) showModal('Editar a '+p.name,playerEditor(p),button('Cerrar','close-modal','','ghost'));
}

function clubChoices(explorer) {
  const group = explorer ? explorerDivision : clubDivision;
  const term = normalize(clubSearch);
  const clubs = (explorer ? catalog.clubs : demo.clubs).filter(c=>(!group||group==='Todas'||(explorer?c.competitionId:c.division)===group)&&normalize(c.name+' '+(c.shortName??'')).includes(term));
  if (!clubs.length) return empty('No encontramos clubes con estos filtros.', 'shield');
  return '<div class="club-grid">'+clubs.map(c=>{
    const division = c.division ?? DIVISIONS[c.competitionId] ?? 'Torneo del Interior A';
    const playing = c.id===currentId();
    return '<button type="button" class="club-choice '+(playing?'selected':'')+'" data-do="'+(explorer?'club-preview':'choose-club')+'" data-value="'+esc(c.id)+'">'+crest(c.id)+'<span><strong>'+esc(c.name)+'</strong><small>'+esc(division)+(c.competitionId==='interior-a'?' · En catálogo':'')+'</small></span></button>';
  }).join('')+'</div>';
}

function showClubs(explorer=false, reset=true) {
  if (reset) clubSearch='';
  const filters = explorer
    ? [['Todas',''],...catalog.competitions.map(c=>[c.name,c.id])]
    : [['Todas','Todas'],...divisions.map(d=>[d,d])];
  showModal(explorer?'Explorar clubes':league?'Club de la liga':'Elegí tu club',
    (league&&!explorer?'<div class="notice">Tu club está asignado en esta liga. Podés explorar los demás clubes del catálogo.</div>':'')+
    '<div class="toolbar"><input id="club-search" type="search" aria-label="Buscar club" placeholder="Buscar club" value="'+esc(clubSearch)+'"><select id="club-filter" data-explorer="'+explorer+'" aria-label="Filtrar división">'+
    filters.map(([label,value])=>option(label,value,explorer?explorerDivision:clubDivision)).join('')+'</select></div><div id="club-results">'+clubChoices(explorer)+'</div>',
    explorer?'':button('Explorar catálogo','explorer','','ghost','shield'),true);
  modalRoot.querySelector('#club-search').focus();
}

function showClubPreview(id) {
  const c = info(id);
  if (!c) return;
  const division = DIVISIONS[c.competitionId] ?? 'Torneo del Interior A';
  showModal(c.name,
    '<div class="player-detail-top">'+crest(id)+'<div><p>'+esc(division)+'</p><p>'+esc(c.city ?? c.venue?.name ?? '')+'</p></div></div>'+
    '<div class="action-row spaced">'+tag('Fuerza '+strength(c)+'/100','neutral')+
    (c.competitionId==='interior-a'?tag('Disponible para explorar','blue'):'')+'</div>'+
    (c.venue?.name?'<p class="spaced">'+esc(c.venue.name)+'</p>':''),
    button('Volver al catálogo','explorer','','ghost','right')+(c.competitionId!=='interior-a'&&!league?button('Dirigir este club','choose-club',id,'primary','shield'):''));
}

let animation, replayNodes, lastFrameTime;
const replayClockRate = 24;
function clock(second) {
  const t = Math.floor(second);
  return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}

function indexAt(items,second) {
  let lower=0, upper=items.length;
  while (lower<upper) {
    const middle=Math.floor((lower+upper)/2);
    if (items[middle].second<=second) lower=middle+1;
    else upper=middle;
  }
  return lower-1;
}

function replayEvent(event,index,previous,active) {
  const scoring = event.homeScore+event.awayScore > (previous?.homeScore ?? 0)+(previous?.awayScore ?? 0);
  return '<button type="button" class="event '+(scoring?'scoring ':'')+(active?'current':'')+'" data-do="seek-event" data-value="'+index+'" aria-label="Ir a '+clock(event.second)+': '+esc(event.description)+'"><span class="min">'+clock(event.second)+'</span><span>'+esc(event.description)+'</span></button>';
}

function drawReplay() {
  if (!replayNodes || !replay) return;
  const {second,match,events,names,known,end}=replay;
  const {frames}=match;
  const frameIndex=Math.max(0,indexAt(frames,second));
  const a=frames[frameIndex], b=frames[frameIndex+1] ?? a;
  const reset=b.phase==='halftime'||(a.phase!==b.phase&&b.phase==='restart')||(a.homeDirection&&b.homeDirection&&a.homeDirection!==b.homeDirection);
  const raw=reset||b.second===a.second?0:Math.min(1,Math.max(0,(second-a.second)/(b.second-a.second)));
  const amount=raw*raw*(3-2*raw);// ease in and out: players accelerate and settle instead of sliding
  const interpolate=(from,to)=>from+(to-from)*amount;
  const position=(from,to)=>({x:interpolate(from.x,to.x),y:interpolate(from.y,to.y)});
  function move(node,{x,y}) {
    node.style.left=x+'%';
    node.style.top=(y/70*100)+'%';
  }
  const carrierId=a.flight?undefined:a.carrierId;
  let carrierPosition, carrierPlayer;
  const byShirt = f => { if (!f.byShirt) f.byShirt=new Map(f.players.map(p=>[p.teamId+'|'+p.number,p])); return f.byShirt; };
  replayNodes.dots.forEach(node=>{
    const key=node.dataset.replayDot, player=byShirt(a).get(key);
    node.hidden=!player;
    if (!player) return;
    const point=position(player,byShirt(b).get(key) ?? player);
    move(node,point);
    const carrying=player.id===carrierId;
    node.classList.toggle('carrying',carrying);
    if (carrying) { carrierPosition=point; carrierPlayer=player; }
  });
  const ground=position(a.ball,b.ball);
  const lift=interpolate(a.ball.h ?? 0,b.ball.h ?? 0);
  move(replayNodes.ball,ground);
  move(replayNodes.shadow,ground);
  replayNodes.ball.style.setProperty('--ball-lift',(-lift*32)+'px');
  replayNodes.shadow.hidden=!a.flight;
  replayNodes.trail.toggleAttribute('hidden',!a.flight);
  if (a.flight) {
    replayNodes.trail.setAttribute('x1',a.ball.x);
    replayNodes.trail.setAttribute('y1',a.ball.y);
    replayNodes.trail.setAttribute('x2',ground.x);
    replayNodes.trail.setAttribute('y2',ground.y);
    replayNodes.trail.setAttribute('data-flight',a.flight);
  }
  replayNodes.carrier.hidden=!carrierPlayer;
  if (carrierPlayer) {
    const label=carrierPlayer.number+' · '+(names.get(carrierId) ?? shortOf(carrierPlayer.teamId));
    if (replayNodes.carrier.textContent!==label) replayNodes.carrier.textContent=label;
    move(replayNodes.carrier,{x:Math.min(87,Math.max(13,carrierPosition.x)),y:Math.max(6,carrierPosition.y)});
  }
  const eventIndex=indexAt(events,second), last=events[eventIndex];
  if (eventIndex!==replayNodes.eventIndex) {
    // Feed below the pitch, newest first. A try or a kick at goal that just happened gets a full-pitch flash.
    replayNodes.list.innerHTML=eventIndex<0?'<p class="empty replay-empty">El relato aparece a medida que avanza el partido.</p>':
      events.slice(Math.max(0,eventIndex-7),eventIndex+1).map((e,i,arr)=>replayEvent(e,Math.max(0,eventIndex-7)+i,events[Math.max(0,eventIndex-7)+i-1],e===last)).reverse().join('');
    if (replay.playing&&eventIndex===replayNodes.eventIndex+1&&last) flash(last);
    replayNodes.eventIndex=eventIndex;
    replayNodes.score.textContent=(last?.homeScore ?? 0)+' – '+(last?.awayScore ?? 0);
  }
  // Live line from what is happening now: phase and ball carrier.
  const who = a.carrierId ? (names.get(a.carrierId) ?? '') : '', side = shortOf(a.possessionId);
  const live = {restart:'Saque de '+side+'.',catch:who?who+' recibe.':'Recepción.',pass:who?'Pase de '+who+'.':'La pelota circula.',carry:who?who+' avanza con la pelota.':side+' avanza.',tackle:who?'Tacklean a '+who+'.':'Tackle.',
    ruck:'Ruck: '+side+' quiere reciclar rápido.',maul:'Maul de '+side+', empujan todos.',scrum:'Scrum.',lineout:'Lineout para '+side+'.',kick:who?'Patea '+who+'.':'Patada.',try:'¡Try de '+side+'!',goal:'Patada a los palos.',halftime:'Entretiempo.',fulltime:'Final del partido.'}[a.phase] ?? (last?.description ?? 'La pelota se pone en juego.');
  if (replayNodes.note.textContent!==live) replayNodes.note.textContent=live;
  replayNodes.phase.textContent=replayPhases[a.phase] ?? (second>=end?'Final':'En juego');
  replayNodes.possession.textContent=second>=end||a.phase==='halftime'?'':shortOf(a.possessionId)+' con la pelota'+(a.homeDirection?' · '+((a.possessionId===replay.fixture.homeId)===(a.homeDirection>0)?'ataca →':'← ataca'):'');
  replayNodes.clock.textContent=clock(second);
  replayNodes.big?.classList.toggle('show',!replay.playing);
  if (known!==replayNodes.known) {
    replayNodes.known=known;
    replayNodes.actions.innerHTML=known?button('Ver fixture','match-fixture','','ghost','calendar'):
      button('Volver al inicio','page','resumen','ghost')+button('Saltar al resultado','skip-replay','','ghost','right');
  }
  const atEnd=second>=end;
  if (atEnd!==replayNodes.atEnd) {
    replayNodes.atEnd=atEnd;
    replayNodes.report.innerHTML=atEnd&&known?replayReport(replay):'';
  }
}

// Full-pitch flash for tries and kicks at goal, in the scoring team's colours.
function flash(e) {
  const box=replayNodes?.flash; if (!box) return;
  const home=e.teamId===replay.fixture.homeId, made=(e.points ?? 0)>0, who=e.playerId?(replay.names.get(e.playerId) ?? ''):'';
  const label = e.type==='try' ? '¡TRY!' : e.type==='conversion' ? (made?'¡CONVERSIÓN!':'CONVERSIÓN ERRADA') : e.type==='penalty' ? (made?'¡PENAL ADENTRO!':'PENAL ERRADO') : e.type==='dropGoal' ? (made?'¡DROP!':'DROP ERRADO') : '';
  if (!label) return;
  box.className='replay-flash show '+(home?'home':'away')+(e.type==='try'?' is-try':' is-kick')+(made||e.type==='try'?'':' missed');
  box.innerHTML=(e.type!=='try'?'<span class="kick-arc" aria-hidden="true"><i></i></span>':'')+'<strong>'+label+'</strong><small>'+esc([who,shortOf(e.teamId)].filter(Boolean).join(' · '))+'</small>';
  clearTimeout(flash.timer); flash.timer=setTimeout(()=>{ box.className='replay-flash'; },e.type==='try'?2600:1900);
}
function updatePlayButton() {
  if (!replayNodes?.toggle) return;
  const label=replay.playing?'Pausar':replay.second>=replay.end?'Volver a reproducir':'Reproducir';
  replayNodes.toggle.innerHTML=icon(replay.playing?'pause':'play')+label;
  replayNodes.big?.classList.toggle('show',!replay.playing);
}
function pauseReplay() {
  if (!replay) return;
  replay.playing=false;
  cancelAnimationFrame(animation);
  lastFrameTime=undefined;
  updatePlayButton();
}
function finishReplay() {
  replay.second=replay.end;
  replay.seen=replay.end;
  replay.known=true;
  revealMatch(replay.fixture.id);
  pauseReplay();
  drawReplay();
}
function animate(time) {
  if (!replay?.playing || page!=='partido') return;
  if (lastFrameTime!==undefined) {
    const elapsed=Math.min(.1,(time-lastFrameTime)/1000);
    replay.second=Math.min(replay.end,replay.second+elapsed*replayClockRate*replay.speed);
    replay.seen=Math.max(replay.second,replay.seen);
  }
  lastFrameTime=time;
  if (replay.second>=replay.end) { finishReplay(); return; }
  drawReplay();
  animation=requestAnimationFrame(animate);
}
function setupReplay() {
  cancelAnimationFrame(animation);
  const byId = id=>document.querySelector('#replay-'+id);
  replayNodes={
    dots:[...app.querySelectorAll('[data-replay-dot]')], ball:byId('ball'), shadow:byId('ball-shadow'),
    trail:byId('trail'), carrier:byId('carrier'), seek:byId('seek'), score:byId('score'),
    clock:byId('clock'), phase:byId('phase'), possession:byId('possession'), note:byId('commentary'),
    list:document.querySelector('#match-events'), toggle:app.querySelector('.replay-bar [data-do="toggle-replay"]'),
    help:byId('seek-help'), actions:byId('actions'), report:byId('report'), big:byId('bigplay'), flash:byId('flash'), stadium:app.querySelector('.stadium'),
  };
  drawReplay();
  updatePlayButton();
  lastFrameTime=undefined;
  if (replay.playing) animation=requestAnimationFrame(animate);
}
function toggleReplay() {
  if (!replay) return;
  if (replay.playing) { pauseReplay(); return; }
  if (replay.second>=replay.end) replay.second=0;
  replay.playing=true;
  updatePlayButton();
  drawReplay();
  lastFrameTime=undefined;
  animation=requestAnimationFrame(animate);
}
function seekReplay(second) {
  if (!replay||!Number.isFinite(second)) return;
  replay.second=Math.min(Math.max(0,second),replay.known?replay.end:replay.seen);
  drawReplay();
  updatePlayButton();
}
function openReplay(id) {
  const fixture=world().fixtures.find(f=>f.id===id&&f.match);
  if (!fixture) return notify('Ese partido todavía no tiene replay.',true);
  if (!hasReplay(fixture)) return notify('Solo se guarda la repetición de los partidos de clubes con manager.',true);
  if (fixture.id!==pendingReplay()?.id&&!resultVisible(fixture)) return notify('Primero mirá el partido pendiente de tu club.',true);
  try {
    const match=engine.regenerateReplay(world(),id);
    const end=match.frames.at(-1)?.second;
    if (!end||!match.frames[0]?.players.length) throw Error('Replay vacío');
    const names=new Map([fixture.homeId,fixture.awayId].flatMap(clubId=>club(clubId).players.map(p=>[p.id,p.name])));
    replay={fixture,match,names,end,events:[...match.events].sort((a,b)=>a.second-b.second),
      second:0,seen:0,speed:1,playing:false,known:resultVisible(fixture)};
    closeModal();
    changePage('partido');
  } catch {
    showModal('Replay no disponible','<p>Podés volver a intentar o revelar el resultado de este partido.</p>',
      button('Volver','close-modal','','ghost')+button('Mostrar resultado','reveal-unavailable',fixture.id,'ghost','right'));
  }
}

function resetDrafts() {
  tacticDraft=undefined;
  lineupDraft=undefined;
  editVersion=undefined;
}
function resetFilters() {
  squad='Plantel superior';
  playerFilter='';
  positionFilter='';
  selectedDivision=undefined;
  tournamentClub='';
  tournamentRound=undefined;
  tournamentMode='Posiciones';
  resetDrafts();
}
function changePage(next, updateUrl=true) {
  if (!views.has(next)) return;
  toastEl.classList.remove('show');
  if (next!=='partido') {
    cancelAnimationFrame(animation);
    replayNodes=null;
    if (replay) replay.playing=false;
  }
  if (page!==next) window.scrollTo({top:0});
  if (updateUrl) {
    const url=new URL(location.href);
    if (!entryStage) url.searchParams.delete('code');
    url.hash=next==='resumen'?'':next==='jugador'?'jugador/'+encodeURIComponent(profileId)+'/'+profileTab:next;
    try { history.replaceState(null,'',url); } catch {}
  }
  page=next;
  mobileOpen=false;
  render();
  if (!entryStage&&page==='liga'&&me.signedIn&&!league) refreshList();
}

async function request(path, {data,version}={}) {
  const headers={};
  if (data) headers['content-type']='application/json';
  if (version!==undefined) headers['if-none-match']=String(version);
  const res=await fetch(path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,cache:'no-store'});
  if (res.status===304) return null;
  const result=await res.json().catch(()=>null);
  if (!res.ok || !result) {
    const error=new Error(result?.error ?? 'No pudimos conectarnos. Volvé a intentar.');
    error.status=res.status;
    throw error;
  }
  return result;
}

function setLeague(result) {
  league=result ? {...result,world:enrichRosterIdentities(result.world,catalog)} : null;
  store.set('tt-last-league',result?.code);
}
function setBusy(value) {
  busy=value;
  app.setAttribute('aria-busy',String(value));
}
async function refreshList() {
  if (leagueListState==='loading') return;
  leagueListState='loading';
  try {
    const {leagues}=await request('/api/leagues');
    savedLeagues=leagues;
    leagueListState='ready';
    refreshLeagueList();
  } catch (error) {
    leagueListState='error';
    refreshLeagueList();
    if (entryStage==='online'||page==='liga') notify(error.message,true);
  }
}

function refreshLeagueList() {
  const existing = document.querySelector('#saved-leagues');
  if (!existing) return;
  const template = document.createElement('template');
  template.innerHTML=leagueOptions();
  existing.replaceWith(template.content.querySelector('#saved-leagues'));
}
function enterOffline(next='resumen') {
  setLeague(null);
  entryStage=null;
  rememberEntry('offline');
  resetFilters();
  changePage(next);
}
async function openLeague(code, loadView=true, next='resumen') {
  if (busy) return;
  setBusy(true);
  try {
    const result=await request('/api/leagues/'+code);
    setLeague(result);
    resetFilters();
    setBusy(false);
    entryStage=null;
    rememberEntry('online',result.code);
    changePage(next);
    return true;
  } catch (error) {
    if (!loadView&&(error.status===403||error.status===404)) store.set('tt-last-league',null);
    if (loadView) notify(error.message,true);
    return false;
  } finally { setBusy(false); }
}

async function pollLeague() {
  if (entryStage||!league||busy||document.hidden||modalRoot.firstChild||page==='partido'||tacticDraft||lineupDraft) return;
  const {code,version}=league;
  try {
    const result=await request('/api/leagues/'+code,{version});
    if (!result||busy||league?.code!==code||league.version!==version||tacticDraft||lineupDraft) return;
    const oldRound=currentRound(), oldSeason=world().season;
    setLeague(result);
    if (world().season!==oldSeason) resetFilters();
    // A round played while away is not announced: the next match simply waits behind «Continuar», result unknown.
    if ((currentRound()!==oldRound || world().season!==oldSeason) && !pendingReplay()) notify('La liga actualizó la fecha.');
    render();
  } catch {}
}

const confirmations = {
  'edit-player':'Guardaste los cambios del jugador.',tactics:'Guardaste el plan de juego.',lineup:'Guardaste el XV inicial.',training:'Guardaste el plan de entrenamiento.',
  promote:'El jugador ya está en el plantel superior.','sign-return':'El jugador se incorporó al plantel.', 'contact-return':'Contacto registrado. Consultá la respuesta en Regresos.',
  'next-season':'Arrancó una nueva temporada.','assign-senior':'Actualizaste el equipo del jugador.',
};

async function act(action, payload={}, version=league?.version) {
  if (busy) return false;
  const previous=nextMatch(), oldRound=currentRound();
  if (previous?.match&&['ready','advance','next-season'].includes(action)) {
    openReplay(previous.id);
    return false;
  }
  if ((action==='ready'||action==='advance'||action==='next-season')&&(tacticDraft||lineupDraft)) {
    notify('Guardá los cambios de Tácticas antes de continuar.',true);
    return false;
  }
  setBusy(true);
  try {
    if (league) {
      const result=await request('/api/leagues/'+league.code+'/action',{data:{version,action,...payload}});
      setLeague(result);
    } else if (action==='advance') demo=advanceWorld(demo,new Set([currentId()]));
    else if (action==='next-season') demo=advanceSeasonWorld(demo);
    else demo=applyClubAction(demo,currentId(),action,payload);
    if (!league) saveDemo();


    if (action==='tactics') tacticDraft=undefined;
    if (action==='lineup') lineupDraft=undefined;
    if (!tacticDraft&&!lineupDraft) editVersion=undefined;
    else editVersion=league?.version;
    if (action==='next-season') resetFilters();
    setBusy(false);
    if ((action==='advance'||action==='ready') && previous?.round===oldRound && world().fixtures.find(f=>f.id===previous.id)?.match) openReplay(previous.id);
    else if (action==='next-season') changePage('resumen');
    else render();
    if (action==='ready') notify(currentRound()!==oldRound?'Estaban todos listos: se jugó la fecha.':myMember()?.ready?'Marcaste tu equipo como listo.':'Volvés a estar preparando el equipo.');
    else if (action==='contact-player') { const n=(world().news ?? []).findLast(n=>n.kind==='transfer'&&n.clubId===currentId()&&n.playerId===payload.playerId); notify(n?.text ?? 'Contacto realizado.', n?.text?.includes('no aceptó')); }
    else if (confirmations[action]) notify(confirmations[action]);
    return true;
  } catch (error) {
    if (error.status===409&&league) {
      try {
        const refreshed=await request('/api/leagues/'+league.code);
        if (refreshed.version!==version) {
          setLeague(refreshed);
          if (currentRound()!==oldRound) resetDrafts();
          else editVersion=refreshed.version;
        }
      } catch {}
    }
    setBusy(false);
    notify(error.message,true);
    render();
    return false;
  }
}

function patchPlayers() {
  const players=filteredSeniors();
  document.querySelector('#player-results').innerHTML=playerTable(players);
  document.querySelector('#player-count').textContent=players.length+' jugadores';
}

document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-do]');
  if (!target) {
    if (event.target.classList.contains('modal-backdrop')) closeModal();
    return;
  }
  const {do:action,value}=target.dataset;
  if (busy && ['offline','open-league','choose-club'].includes(action)) return;
  switch (action) {
    case 'entry-mode':
      if (!busy) { closeModal(); league=null; resetFilters(); setEntry('mode'); }
      break;
    case 'entry-auth': authKind=value==='Crear cuenta'?'register':'login'; render(); break;
    case 'entry-offline': if (hasDemoSave) enterOffline(); else setEntry('offline'); break;
    case 'entry-online': if (me.signedIn&&!offline) { setEntry('online'); refreshList(); } break;
    case 'retry-leagues': refreshList(); break;
    case 'reset-local-profile': localProfileName=''; store.set('tt-local-profile',null); setEntry('auth'); break;
    case 'page': changePage(value); break;
    case 'portal-section': document.getElementById(value)?.focus(); break;
    case 'portal-squad':
      if (value==='M19'||value==='M17') { youthSquad=value; changePage('cantera'); }
      else if (baseSquads.includes(value)) { squad=value; changePage('plantel'); }
      break;
    case 'competition-nav': tournamentMode=value; changePage('torneo'); break;
    case 'mobile': mobileOpen=!mobileOpen; render(); break;
    case 'theme': setTheme(theme()==='dark'?'light':'dark'); render(); break;
    case 'medical-filter': medicalFilter=value; render(); break;
    case 'clubs': showClubs(); break;
    case 'explorer': showClubs(true); break;
    case 'club-preview': showClubPreview(value); break;
    case 'close-modal': closeModal(); break;
    case 'choose-club':
      if (league) { showClubPreview(value); break; }
      demoClubId=value; store.set('tt-demo-club',value); saveDemo(); resetFilters(); closeModal(); changePage('resumen'); break;
    case 'player': showPlayer(value); break;
    case 'profile-tab': if (profileTabs.some(([id])=>id===value)) { profileTab=value; changePage('jugador'); } break;
    case 'profile-back': changePage(profileBack); break;
    case 'profile-train': trainPick=value; changePage('entrenamiento'); break;
    case 'squad': squad=value; render(); break;
    case 'youth': youthSquad=value; render(); break;
    case 'division': selectedDivision=value; tournamentClub=''; tournamentRound=undefined; render(); break;
    case 'tournament': tournamentMode=value; render(); break;
    case 'category': tournamentCategory=value; render(); break;
    case 'tactic': {
      const [key,choice]=value.split('|');
      editVersion ??= league?.version;
      tacticDraft={...engine.DEFAULT_TACTICS,...(tacticDraft ?? world().tactics[currentId()] ?? {}),[key]:choice};
      render(); app.querySelectorAll('[data-do="tactic"]').forEach(node=>{ if (node.dataset.value===value) node.focus(); });
      break;
    }
    case 'discard-tactics': resetDrafts(); render(); break;
    case 'tactics-panel': tacticsOpen=!tacticsOpen; render(); break;
    case 'rival-report': showRivalReport(value); break;
    case 'inbox': inboxOpen=inboxOpen===value?null:value; markRead(value); render(); break;
    case 'inbox-read-all': for (const i of inboxItems(currentClub())) markRead(i.id); render(); break;
    case 'inbox-all': inboxAll=!inboxAll; render(); break;
    case 'logout':
      if (busy) break;
      setBusy(true);
      try {
        await request('/api/auth/logout',{data:{}});
        me={signedIn:false,storage:me.storage}; setLeague(null); resetFilters(); savedLeagues=[]; leagueListState='idle';
        authKind='login'; setBusy(false); setEntry('auth'); notify('Cerraste la sesión.');
      } catch (error) { notify(error.message,true); }
      finally { setBusy(false); }
      break;
    case 'swap': {
      // Tap one player, then another: swap a starter with a starter, or bring in a substitute / squad player.
      const slot = target.dataset.slot===''?undefined:Number(target.dataset.slot), c=currentClub();
      if (!swapPick) { swapPick={slot,id:value}; render(); break; }
      const first=swapPick; swapPick=null;
      if (first.id===value&&first.slot===slot) { render(); break; }
      const ids=[...(lineupDraft ?? lineup(c))], find=id=>c.players.find(p=>p.id===id);
      const a=first.slot, b=slot;
      if (a===undefined&&b===undefined) { notify('Elegí un jugador del XV para cambiarlo.',true); render(); break; }
      const put=(i,id)=>{ const p=find(id); if (p&&!engine.canPlay(p,engine.POSITIONS[i])) throw Error(p.name+' no juega de '+engine.POSITIONS[i].toLowerCase()+'.'); if (p?.injury) throw Error(p.name+' está lesionado.'); ids[i]=id; };
      try {
        if (a!==undefined&&b!==undefined) { const x=ids[a], y=ids[b]; put(a,y); put(b,x); }
        else if (a!==undefined) put(a,value); else put(b,first.id);
        editVersion ??= league?.version; lineupDraft=ids;
      } catch (error) { notify(error.message,true); }
      render(); break;
    }
    case 'save-tactics': if (tacticDraft) await act('tactics',{tactics:tacticDraft},editVersion); break;
    case 'save-lineup': if (lineupDraft) await act('lineup',{ids:lineupDraft},editVersion); break;
    case 'training': await act('training',{focus:value}); break;
    case 'youth-training': await act('youth-training',{plan:value}); break;
    case 'sort': squadSort = squadSort.key===value ? {key:value,dir:-squadSort.dir} : {key:value,dir:1}; render(); break;
    case 'edit-player': showPlayer(value,true); break;
    case 'train-pick': trainPick=value; render(); break;
    case 'train-player': { const [playerId,attribute]=value.split('|'); await act('train-player',{playerId,attribute}); break; }
    case 'retrain': { const [playerId,to]=value.split('|'); await act('retrain',{playerId,to}); break; }
    case 'cancel-retrain': await act('cancel-retrain',{playerId:value}); break;
    case 'promote':
      showModal('Promover al plantel superior','<p>'+esc(playerById(value)?.name)+' pasará de M19 al plantel superior.</p>',button('Cancelar','close-modal','','ghost')+button('Confirmar','confirm-promote',value,'primary','check')); break;
    case 'confirm-promote': closeModal(); await act('promote',{playerId:value}); break;
    case 'contact-return': await act('contact-return',{candidateId:value}); break;
    case 'contact-player': { const [playerId,offer]=value.split('|'); await act('contact-player',{playerId,offer:offer||undefined}); break; }
    case 'market-tab': marketTab=value; render(); break;
    case 'market-offer': marketQuery.offer=value; render(); break;
    case 'market-more': marketLimit+=40; render(); break;
    case 'sign-return':
      showModal('Incorporar al plantel','<p>Confirmá la incorporación para esta temporada.</p>',button('Cancelar','close-modal','','ghost')+button('Confirmar','confirm-return',value,'primary','check')); break;
    case 'confirm-return': closeModal(); await act('sign-return',{candidateId:value}); break;
    case 'ready': await act('ready'); break;
    case 'advance': await act(Number.isFinite(currentRound())?'advance':'next-season'); break;
    case 'replay': openReplay(value); break;
    case 'toggle-replay': toggleReplay(); break;
    case 'replay-speed': if (replay) { replay.speed=Number(value); app.querySelectorAll('[data-do="replay-speed"]').forEach(n=>n.classList.toggle('active',n.dataset.value===value)); } break;
    case 'seek-event':
      pauseReplay();
      seekReplay(replay?.events[Number(value)]?.second); break;
    case 'reset-demo':
      showModal('¿Empezar de nuevo?','<p>Se borra la partida de prueba guardada en este navegador: resultados, plantel, estadísticas y temporadas. Las ligas con amigos no se tocan.</p>',
        button('Cancelar','close-modal','','ghost')+button('Borrar y empezar','confirm-reset-demo','','primary','return'));
      break;
    case 'confirm-reset-demo':
      await resetDemo(bootData.returns,bootData.youth,bootData.names); closeModal(); resetDrafts(); resetFilters(); changePage('resumen'); notify('Empezaste una partida offline nueva.'); break;
    case 'skip-replay':
      pauseReplay();
      showModal('¿Mostrar el resultado?','<p>Se mostrará el marcador final y podrás consultar los resultados de la fecha.</p>',
        button('Seguir viendo','close-modal','','ghost')+button('Mostrar resultado','confirm-skip-replay','','primary','right'));
      break;
    case 'confirm-skip-replay': closeModal(); finishReplay(); break;
    case 'reveal-unavailable': revealMatch(value); closeModal(); changePage('resumen'); break;
    case 'match-fixture':
      selectedDivision=replay.fixture.division; tournamentRound=replay.fixture.round; tournamentClub=''; tournamentMode='Fixture'; changePage('torneo'); break;
    case 'open-league': await openLeague(value); break;
    case 'offline': league=null; resetFilters(); setEntry('mode'); break;
    case 'copy-code':
      try { await navigator.clipboard.writeText(league.code); notify('Código copiado.'); }
      catch { const range=document.createRange(); range.selectNodeContents(target.previousElementSibling); const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range); notify('Seleccionamos el código para que lo puedas copiar.'); }
      break;
  }
});

document.addEventListener('input',event=>{
  const input=event.target;
  if (input.id==='player-filter') {playerFilter=input.value; patchPlayers();}
  if (input.id==='market-text') { marketQuery.text=input.value; marketLimit=40; patchMarket(); }
  if (input.id==='club-search') {
    clubSearch=input.value;
    document.querySelector('#club-results').innerHTML=clubChoices(document.querySelector('#club-filter').dataset.explorer==='true');
  }
  if (input.id==='replay-seek'&&replay) {
    pauseReplay();
    seekReplay(Number(input.value));
  }
});
document.addEventListener('change',event=>{
  const input=event.target;
  if (input.id==='position-filter') { positionFilter=input.value; patchPlayers(); }
  if (input.dataset.market) { marketQuery[input.dataset.market]=input.value; marketLimit=40; patchMarket(); }
  if (input.id==='club-filter') {
    const explorer=input.dataset.explorer==='true';
    if (explorer) explorerDivision=input.value;
    else clubDivision=input.value;
    document.querySelector('#club-results').innerHTML=clubChoices(explorer);
  }
  if (input.id==='fixture-club') { tournamentClub=input.value; render(); }
  if (input.id==='fixture-round') { tournamentRound=Number(input.value); render(); }
  if (input.id==='retrain-player') { retrainPick=input.value; retrainTo=''; render(); }
  if (input.id==='retrain-to') { retrainTo=input.value; render(); }
  if (input.id==='replay-speed'&&replay) replay.speed=Number(input.value);
  if (input.classList.contains('lineup-pick')) {
    const slot=Number(input.dataset.slot);
    editVersion ??= league?.version;
    lineupDraft ??= [...lineup(currentClub())];
    const other=lineupDraft.indexOf(input.value);
    if (other!==-1 && other!==slot) {
      const moving=currentClub().players.find(p=>p.id===lineupDraft[slot]);
      if (moving&&!engine.canPlay(moving,engine.POSITIONS[other])) {
        notify('Ese jugador ya ocupa otro puesto.',true); render(); return;
      }
      lineupDraft[other]=lineupDraft[slot];
    }
    lineupDraft[slot]=input.value;
    render();
    app.querySelector('[data-slot="'+slot+'"]').focus();
  }
});

document.addEventListener('submit',async event=>{
  const form=event.target;
  if (form.id==='local-profile'||form.id==='offline-setup') {
    event.preventDefault();
    if (busy) return;
    const fields=new FormData(form), nickname=String(fields.get('nickname')??'').trim();
    if (!nickname) return notify('Ingresá un nombre para continuar.',true);
    if (form.id==='local-profile') {
      localProfileName=nickname;
      store.set('tt-local-profile',nickname);
      setEntry('mode');
      return;
    }
    const clubId=fields.get('clubId');
    if (!demo.clubs.some(c=>c.id===clubId)) return notify('Elegí un club disponible.',true);
    demoClubId=clubId;
    demoManager=nickname;
    store.set('tt-demo-club',clubId);
    setBusy(true);
    const saved=await persistDemo();
    setBusy(false);
    enterOffline();
    if (!saved) notify('No se pudo guardar la partida en este navegador.',true);
    return;
  }
  if (form.dataset.auth) {
    event.preventDefault();
    if (busy) return;
    const kind=form.dataset.auth, data=Object.fromEntries(new FormData(form));
    const submit=event.submitter;
    if (submit) submit.disabled=true;
    setBusy(true);
    try {
      me={...me,...await request('/api/auth/'+kind,{data})};
      setBusy(false);
      setEntry('mode');
      notify(kind==='register'?'Cuenta creada.':'Hola, '+me.name+'.');
    } catch (error) { notify(error.message,true); }
    finally { setBusy(false); if (submit) submit.disabled=false; }
    return;
  }
  if (event.target.id==='community-form') {
    event.preventDefault();
    if (busy) return;
    const f=Object.fromEntries(new FormData(event.target)), items=[];
    if (f.age) items.push({type:'age',value:Number(f.age)});
    if (f.active) items.push({type:'active',value:f.active==='true'});
    if (f.position) items.push({type:'position',value:f.position});
    if (f.name?.trim()) items.push({type:'name',value:f.name.trim()});
    if (f.stats?.trim()||f.level) items.push({type:'stats',value:{text:f.stats ?? '',level:f.level?Number(f.level):null}});
    if (!items.length) return notify('Completá al menos un dato.',true);
    setBusy(true);
    try {
      const playerId=event.target.dataset.playerId;
      await request('/api/community',{data:{playerId,items}});
      if (league) setLeague(await request('/api/leagues/'+league.code));
      else { const {history=[]}=await request('/api/community?playerId='+encodeURIComponent(playerId)) ?? {}; demo=applyCommunity(demo,history.map(h=>({...h,playerId}))); saveDemo(); }
      closeModal();
      render();
      const again=currentClub().players.find(x=>x.sourceRecordId===playerId); if (again) showPlayer(again.id);
      notify('Gracias. El dato ya se aplica en todas las ligas.');
    } catch (error) { notify(error.message,true); }
    finally { setBusy(false); }
    return;
  }
  if (event.target.id==='edit-player-form') {
    event.preventDefault();
    const f=Object.fromEntries(new FormData(event.target)), playerId=event.target.dataset.playerId;
    if (await act('edit-player',{playerId,name:f.name,age:f.age?Number(f.age):undefined,position:f.position||undefined})) { closeModal(); showPlayer(playerId); }
    return;
  }
  if (event.target.id==='assign-senior') {
    event.preventDefault();
    const {playerId}=event.target.dataset;
    const seniorSquad=new FormData(event.target).get('seniorSquad');
    if (await act('assign-senior',{playerId,seniorSquad})) closeModal();
    return;
  }
  const kind=event.target.dataset.leagueForm;
  if (!kind) return;
  event.preventDefault();
  if (busy) return;
  const data=Object.fromEntries(new FormData(event.target));
  const code=data.code?.trim().toUpperCase();
  delete data.code;
  data.nickname=data.nickname.trim();
  if (data.name!==undefined) data.name=data.name.trim();
  if (!data.nickname || data.name==='') return notify('Completá los nombres para continuar.',true);
  const submit=event.submitter;
  if (submit) submit.disabled=true;
  setBusy(true);
  try {
    setLeague(await request(kind==='create'?'/api/leagues':'/api/leagues/'+code+'/join',{data}));
    resetFilters();
    setBusy(false);
    entryStage=null;
    rememberEntry('online',league.code);
    changePage('resumen');
    notify(kind==='create'?'Creaste tu liga privada.':'Ya estás en la liga.');
  } catch (error) {
    notify(error.message,true);
  } finally {
    setBusy(false);
    if (submit) submit.disabled=false;
  }
});

document.addEventListener('keydown',event=>{
  if (!modalRoot.firstChild) return;
  if (event.key==='Escape') closeModal();
  if (event.key!=='Tab') return;
  const focusable=[...modalRoot.querySelectorAll('button:not(:disabled), input, select, a[href]')];
  if (event.shiftKey&&document.activeElement===focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
  else if (!event.shiftKey&&document.activeElement===focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
});
document.addEventListener('error',event=>{
  if (event.target.tagName!=='IMG') return;
  const img=event.target;
  const fallback=img.nextElementSibling;
  if (!fallback) return;
  img.hidden=true;
  fallback.hidden=false;
},true);
function routeFromHash() {
  const [route,id,tab] = location.hash.slice(1).split('/');
  if (route==='jugador'&&id) {
    try { profileId=decodeURIComponent(id); } catch { return 'plantel'; }
    profileTab=profileTabs.some(([key])=>key===tab)?tab:'perfil';
    return route;
  }
  return views.has(route)?route:'resumen';
}
window.addEventListener('hashchange',()=>{
  if (entryStage||location.hash==='#main-content') return;
  changePage(routeFromHash(),false);
});

// The test game (no league) is saved in this browser (IndexedDB: a season weighs several MB, too much for
// localStorage) after every change, and restored on load. Saves are per browser; leagues stay on the server.
const SAVE_DB = 'tercer-tiempo', SAVE_STORE = 'saves', SAVE_KEY = 'demo';
function saveDb() {
  return new Promise((resolve,reject)=>{ try { const open=indexedDB.open(SAVE_DB,1);
    open.onupgradeneeded=()=>open.result.createObjectStore(SAVE_STORE);
    open.onsuccess=()=>resolve(open.result); open.onerror=()=>reject(open.error); } catch (error) { reject(error); } });
}
async function saveTx(mode, run) {
  const db=await saveDb();
  return new Promise((resolve,reject)=>{ const tx=db.transaction(SAVE_STORE,mode), req=run(tx.objectStore(SAVE_STORE));
    tx.oncomplete=()=>{ db.close(); resolve(req?.result); }; tx.onerror=tx.onabort=()=>{ db.close(); reject(tx.error); }; });
}
let saveTimer;
async function persistDemo() {
  hasDemoSave=true;
  try {
    await saveTx('readwrite',store=>store.put({world:demo,clubId:demoClubId,manager:demoManager,savedAt:Date.now()},SAVE_KEY));
    return true;
  } catch { return false; }
}
function saveDemo() {
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{ if (!await persistDemo()) notify('No se pudo guardar la partida en este navegador.',true); },150);
}
const loadDemo = () => saveTx('readonly',st=>st.get(SAVE_KEY)).catch(()=>null);
async function resetDemo(returns,youth,names) {
  clearTimeout(saveTimer);
  await saveTx('readwrite',st=>st.delete(SAVE_KEY)).catch(()=>{});
  try { for (let i=localStorage.length-1;i>=0;i--) { const k=localStorage.key(i); if (k?.startsWith('tt-watched-v1:demo:')) localStorage.removeItem(k); } } catch {}
  watchedFixtures.clear();
  demo=initialWorld(catalog,2026,returns,youth,names);
}
let bootData;

async function boot() {
  const emptyData={players:[],sources:[]};
  const [data,returns,youth,names,identity]=offline
    ? [window.__RM_CATALOG,window.__RM_RETURNS??emptyData,window.__RM_YOUTH??emptyData,window.__RM_NAMES??{},{signedIn:false}]
    : await Promise.all([
    request('/catalog.json'),
    request('/returns.json').catch(()=>emptyData),
    request('/youth.json').catch(()=>emptyData),
    request('/names.json').catch(()=>({})),
    request('/api/me').catch(()=>({signedIn:false})),
  ]);
  catalog={...data,returns,youth};
  catalogClubs=new Map(catalog.clubs.map(c=>[c.id,c]));
  bootData={returns,youth,names};
  const saved=await loadDemo();
  try { if (saved?.world?.clubs) { demo=enrichRosterIdentities(saved.world,catalog); if (saved.clubId) demoClubId=saved.clubId; demoManager=saved.manager ?? ''; hasDemoSave=true; } } catch { demo=undefined; }
  if (!demo) demo=initialWorld(catalog,2026,returns,youth,names);
  if (!demo.clubs.some(c=>c.id===demoClubId)) demoClubId=defaultClub;
  me=identity;
  const route=routeFromHash();
  const next=route==='partido'?'resumen':route;
  const restored=readActiveEntry();
  entryStage=entryIdentity()?'mode':'auth';
  if (entryIdentity()&&!invitationCode()&&restored?.identity===entryIdentity()) {
    if (restored.mode==='offline'&&hasDemoSave) enterOffline(next);
    else if (restored.mode==='online'&&me.signedIn&&/^[A-F0-9]{12}$/.test(restored.code ?? '')) {
      if (!await openLeague(restored.code,false,next)) { setEntry('online'); refreshList(); }
    }
  }
  render();
  if (!offline) setInterval(pollLeague,10000);
}
boot().catch(error=>{
  app.innerHTML='<div class="boot">No pudimos abrir Rugby Manager 27.<span>'+esc(error.message)+'</span><a class="btn primary" href="/">Volver a intentar</a></div>';
});
