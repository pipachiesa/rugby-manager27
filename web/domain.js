import * as E from './engine.js';
import * as Stats from './player-stats.js';
export const DIVISIONS = {'top14':'Top 14','primera-a':'Primera A','primera-b':'Primera B'};
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;};
// Ratings and player data are a retrospective game snapshot, not real contracts or availability.
export const DATA_VERSION=22;
export const SIMULATION_DATE='2026-11-10';
export function ageOnDate(birthDate, referenceDate){
 const valid=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;};
 if(!valid(birthDate)||!valid(referenceDate)||birthDate>referenceDate)return null;
 return Number(referenceDate.slice(0,4))-Number(birthDate.slice(0,4))-(referenceDate.slice(5)<birthDate.slice(5)?1:0);
}
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const positionOf=r=>r.position==='Octavo'?'Número 8':r.position==='Tercera línea'?'Ala':r.position;
/** A documented birth date always wins. An unaccredited estimate yields an age flagged ageEstimated, never ageKnown. */
const ageFields=(record,date)=>{
 const age=ageOnDate(record?.birthDate,date);
 if(age!==null)return {age,ageKnown:true,ageEstimated:false,birthDate:record.birthDate,estimatedBirthDate:null,ageAsOf:date};
 const estimate=ageOnDate(record?.estimatedBirthDate,date);
 return {age:estimate,ageKnown:false,ageEstimated:estimate!==null,birthDate:null,estimatedBirthDate:estimate===null?null:record.estimatedBirthDate,ageAsOf:date};
};
/**
 * Career stage drives development. A known or estimated age decides it; without one, the Primera trajectory
 * (Top 12/14 or Primera A seasons on published line-ups, 2019 and 2021-2026: 7 seasons) stands in. Seasons in which the
 * club played Primera A without published line-ups are unknown; when they could change the label the trajectory is
 * incomplete and gives no stage, so those players are never treated as debutants.
 */
export const TRAJECTORY_LABELS=[[7,'Veterano'],[6,'Experimentado'],[4,'Jugador de Primera'],[2,'Joven'],[1,'Debutante']];
const labelIndex=n=>TRAJECTORY_LABELS.findIndex(([min])=>n>=min);
/** Complete when the unknown seasons cannot move the player to another label. */
export const trajectoryComplete=t=>labelIndex(t.seasons)===labelIndex(t.seasons+(t.unknownSeasons??0));
export function trajectoryLabel(p){
 const t=p?.trajectory;if(!t?.seasons)return null;
 if(!t.complete)return 'Historial incompleto';
 return TRAJECTORY_LABELS.find(([min])=>t.seasons>=min)[1];
}
export function careerStage(p){
 if(p?.age!=null)return p.age<=21?'rising':p.age<=24?'growing':p.age<=29?'prime':p.age<=32?'steady':'declining';
 const t=p?.trajectory;if(!t?.seasons||!t.complete)return null;
 return t.seasons<=1?'rising':t.seasons<=3?'growing':t.seasons<=5?'prime':t.seasons<=6?'steady':'declining';
}
const GROWTH_EVERY={rising:12,growing:20,prime:40};
const trajectoryFields=(record,gameSeasons=0)=>{const t=record?.trajectory;if(!t)return {trajectory:null};
 const trajectory={seasons:t.seasons+gameSeasons,firstSeason:t.firstSeason,unknownSeasons:t.unknownSeasons??0,primeraASeasons:t.primeraASeasons??0,officialSeasons:t.officialSeasons??0,pressSeasons:t.pressSeasons??0,gameSeasons};
 return {trajectory:{...trajectory,complete:trajectoryComplete(trajectory)}};};
const recordFor=(player,club,catalog,returns)=>player.fictional?null:(catalog.players.find(r=>r.clubId===club.id&&(r.id===player.sourceRecordId||[r.name,...(r.nameAliases??[])].some(n=>norm(n)===norm(player.name))))??returns.players.find(r=>r.originClubId===club.id&&norm(r.name)===norm(player.name)));
const ESTIMATE_NOTICE='Se agregaron edades estimadas (~) a partir de planteles de ESPN; no son fechas de nacimiento acreditadas.';
const CALIBRATION_NOTICE='Motor recalibrado con resultados URBA 2016-2026: más localía, menos azar del día, fuerzas de club según el ranking real y tácticas equilibradas.';
/** Club strength from the catalog plus squad levelling; works on copies so the saved world is never mutated. */
const recalibrateClubs=(world,catalog)=>({...world,clubs:world.clubs.map(club=>{
 const strength=E.localClubStrength(catalog.clubs.find(x=>x.id===club.id)?.strength??72,club.division);
 return E.levelClubSquad({...club,strength,players:club.players.map(p=>({...p,attributes:{...p.attributes}}))});
})});
/**
 * Pedigree floors (Pumas, Pampas, Europe…) redistribute inside the club instead of adding to it: the club level is
 * calibrated on real results, which already reflect its internationals. Floors and levelling alternate so the others
 * move down a little; the last pass keeps every floor. Mutates and returns the club.
 */
const PEDIGREE_SHARE=.75;
function levelWithFloors(club,catalog){
 const floors=club.players.map(p=>[p,!p.fictional&&p.squad==='Plantel superior'?catalog.players.find(x=>x.id===p.sourceRecordId)?.quality?.floor:0]).filter(([,f])=>f);
 E.levelClubSquad(club);
 if(!floors.length)return club;
 // Three quarters of what the floors add to the XV stay with the club (in-game its internationals play every round; in the
 // results used for calibration they often missed rounds with their franchise); the rest comes from the others.
 const xv=new Set(E.autoLineup(club)),excess=floors.filter(([p])=>xv.has(p.id)).reduce((n,[p,f])=>n+Math.max(0,f-E.overall(p)),0)/15;
 for(const [p,f] of floors)p.attributes=raiseToFloor(p,f);
 E.levelClubSquad(club,PEDIGREE_SHARE*excess);
 for(const [p,f] of floors)p.attributes=raiseToFloor(p,f);
 return club;
}
const requalifyClubs=(world,catalog)=>({...world,clubs:world.clubs.map(club=>{
 const base=club.strength+E.seniorSquadAdjustment('Primera');
 const players=club.players.map(p=>{const r=!p.fictional&&p.squad==='Plantel superior'?catalog.players.find(x=>x.id===p.sourceRecordId):null;
  if(!r)return {...p,attributes:{...p.attributes}};
  const position=p.community?.position??p.position;
  return {...p,...(r.quality?.positions?{positions:[position,...r.quality.positions.filter(x=>x!==position&&E.POSITIONS.includes(x))]}:{}),attributes:qualityAttributes(r,position,base,`${club.id}/${r.id}`)};});
 return levelWithFloors({...club,players},catalog);
})});
/** Idempotent, non-destructive upgrade: results, IDs, lineup, training and fitness survive. Steps run in order. */
/**
 * A fictional player must not carry the name of a documented player (anywhere) or of a club-mate: the name generator
 * draws first names and surnames separately and could rebuild «Juan Akemeier». The first name is redrawn.
 */
const FIRST_NAMES=['Agustín','Bautista','Benjamín','Bruno','Facundo','Felipe','Franco','Gonzalo','Ignacio','Joaquín','Juan Cruz','Lautaro','Lucas','Manuel','Mateo','Matías','Nicolás','Pedro','Santino','Simón','Thiago','Tomás','Valentín','Lorenzo'];
export function uniqueFictionalNames(world,catalog){
 const real=new Set([...catalog.players.map(p=>norm(p.name)),...world.clubs.flatMap(c=>c.players.filter(p=>!p.fictional).map(p=>norm(p.name)))]);
 return {...world,clubs:world.clubs.map(c=>{const used=new Set(c.players.filter(p=>!p.fictional).map(p=>norm(p.name)));
  return {...c,players:c.players.map(p=>{if(!p.fictional)return p;let name=p.name;
   if(real.has(norm(name))||used.has(norm(name))){const surname=name.split(' ').slice(1).join(' ')||name;
    for(let i=0;i<FIRST_NAMES.length;i++){const cand=`${FIRST_NAMES[(hash(p.id)+i)%FIRST_NAMES.length]} ${surname}`;if(!real.has(norm(cand))&&!used.has(norm(cand))){name=cand;break;}}}
   used.add(norm(name));return name===p.name?p:{...p,name};})};})};
}
// Club strengths refitted on 12/11/2026 to the 2026 table, discounting one season of luck (scripts/fit-club-strength.mjs):
// catalogue strength before → after. Saved leagues shift each club's players by the same amount (v15).
const STRENGTH_FIT_V15={"newman":[89,95],"casi":[87,91],"hindu":[80,83],"alumni":[82,84],"sic":[82,85],"belgrano-athletic":[78,70],"cuba":[78,76],"atletico-del-rosario":[69,72],"los-matreros":[68,75],"champagnat":[63,61],"san-luis":[83,80],"san-cirano":[77,76],"lomas-athletic":[76,77],"curupayti":[78,76],"san-fernando":[72,74],"pucara":[70,74],"geba":[69,70],"san-andres":[64,65],"pueyrredon":[63,69],"olivos":[60,61],"deportiva-francesa":[60,53],"san-albano":[58,65],"universitario-la-plata":[53,59],"banco-nacion":[75,74],"cu-quilmes":[70,71],"liceo-naval":[70,68],"manuel-belgrano":[68,67],"mariano-moreno":[65,63],"san-martin":[64,65],"san-patricio":[61,62],"italiano":[63,61],"argentino":[58,59],"delta":[57,58],"monte-grande":[56,59],"liceo-militar":[48,49],"vicentinos":[45,48]};
export function migrateWorld(world,catalog,returns={players:[]},youth=catalog.youth??null){
 const version=world.dataVersion??0;
 const needsM17=Boolean(youth?.players)&&(world.urbaM17Revision??0)<1;
 if(version>=DATA_VERSION&&!needsM17)return world;
 // Capture recoverable match facts before any legacy transformation can slim or replace fixtures.
 world=Stats.recordPlayerStats(world);
 let next=world;const notices=[];
 if(version<2){
  const date=`${world.season??2026}-11-10`;
  const clubs=world.clubs.map(club=>({...club,strength:E.localClubStrength(catalog.clubs.find(x=>x.id===club.id)?.strength??72,club.division),players:club.players.map(player=>{
   const record=recordFor(player,club,catalog,returns);
   const base=E.localClubStrength(catalog.clubs.find(x=>x.id===club.id)?.strength??72,club.division)+(player.squad==='M19'?-3.05:player.squad==='M17'?-4.35:E.seniorSquadAdjustment(player.seniorSquad??'Primera'));
   return {...player,attributes:E.migratePlayerAttributes(player,base,club.strength),...(!player.fictional?ageFields(record,date):{}),...(record?{sourceRecordId:record.id,sourceIds:[...new Set([...(player.sourceIds??[]),...(record.sourceIds??[])])]}:{})};
  })}));
  const candidates=E.createReturnCandidates(clubs,world.seed,world.season,returns.players,returns.verifiedAt??SIMULATION_DATE);
  const already=new Set(clubs.flatMap(c=>c.players.filter(p=>!p.fictional).map(p=>c.id+'|'+norm(p.name))));
  next={...world,clubs,returnRecords:returns.players,returnObservedAt:returns.verifiedAt??SIMULATION_DATE,returnCandidates:candidates.filter(c=>!c.player.fictional&&!already.has(c.homeClubId+'|'+norm(c.player.name))),simulationDate:date};
  notices.push('Valoraciones recalibradas; resultados anteriores conservados. Las edades sin fecha de nacimiento verificada figuran como desconocidas o estimadas (~).');
 } else if(version<3){
  // v2 → v3 refreshes identities and ages only.
  const date=world.simulationDate??`${world.season??2026}-11-10`;
  next={...world,clubs:world.clubs.map(club=>({...club,players:club.players.map(player=>{const record=recordFor(player,club,catalog,returns);return player.fictional||!record?player:{...player,...ageFields(record,date),sourceIds:[...new Set([...(player.sourceIds??[]),...(record.sourceIds??[])])]};})}))};
  notices.push(ESTIMATE_NOTICE);
 }
 // v3 → v4: catalog strengths calibrated on URBA history and squad levelling. Every player of a club moves by the
 // same amount, so training progress and the order inside the squad are kept.
 if(version<4){next=recalibrateClubs(next,catalog);notices.push(CALIBRATION_NOTICE);}
 // v4 → v5: Top 14 trajectory for documented players (labels and development when the age is unknown).
 if(version<5){next={...next,clubs:next.clubs.map(club=>({...club,players:club.players.map(player=>{const record=recordFor(player,club,catalog,returns);return player.fictional||!record?player:{...player,...trajectoryFields(record)};})}))};notices.push('Se agregó la trayectoria en Primera de cada jugador documentado.');}
 // v5 → v6: how many of those seasons rest on official match sheets. Seasons earned in-game are kept.
 else if(version<6)notices.push('La trayectoria indica qué temporadas están confirmadas en planillas oficiales.');
 // v6 → v7: trajectory counted from 2019 with Primera A seasons and the official division index (v5/v6 fields are
 // rebuilt here too). Seasons earned in-game before gameSeasons existed: at most one per season played since 2026.
 if(version<7){
  const elapsed=Math.max(0,(next.season??2026)-2026);
  next={...next,clubs:next.clubs.map(club=>({...club,players:club.players.map(player=>{
   if(player.fictional)return player;const record=recordFor(player,club,catalog,returns);if(!record)return player;
   const earned=player.trajectory?.gameSeasons??Math.min(elapsed,player.trajectory?.seasons??0);
   return {...player,...trajectoryFields(record,earned)};
  })}))};
  if(version>=5)notices.push('Trayectoria recalculada desde 2019: suma Primera A y marca como incompleta la de quienes jugaron temporadas sin formaciones publicadas.');
 }
 // v7 → v8: individual quality for documented players (starts, experience, ESPN events, national and pro pedigree)
 // and their documented second positions. Fictional players, results and line-ups are kept; each club is levelled again.
 // v8 → v9: same rebuild with floors by last Pumas call-up and age, more weight for league performance, and overseas
 // candidates past 30 below their peak. Signed or contacted candidates keep their status.
 if(version<9){
  const date=next.returnObservedAt??SIMULATION_DATE;
  next={...next,returnCandidates:(next.returnCandidates??[]).map(c=>{const r=(next.returnRecords??returns.players).find(x=>norm(x.name)===norm(c.player.name));const q=r&&E.projectedReturnPlayer(r,next.season??2026,date);return q?{...c,player:{...c.player,attributes:q.attributes}}:c;})};
 }
 if(version<9){next=requalifyClubs({...next,clubs:next.clubs.map(c=>({...c,strength:E.localClubStrength(catalog.clubs.find(x=>x.id===c.id)?.strength??72,c.division)}))},catalog);notices.push('Valoraciones individuales recalculadas con titularidades, estadísticas y paso por selecciones o el profesionalismo; los jugadores pueden ocupar sus puestos secundarios documentados.');}
 // v9 → v10: parallel tournaments. Rounds already played are filled in with today's squads.
 if(version<10){next={...next,clubs:next.clubs.map(assignSeniorGroups)};for(const r of [...new Set(next.fixtures.filter(f=>f.match).map(f=>f.round))].sort((a,b)=>a-b))next=playParallelRound(next,r);notices.push('Se agregaron los torneos de Intermedia, Pre A, Pre B, M19 y M17, y el plantel superior se repartió por nivel entre las cuatro categorías; las fechas ya jugadas se completaron con los planteles actuales.');}
 // v10 → v11: fictional players named like a documented player or a club-mate get another first name.
 if(version<11)next=uniqueFictionalNames(next,catalog);
 // v11 → v12: Primera A and B clubs (by their catalogue division, wherever they play now) move up by the change in
 // their division baseline. Every player of the club moves by the same amount, so training and order are kept.
 if(version<12&&version>=1){next={...next,clubs:next.clubs.map(c=>{const rec=catalog.clubs.find(x=>x.id===c.id),division=DIVISIONS[rec?.competitionId];
  if(division!=='Primera A'&&division!=='Primera B')return c;
  const strength=E.localClubStrength(rec.strength??70,division),delta=strength-c.strength;if(Math.abs(delta)<.01)return c;
  return {...c,strength,players:c.players.map(p=>{const attributes=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>{const whole=Math.trunc(delta),frac=delta-whole;
   return [k,Math.max(1,Math.min(20,v+whole+(unit(next.seed,c.id,p.id,k,'v12')<Math.abs(frac)?Math.sign(frac):0)))];}));
   return {...p,attributes,potential:Math.max(p.potential,...Object.values(attributes))};})};
 })};notices.push('Primera A y B se recalibraron: sus clubes son algo más fuertes y un ascendido ya no queda tan lejos en el Top 14.');}
 // v12 → v13: club grounds for the local transfer market.
 if(version<13)next={...next,clubLocations:clubLocations(catalog)};
 // v13 → v14: a season that already ended gets its playoffs before the next one.
 if(version<14)next=schedulePlayoffs(next);
 if(version<15&&version>=1){next={...next,clubs:next.clubs.map(c=>{const m=STRENGTH_FIT_V15[c.id];if(!m)return c;
  const delta=(m[1]-m[0])*E.STRENGTH_SLOPE;
  return {...c,strength:c.strength+delta,players:c.players.map(p=>{const attributes=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>{const whole=Math.trunc(delta),frac=delta-whole;
   return [k,Math.max(1,Math.min(20,v+whole+(unit(next.seed,c.id,p.id,k,'v15')<Math.abs(frac)?Math.sign(frac):0)))];}));
   return {...p,attributes,potential:Math.max(p.potential,...Object.values(attributes))};})};
 })};notices.push('Se ajustó la fuerza de los clubes según la tabla 2026: Newman, CASI, Hindú, Alumni y SIC suben; Belgrano y Deportiva Francesa bajan, entre otros.');}
 if(version<16){
  // Reorganize the shared senior pool by current ability, without changing attributes or deleting training progress.
  next={...next,clubs:next.clubs.map(assignSeniorGroups)};
  notices.push('Se reorganizaron las categorías superiores por nivel sin alterar atributos ni formación. Se incorporaron estadísticas disponibles y una proyección de desarrollo flexible; no se inventaron datos de partidos incompletos.');
 }
 if(version<17){
  next=E.completeCurrentAcademyIntake(next);
  notices.push('La camada anual M17 se completa a 15 juveniles sin alterar jugadores ni resultados existentes.');
 }
 if(needsM17){
  next=attachSelectedM17(next,youth,false);
  notices.push('Se incorporó la convocatoria URBA M17 2026 cuando corresponde a la temporada, conservando los jugadores y resultados existentes.');
 }
 // v19: URBA M17 call-ups already in a saved league get the new level and projection (never lowered).
 if(version<19){let touched=false;next={...next,clubs:next.clubs.map(c=>{let changed=false;const players=c.players.map(p=>{
   if(!p.selectionLevel||p.fictional||!['M17','M19'].includes(p.squad)||(p.development?.originalProjection??0)>=SELECTED_M17_PROJECTION)return p;
   let q=p;const lift=Math.max(0,Math.min(5,Math.round((SELECTED_M17_NOW-E.overall(q))/5)));
   if(lift)q={...q,attributes:Object.fromEntries(Object.entries(q.attributes).map(([k,v])=>[k,Math.min(20,v+lift)]))};
   const projection=Math.min(85,Math.max(SELECTED_M17_PROJECTION,E.overall(q)+30));
   if(!lift&&(q.development?.originalProjection??0)>=projection)return p;
   changed=touched=true;return {...q,potential:Math.max(q.potential,Math.min(20,Math.round(projection/5)+1)),development:{...(q.development??{trainingGains:0,seasonTrainingGains:0}),originalProjection:Math.max(projection,q.development?.originalProjection??0),projection:Math.max(projection,q.development?.projection??0)}};});
  return changed?{...c,players}:c;})};
  if(touched)notices.push('Los convocados URBA M17 tienen mejor nivel y proyección.');}
 // v20: youth squads of a 2026 league follow the real M17/M19 tables (later seasons have moved on).
 if(version<20&&version>=1&&next.season===2026&&catalog.youthRanks){next=levelYouthByTables(next,catalog.youthRanks);notices.push('Las categorías M17 y M19 de cada club siguen ahora las tablas reales 2026 (Regatas, campeón M17; Newman, campeón M19).');}
 // v21: new attribute Juego aéreo (high balls), from jumping, handling and positioning like a new player gets it.
 if(version<21){next=withAerial(next);notices.push('Nuevo atributo: Juego aéreo. Las patadas al fondo, salidas y reinicios ahora se disputan en el aire.');}
 // v22: talent. Young players' stored projections spread out by talent (some project low, others high).
 if(version<22&&version>=1){next={...next,clubs:next.clubs.map(c=>({...c,players:c.players.map(E.withTalent)}))};notices.push('El potencial ahora pesa: cada juvenil tiene su propio techo, que sube con buenas temporadas y entrenamiento.');}
 return {...next,dataVersion:Math.max(version,DATA_VERSION),migrationNotice:notices.join(' ')};
}
const aerialPlayer=p=>!p?.attributes||p.attributes.aerial!=null?p:{...p,attributes:{...p.attributes,aerial:E.aerialFrom(p.position,p.attributes)}};
function withAerial(world){
 return {...world,clubs:world.clubs.map(c=>({...c,players:c.players.map(aerialPlayer)})),
  returnCandidates:(world.returnCandidates??[]).map(c=>({...c,player:aerialPlayer(c.player)})),
  ...(world.overseasCareers?{overseasCareers:world.overseasCareers.map(o=>({...o,player:aerialPlayer(o.player)}))}:{})};
}
export function enrichRosterIdentities(world,catalog){return migrateWorld(world,catalog,catalog.returns??{players:[]},catalog.youth??null);}
/**
 * Community contributions from the managers (trusted private community, no source required): approximate age, whether
 * the player still plays for the club, and position. Keyed by catalog record id, so every league gets them; the latest
 * contribution per player and type wins.
 *  - age: an approximate birth date (1 July of the year that gives that age when it was sent). It is an estimate (~N)
 *    that replaces an ESPN estimate but never a documented birth date, and it unfreezes development.
 *  - active=false: flagged in running leagues (nobody is removed mid-season); new leagues leave the player out.
 *  - position: replaces the position in the game.
 */
export const COMMUNITY_TYPES={age:'Edad aproximada',active:'¿Sigue en el club?',position:'Puesto',name:'Nombre',stats:'Comentario de estadísticas'};
export function validateContribution(c,now=new Date()){
 const type=String(c?.type??''),playerId=String(c?.playerId??'').slice(0,120);
 if(!COMMUNITY_TYPES[type])throw Error('Tipo de dato no válido.');
 if(!/^[a-z0-9-]+$/.test(playerId))throw Error('Jugador no válido.');
 let value=c?.value;
 if(type==='age'){const age=Number(value);if(!Number.isInteger(age)||age<15||age>45)throw Error('La edad tiene que ser un número entre 15 y 45.');value=`${now.getUTCFullYear()-age-(now.getUTCMonth()<6?1:0)}-07-01`;}
 else if(type==='active'){if(value!==true&&value!==false&&value!=='true'&&value!=='false')throw Error('Indicá si sigue en el club.');value=value===true||value==='true';}
 else if(type==='name'){value=String(value??'').trim().replace(/\s+/g,' ');if(!/^[\p{L}' .-]{3,60}$/u.test(value)||value.split(' ').length<2)throw Error('Escribí nombre y apellido.');}
 else if(type==='stats'){const text=String(value?.text??'').trim().slice(0,300),level=value?.level===''||value?.level==null?null:Number(value.level);
  if(level!==null&&(!Number.isInteger(level)||level<30||level>95))throw Error('El nivel sugerido va de 30 a 95.');
  if(text.length<5&&level===null)throw Error('Contá qué ves del jugador o sugerí un nivel.');value={text,level};}
 else{value=String(value);if(!E.POSITIONS.includes(value))throw Error('Puesto no válido.');}
 return {playerId,type,value,note:String(c?.note??'').trim().slice(0,200)};
}
const latestBy=(list,type,id)=>list.filter(c=>c.type===type&&c.playerId===id).sort((a,b)=>(a.at??0)-(b.at??0)).at(-1);
/** Community view of one catalog record: {birthDate?, active?, position?}. */
export function communityFor(contributions,id){
 const a=latestBy(contributions,'age',id),k=latestBy(contributions,'active',id),p=latestBy(contributions,'position',id),n=latestBy(contributions,'name',id);
 // Stats comments: the last five are kept; the median of the suggested levels nudges the player's rating.
 const stats=contributions.filter(c=>c.type==='stats'&&c.playerId===id).sort((x,y)=>(x.at??0)-(y.at??0)).slice(-5).map(c=>c.value);
 const levels=stats.map(x=>x.level).filter(Number.isFinite).sort((x,y)=>x-y),level=levels.length?levels[Math.floor(levels.length/2)]:null;
 return {...(a?{birthDate:a.value}:{}),...(k?{active:k.value}:{}),...(p?{position:p.value}:{}),...(n?{name:n.value}:{}),...(stats.length?{comments:stats.map(x=>x.text).filter(Boolean),...(level!==null?{level}:{})}:{})};
}
/** Catalog for a new league: players the community says left are out; position and approximate age are filled in. */
export function catalogWithCommunity(catalog,contributions=[]){
 if(!contributions.length)return catalog;
 return {...catalog,players:catalog.players.flatMap(r=>{const c=communityFor(contributions,r.id);if(c.active===false)return [];
  return [{...r,...(c.name?{name:c.name}:{}),...(c.position?{position:c.position}:{}),...(c.birthDate&&!r.birthDate?{estimatedBirthDate:c.birthDate}:{})}];})};
}
/** Idempotent: returns the same world when nothing changed. */
export function applyCommunity(world,contributions=[]){
 if(!contributions.length)return world;
 const ids=new Set(contributions.map(c=>c.playerId));let changed=false;
 const date=world.simulationDate??SIMULATION_DATE;
 const clubs=world.clubs.map(club=>{let touched=false;const players=club.players.map(p=>{
  if(p.fictional||!ids.has(p.sourceRecordId))return p;
  const community=communityFor(contributions,p.sourceRecordId);
  const reshaped=!community.position||p.reshapedFor===community.position;
  if(reshaped&&JSON.stringify(community)===JSON.stringify(p.community??{}))return p;
  let q={...p,community};
  if(community.birthDate&&!p.ageKnown)q={...q,...ageFields({estimatedBirthDate:community.birthDate},date)};
  if(community.name)q={...q,name:community.name};
  // A suggested level moves the rating half way towards it, at most two points per attribute, once per new value.
  if(Number.isFinite(community.level)&&p.levelAppliedFor!==community.level){const shift=Math.max(-2,Math.min(2,Math.round((community.level-E.overall(q))/2/5)));
   if(shift){const attributes=Object.fromEntries(Object.entries(q.attributes).map(([k,v])=>[k,Math.max(1,Math.min(20,v+shift))]));q={...q,attributes,potential:Math.max(q.potential,...Object.values(attributes))};}
   q={...q,levelAppliedFor:community.level};}
  // Rebuild the profile once per corrected position. A player moved before reshaping existed keeps the attributes of
  // his old role, which is unknown: his best overall over all positions stands for his level.
  if(!reshaped){const from=community.position!==p.position?p:{...p,position:[...new Set(E.POSITIONS)].reduce((best,x)=>E.overall({...p,position:x})>E.overall({...p,position:best})?x:best)};
   q={...q,position:community.position,attributes:E.reshapeForPosition(from,community.position),reshapedFor:community.position};}
  touched=changed=true;return q;
 });return touched?{...club,players}:club;});
 return changed?{...world,clubs}:world;
}

/**
 * Documented quality (scripts/apply-player-quality.mjs): starts and experience shift the level; ESPN events shape it.
 * Try scorers get pace and evasion, the club's kickers goal kicking, frequent cards cost discipline.
 */
const bump=(a,k,d)=>{a[k]=Math.max(1,Math.min(20,a[k]+d));};
function qualityAttributes(r,position,base,seed){
 const a=E.createPlayerAttributes(position,base,seed,r.quality?r.quality.offset:undefined),st=r.quality?.stats;
 if(!st)return a;
 if(st.triesPerStart>=.5){bump(a,'pace',2);bump(a,'acceleration',1);bump(a,'evasion',2);}else if(st.triesPerStart>=.3){bump(a,'pace',1);bump(a,'evasion',1);}
 if(st.kicksPerStart>=3){bump(a,'goalKicking',3);bump(a,'kicking',2);}else if(st.kicksPerStart>=1.5){bump(a,'goalKicking',2);bump(a,'kicking',1);}else if(st.kicksPerStart>=.5)bump(a,'goalKicking',1);
 if(st.dropsPerStart>=.1)bump(a,'kicking',1);
 if(st.cardsPerStart>=.15)bump(a,'discipline',-3);else if(st.cardsPerStart>=.08)bump(a,'discipline',-2);else if(st.cardsPerStart<=.02&&st.starts>=15)bump(a,'discipline',1);
 return a;
}
/** Lift attributes one point at a time, round-robin from the lowest, until the overall reaches the floor. */
function raiseToFloor(p,floor){
 const a={...p.attributes},keys=Object.keys(a);
 for(let i=0;i<keys.length*20&&E.overall({...p,attributes:a})<floor;i++){const k=keys.filter(k=>a[k]<20).sort((x,y)=>a[x]-a[y]||x.localeCompare(y))[0];if(!k)break;a[k]++;}
 return a;
}
const clubLocations=catalog=>Object.fromEntries(catalog.clubs.filter(c=>c.location).map(c=>[c.id,[c.location.lat,c.location.lng]]));
/**
 * Youth level from the real 2026 URBA tables (research/urba-youth-tables-2026.json): the average of a club's best 15
 * in M17 / M19 is set by its rank (1st ≈ 44 / 50; Ganadores 1–12, then Intermedia, then lower tiers). Clubs that are
 * not in the tables keep their level. A uniform shift per club keeps each junior relative to his team-mates.
 */
export function youthTarget(category,rank){
 if(!Number.isFinite(rank))return null;
 const top=category==='M17'?44:50;
 if(rank<=12)return top-(rank-1)*.8;
 if(rank<=24)return top-10-(rank-13)*.6;
 return top-18-Math.min(14,rank-25)*.4;
}
export function levelYouthByTables(world,ranks){
 if(!ranks)return world;
 return {...world,clubs:world.clubs.map(c=>{let players=c.players;
  for(const cat of ['M17','M19']){const target=youthTarget(cat,ranks[cat]?.[c.id]);if(target===null)continue;
   const best=players.filter(p=>p.squad===cat).map(p=>E.overall(p)).sort((a,b)=>b-a).slice(0,15);if(!best.length)continue;
   const delta=(target-best.reduce((a,b)=>a+b,0)/best.length)/5;if(Math.abs(delta)<.1)continue;
   const whole=Math.trunc(delta),frac=delta-whole;
   players=players.map(p=>p.squad!==cat?p:{...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,Math.max(1,Math.min(20,v+whole+(unit(world.seed,c.id,p.id,k,'youth26')<Math.abs(frac)?Math.sign(frac):0)))]))});
   players=players.map(p=>p.squad!==cat?p:{...p,potential:Math.max(p.potential,...Object.values(p.attributes))});
  }
  return players===c.players?c:{...c,players};})};
}
const SELECTED_M17_NOW=44,SELECTED_M17_PROJECTION=74;
/** Integrate a documented 2026 M17 selection without inventing ages or replacing existing career progress. */
export function attachSelectedM17(world,youth,replaceFictional=false){
 if(!youth?.players)return world;
 const records=youth.players.filter(r=>r.youthCategory==='M17'&&r.season===2026&&r.clubId&&E.POSITIONS.includes(positionOf(r)));
 const clubs=world.clubs.map(c=>({...c,players:[...c.players]}));
 const already=()=>clubs.flatMap(c=>c.players.filter(p=>!p.fictional));
 const used=new Set();
 for(const r of records){
  const destination=clubs.find(c=>c.id===r.clubId);if(!destination)continue;
  const all=already(),byId=all.find(p=>p.sourceRecordId===r.id);
  const sameClub=destination.players.filter(p=>!p.fictional&&norm(p.name)===norm(r.name));
  const existing=byId??(sameClub.length===1?sameClub[0]:null);
  if(existing){
   const owner=clubs.find(c=>c.players.includes(existing));
   const annotated={...existing,selectionLevel:r.selectionLevel,selectionSourceIds:[...new Set([...(existing.selectionSourceIds??[]),...(r.sourceIds??[])])],sourceIds:[...new Set([...(existing.sourceIds??[]),...(r.sourceIds??[])])]};
   owner.players=owner.players.map(p=>p===existing?annotated:p);continue;
  }
  // Later careers cannot be inferred from a 2026 selection; do not add missing historical players retroactively.
  if(world.season<2026||world.season>2027)continue;
  const pos=positionOf(r),index=replaceFictional?destination.players.findIndex(p=>p.fictional&&p.squad==='M17'&&p.position===pos&&!used.has(p.id)):-1;
  let template=index>=0?destination.players[index]:null;
  if(!template){
   const attrs=E.createPlayerAttributes(pos,destination.strength-4.35,`${destination.id}/${r.id}/m17`);
   template={id:`youth-${r.id}`,name:r.name,position:pos,squad:'M17',fictional:true,estimated:true,fitness:100,potential:Math.min(20,Math.max(...Object.values(attrs))+2),attributes:attrs};
  }
  // A URBA M17 call-up is among the best of his age (user, 12/11): he starts above the usual M17 (about 44 on 100)
  // and projects to a first-team player (72–80), never below what he already is. Still a projection, not a promise.
  const lift=Math.max(0,Math.min(5,Math.round((SELECTED_M17_NOW-E.overall(template))/5)));
  if(lift)template={...template,attributes:Object.fromEntries(Object.entries(template.attributes).map(([k,v])=>[k,Math.min(20,v+lift)]))};
  const now=E.overall(template),projection=Math.min(85,Math.max(SELECTED_M17_PROJECTION,now+30));
  template={...template,potential:Math.max(template.potential,Math.min(20,Math.round(projection/5)+1))};
  const player={...template,name:r.name,position:pos,positions:[pos],squad:'M17',fictional:false,estimated:true,
   ...ageFields(r,world.simulationDate??`${world.season}-11-10`),academyClubId:r.clubId,youthSeasons:world.season-2026,
   sourceRecordId:r.id,sourceIds:r.sourceIds,positionSourceIds:r.positionSourceIds,selectionLevel:r.selectionLevel,
   selectionSourceIds:r.sourceIds,development:{originalProjection:projection,projection,trainingGains:0,seasonTrainingGains:0}};
  used.add(template.id);if(index>=0)destination.players[index]=player;else destination.players.push(player);
 }
 return {...world,clubs,urbaM17Revision:1};
}
export function initialWorld(catalog,seed=2026,returns={players:[]},youth={players:[]},names={}){
 const defs=catalog.clubs.filter(c=>DIVISIONS[c.competitionId]).map(c=>({id:c.id,name:c.name,shortName:c.shortName,division:DIVISIONS[c.competitionId],color:c.colors?.[0]||'#248987',secondaryColor:c.colors?.[1]||'#fff',strength:E.localClubStrength(c.strength,DIVISIONS[c.competitionId])}));
 const s=E.createInitialState(seed,defs,names);s.clubLocations=clubLocations(catalog);s.dataVersion=DATA_VERSION;s.simulationDate=SIMULATION_DATE;s.returnRecords=returns.players;s.returnObservedAt=returns.verifiedAt??SIMULATION_DATE;
 for(const c of s.clubs){
  const used=new Set();
  for(const r of catalog.players.filter(p=>p.clubId===c.id&&!['departed','retired'].includes(p.rosterStatus))){
   const position=positionOf(r);if(!E.POSITIONS.includes(position))continue;
   let p=c.players.find(p=>p.squad==='Plantel superior'&&!used.has(p.id)&&p.position===position);
   if(!p){const template=c.players.find(p=>p.squad==='Plantel superior'&&p.position===position);if(!template)continue;p={...template,id:`documented-${r.id}`,attributes:{...template.attributes}};c.players.push(p);}
   used.add(p.id);Object.assign(p,{name:r.name,fictional:false,seniorSquad:'Primera',...ageFields(r,SIMULATION_DATE),...trajectoryFields(r),sourceRecordId:r.id,sourceIds:r.sourceIds,rosterStatus:r.rosterStatus,rosterEvidenceDate:r.rosterEvidenceDate,...(r.quality?.positions?{positions:r.quality.positions.filter(x=>E.POSITIONS.includes(x))}:{}),attributes:qualityAttributes(r,position,c.strength+E.seniorSquadAdjustment('Primera'),`${c.id}/${r.id}`)});
  }
  const youthUsed=new Set();
  for(const r of youth.players.filter(p=>p.clubId===c.id&&p.position&&p.youthCategory!=='M17')){
   const existing=c.players.find(p=>!p.fictional&&(p.sourceRecordId===r.catalogPlayerId||norm(p.name)===norm(r.name)));
   if(existing){existing.sourceIds=[...new Set([...(existing.sourceIds??[]),...(r.sourceIds??[])])];continue;}
   // A fictional junior of the same position makes room; with no free slot (published A and B line-ups) the squad
   // grows, from a template of that position. Team B starts one point lower in every attribute.
   let p=c.players.find(p=>p.squad==='M19'&&p.fictional&&!youthUsed.has(p.id)&&p.position===positionOf(r));
   if(!p){const template=c.players.find(p=>p.squad==='M19'&&p.position===positionOf(r));if(!template)continue;p={...template,id:`youth-${r.id}`,attributes:{...template.attributes}};c.players.push(p);}
   if(r.ovaladosTeam==='B')p.attributes=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,Math.max(1,v-1)]));
   youthUsed.add(p.id);Object.assign(p,{name:r.name,fictional:false,...ageFields(r,SIMULATION_DATE),sourceRecordId:r.id,sourceIds:r.sourceIds,positionSourceIds:r.positionSourceIds});
  }
 }
 // Level each club after documented players are placed, so club strength (not the seed) sets the XV level.
 for(const c of s.clubs)levelWithFloors(c,catalog);
 s.clubs=s.clubs.map(assignSeniorGroups);
 // Real reserves (Ovalados Intermedia / Pre A / Pre B): each takes the place of an invented senior of his position
 // and level band (Intermedia the best of them, Pre B the lowest), and starts in his published category.
 for(const c of s.clubs){const all=(catalog.reserves??[]).filter(r=>r.clubId===c.id);if(!all.length)continue;const used=new Set();
  // Alternate categories so each one gets its share of the invented places (Intermedia would otherwise take them all).
  const queues=['Intermedia','Pre A','Pre B'].map(k=>all.filter(r=>r.category===k)),list=[];
  for(let i=0;queues.some(q=>i<q.length);i++)for(const q of queues)if(q[i])list.push(q[i]);
  for(const r of list){const pool=c.players.filter(p=>p.squad==='Plantel superior'&&p.fictional&&!used.has(p.id)&&p.position===r.position).sort((a,b)=>E.overall(b)-E.overall(a));
   let p=pool[r.category==='Intermedia'?0:r.category==='Pre A'?Math.floor(pool.length/2):pool.length-1];
   // No invented place left in his position: the squad grows. He starts from a team-mate of his position (Intermedia
   // the middle one, Pre A the lowest, Pre B one point under the lowest).
   if(!p){const mates=c.players.filter(q=>q.squad==='Plantel superior'&&q.position===r.position).sort((a,b)=>E.overall(b)-E.overall(a));const t=r.category==='Intermedia'?mates[Math.floor(mates.length/2)]:mates.at(-1);if(!t)continue;
    p={id:`reserve-${r.id}`,name:r.name,position:r.position,positions:[r.position],squad:'Plantel superior',fitness:100,estimated:true,fictional:true,potential:t.potential,attributes:r.category==='Pre B'?Object.fromEntries(Object.entries(t.attributes).map(([k,v])=>[k,Math.max(1,v-1)])):{...t.attributes}};c.players.push(p);}
   used.add(p.id);Object.assign(p,{name:r.name,fictional:false,age:null,ageKnown:false,sourceRecordId:r.id,sourceIds:r.sourceIds,seniorSquad:r.category,reserveCategory:r.category});}}
 s.clubs=levelYouthByTables(s,catalog.youthRanks).clubs;
 const withM17=attachSelectedM17(s,youth,true);s.clubs=withM17.clubs;s.urbaM17Revision=withM17.urbaM17Revision;
 s.clubs=uniqueFictionalNames(s,catalog).clubs.map(E.boundGeneratedReserves);
 const official=catalog.fixtures.filter(f=>DIVISIONS[f.competitionId]&&Number.isInteger(f.round)&&f.homeClubId&&f.awayClubId);
 if(official.length===546&&official.every(f=>s.clubs.some(c=>c.id===f.homeClubId)&&s.clubs.some(c=>c.id===f.awayClubId)))s.fixtures=official.map(f=>({id:`${f.competitionId}-${f.round}-${f.homeClubId}-${f.awayClubId}`,division:DIVISIONS[f.competitionId],round:f.round,homeId:f.homeClubId,awayId:f.awayClubId,date:f.date,refereeId:f.refereeId,sourceIds:f.sourceIds}));
 // Same name at the candidate's origin club = same person; a namesake at another club is someone else.
 const already=new Set(s.clubs.flatMap(c=>c.players.filter(p=>!p.fictional).map(p=>c.id+'|'+norm(p.name))));
 s.returnCandidates=E.createReturnCandidates(s.clubs,seed,s.season,returns.players,s.returnObservedAt).filter(c=>!c.player.fictional&&!already.has(c.homeClubId+'|'+norm(c.player.name)));
 return s;
}
export function roundOf(s){return s.fixtures.filter(f=>!f.match).reduce((n,f)=>Math.min(n,f.round),Infinity);}
export function applyClubAction(s,clubId,action,p){
 const c=s.clubs.find(c=>c.id===clubId);if(!c)throw Error('Club no encontrado');
 if(action==='tactics'){
  const options={mentality:['Ofensiva','Equilibrada','Defensiva'],penalty:['Palos','Touch','Según marcador'],attack:['1-3-3-1','2-4-2'],defense:['Drift','Rush'],scrum:['Estable','Presión'],lineout:['Seguro','Competir'],maul:['Evitar','Usar'],kicking:['Conservador','Territorial'],ruck:['Rápido','Asegurar']};
  // Leagues saved before mentality and penalty choice existed send the calibrated defaults for them.
  const tactics={...E.DEFAULT_TACTICS,...p.tactics};
  if(!p.tactics||Object.entries(options).some(([k,v])=>!v.includes(tactics[k])))throw Error('Táctica no válida.');
  return E.setTactics(s,clubId,Object.fromEntries(Object.keys(options).map(k=>[k,tactics[k]])));
 }
 if(action==='lineup')return E.setLineup(s,clubId,p.ids);
 if(action==='promote'){
  const player=c.players.find(x=>x.id===p.playerId);if(!player)throw Error('Jugador no encontrado.');
  if(player.squad!=='M19')throw Error('Solo se promueven jugadores M19 al plantel superior.');
  return {...s,clubs:s.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===player.id?{...q,squad:'Plantel superior',seniorSquad:'Pre A'}:q)}:x)};
 }
 if(action==='assign-senior'){
  if(!['Primera','Intermedia','Pre A','Pre B'].includes(p.seniorSquad))throw Error('Categoría no válida.');
  const player=c.players.find(q=>q.id===p.playerId&&q.squad==='Plantel superior');if(!player)throw Error('Jugador no disponible.');
  return {...s,clubs:s.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===player.id?{...q,seniorSquad:p.seniorSquad}:q)}:x)};
 }
 if(action==='training'){
  if(!['Equilibrado','Ataque','Defensa','Formaciones'].includes(p.focus))throw Error('Plan no válido.');
  return {...s,training:{...s.training,[clubId]:p.focus}};
 }
 if(action==='youth-training'){
  if(!Object.hasOwn(YOUTH_PLANS,p.plan))throw Error('Plan juvenil no válido.');
  return {...s,youthTraining:{...s.youthTraining,[clubId]:p.plan}};
 }
 if(action==='train-player'){
  // An individual session costs fitness: train a starter just before a match and he plays tired.
  const pl=c.players.find(q=>q.id===p.playerId);if(pl?.injury)throw Error('Un lesionado no puede entrenar.');
  const next=E.trainPlayer(s,clubId,p.playerId,p.attribute,Stats.playerDevelopmentEvidence(s,p.playerId));if(next===s)return s;
  return {...next,clubs:next.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===p.playerId?{...q,fitness:Math.max(35,q.fitness-TRAINING_FATIGUE)}:q)}:x)};
 }
 if(action==='edit-player'){
  const pl=c.players.find(q=>q.id===p.playerId);if(!pl)throw Error('Jugador no encontrado.');
  if(!pl.fictional)throw Error('Los jugadores reales se corrigen con los datos de la comunidad.');
  const name=p.name==null?pl.name:String(p.name).trim().replace(/\s+/g,' ');
  if(!/^[\p{L}' .-]{3,60}$/u.test(name)||name.split(' ').length<2)throw Error('Escribí nombre y apellido.');
  const age=p.age==null?pl.age:Number(p.age);if(!Number.isInteger(age)||age<15||age>45)throw Error('La edad va de 15 a 45.');
  if(p.position&&!E.POSITIONS.includes(p.position))throw Error('Puesto no válido.');
  const position=p.position??pl.position;
  const edited={...pl,name,age,...(position!==pl.position?{position,positions:[position],attributes:E.reshapeForPosition(pl,position)}:{})};
  return {...s,clubs:s.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===pl.id?edited:q)}:x)};
 }
 if(action==='contact-player')return contactPlayer(s,clubId,p.playerId,p.offer);
 if(action==='retrain'){
  const player=c.players.find(q=>q.id===p.playerId&&q.squad==='Plantel superior');if(!player)throw Error('Jugador no disponible.');
  if(player.retraining)throw Error('Ya está aprendiendo otro puesto.');
  if(c.players.filter(q=>q.retraining).length>=MAX_RETRAINING)throw Error(`Se pueden reconvertir hasta ${MAX_RETRAINING} jugadores a la vez.`);
  const weeks=retrainOptions(player).find(o=>o.to===p.to)?.weeks;if(!weeks)throw Error('Ese cambio de puesto no es posible.');
  return {...s,clubs:s.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===player.id?{...q,retraining:{to:p.to,weeksLeft:weeks,weeksTotal:weeks}}:q)}:x)};
 }
 if(action==='cancel-retrain'){
  if(!c.players.some(q=>q.id===p.playerId&&q.retraining))throw Error('No hay reconversión en curso.');
  return {...s,clubs:s.clubs.map(x=>x.id===clubId?{...x,players:x.players.map(q=>q.id===p.playerId?{...q,retraining:null}:q)}:x)};
 }
 if(action==='contact-return')return E.contactReturn(s,clubId,p.candidateId);
 if(action==='sign-return')return E.signReturn(s,clubId,p.candidateId);
 throw Error('Acción no disponible.');
}
export const TRAINING_FATIGUE=10;
/**
 * Local transfer market. Amateur rugby: nobody is paid, so a player only moves for minutes and a short trip.
 * Interest grows with closeness (club grounds, research/club-locations.json), with how much more he would play
 * (Pre B at his club → XV at yours) and with a step up in division; it falls with age and for real players
 * (attachment to their club). One contact per round; a refusal stands for the season. Clubs with a manager are
 * off limits.
 */
const DIV_RANK={'Top 14':0,'Primera A':1,'Primera B':2};
const PLAY={XV:1,Primera:.75,Intermedia:.45,'Pre A':.25,'Pre B':.15};
export const SQUAD_LIMIT=130;
// Playtest 12/11: a manager signed 36 players in 5 seasons (29 % of contacts). Now 60 % at best and 4 a season.
export const MAX_INTEREST=.6,MAX_SIGNINGS=4;
export function clubDistance(world,a,b){
 const A=world.clubLocations?.[a],B=world.clubLocations?.[b];if(!A||!B)return null;
 const r=Math.PI/180,dLat=(B[0]-A[0])*r,dLng=(B[1]-A[1])*r;
 const h=Math.sin(dLat/2)**2+Math.cos(A[0]*r)*Math.cos(B[0]*r)*Math.sin(dLng/2)**2;
 return Math.round(12742*Math.asin(Math.sqrt(h)));
}
// The XV of each club is computed once per club object (market lists score thousands of players).
const xvCache=new WeakMap();
const xvOf=club=>{let x=xvCache.get(club);if(!x){x=new Set(E.effectiveLineup(club));xvCache.set(club,x);}return x;};
export function playerRole(club,player){return xvOf(club).has(player.id)?'XV':player.seniorSquad??'Intermedia';}
const depthCache=new WeakMap();
function roleAtBuyer(club,player){
 const slots=E.POSITIONS.filter(x=>x===player.position).length;
 let depth=depthCache.get(club);if(!depth){depth=new Map();depthCache.set(club,depth);}
 if(!depth.has(player.position))depth.set(player.position,club.players.filter(q=>q.squad==='Plantel superior'&&!q.injury&&E.canPlay(q,player.position)).map(q=>overall(q)));
 const level=overall(player),better=depth.get(player.position).filter(x=>x>level).length;
 return better<slots?'XV':better<slots*2?'Primera':better<slots*3?'Intermedia':'Pre A';
}
// The role you offer counts, but a promise above what he would really get is only half believed.
export const OFFER_ROLES=['XV','Primera','Intermedia','Pre A'];
export function transferInterest(world,buyerId,fromId,player,offer){
 const buyer=world.clubs.find(c=>c.id===buyerId),from=world.clubs.find(c=>c.id===fromId);
 const d=clubDistance(world,buyerId,fromId);
 const distF=d===null?.5:d<=8?1:d<=20?.8:d<=35?.5:d<=60?.22:.06;
 const now=playerRole(from,player),then=roleAtBuyer(buyer,player);
 const promised=OFFER_ROLES.includes(offer)?PLAY[offer]:PLAY[then],believed=promised>PLAY[then]?PLAY[then]+(promised-PLAY[then])*.5:promised;
 const roleF=Math.max(0,.15+(believed-PLAY[now])*1.1);
 const dd=DIV_RANK[from.division]-DIV_RANK[buyer.division];
 const divF=dd>0?1+.2*dd:dd<0&&!['Pre A','Pre B'].includes(now)?1+.25*dd:1;
 const age=Number.isFinite(player.age)?player.age:null;
 const ageF=age===null?.9:age>=31?.6:age>=27?.85:1.05;
 const chance=Math.min(MAX_INTEREST,distF*roleF*divF*ageF*(player.fictional?1:.8));
 return {chance:Math.round(chance*100)/100,distance:d,now,then,offer:OFFER_ROLES.includes(offer)?offer:then};
}
export function marketPlayers(world,buyerId,offer){
 const managed=new Set(world.managedClubs??[]);
 return world.clubs.filter(c=>c.id!==buyerId&&!managed.has(c.id)).flatMap(c=>c.players.filter(p=>p.squad==='Plantel superior').map(p=>({player:p,clubId:c.id,division:c.division,...transferInterest(world,buyerId,c.id,p,offer)})));
}
function contactPlayer(s,clubId,playerId,offer){
 const round=roundOf(s);if(!Number.isFinite(round))throw Error('La temporada terminó: el mercado abre en la pretemporada.');
 const t=s.transfers??{};
 // The round number repeats every season: the contact key carries the season too (playtest 12/11).
 if(t.contacts?.[clubId]===`${s.season}-${round}`)throw Error('Ya hiciste un contacto en esta fecha.');
 const from=s.clubs.find(c=>c.id!==clubId&&c.players.some(p=>p.id===playerId&&p.squad==='Plantel superior'));
 if(!from)throw Error('Jugador no disponible.');
 if((s.managedClubs??[]).includes(from.id))throw Error('Ese club tiene manager: no se pueden contactar sus jugadores.');
 if((t.refused?.[clubId]??[]).includes(playerId))throw Error('Ya te dijo que no esta temporada.');
 if((t.log??[]).filter(x=>x.to===clubId&&x.season===s.season).length>=MAX_SIGNINGS)throw Error(`Ya incorporaste ${MAX_SIGNINGS} jugadores esta temporada: es el máximo.`);
 const buyer=s.clubs.find(c=>c.id===clubId);
 if(buyer.players.filter(p=>p.squad==='Plantel superior').length>=SQUAD_LIMIT)throw Error(`Tu plantel superior está completo (${SQUAD_LIMIT}).`);
 const player=from.players.find(p=>p.id===playerId),{chance,offer:role}=transferInterest(s,clubId,from.id,player,offer);
 const accepted=unit(s.seed,s.season,round,clubId,playerId,'transfer')<chance;
 const newsRound=Math.max(0,round-1),contacts={...t.contacts,[clubId]:`${s.season}-${round}`};
 if(!accepted){
  const news=[...(s.news??[]),{round:newsRound,season:s.season,clubId,kind:'transfer',playerId,text:`${player.name} no aceptó: prefiere seguir en ${from.name}.`}];
  return {...s,news,transfers:{...t,contacts,refused:{...t.refused,[clubId]:[...(t.refused?.[clubId]??[]),playerId]}}};
 }
 const moved={...player,academyClubId:player.academyClubId??from.id,retraining:null,joinedFrom:from.id,joinedSeason:s.season,seniorSquad:role==='XV'?'Primera':role,promise:{role,season:s.season}};
 const clubs=s.clubs.map(c=>c.id===from.id?{...c,players:c.players.filter(p=>p.id!==playerId),lineup:(c.lineup??[]).filter(id=>id!==playerId)}:c.id===clubId?{...c,players:[...c.players,moved]}:c);
 const news=[...(s.news??[]),{round:newsRound,season:s.season,clubId,kind:'transfer',playerId,text:`${player.name} aceptó sumarse desde ${from.name}${role==='XV'?' con la promesa de ser titular':role==='Primera'?' para el plantel de Primera':` para jugar en ${role}`}.`},{round:newsRound,season:s.season,clubId:from.id,kind:'transfer',playerId,text:`${player.name} se fue a ${buyer.name}.`}];
 return {...s,clubs,news,transfers:{...t,contacts,log:[...(t.log??[]),{season:s.season,round,playerId,from:from.id,to:clubId}]}};
}
/** Board objective by pre-season strength rank in the division: title, top 4, top half or staying up. */
export function clubObjective(world,clubId){
 const c=world.clubs.find(x=>x.id===clubId);const rivals=world.clubs.filter(x=>x.division===c.division).sort((a,b)=>b.strength-a.strength);
 const rank=rivals.findIndex(x=>x.id===clubId)+1,n=rivals.length;
 if(rank<=2)return {level:'Máxima',text:'Pelear el campeonato',target:2,rank,n};
 if(rank<=5)return {level:'Alta',text:'Terminar entre los cuatro primeros',target:4,rank,n};
 if(rank<=Math.ceil(n*.65))return {level:'Media',text:'Terminar en la mitad de arriba',target:Math.ceil(n/2),rank,n};
 return {level:'Baja',text:'Evitar el descenso',target:n-2,rank,n};
}
/**
 * Injuries (research/injuries.json). Time-loss match injuries per 1000 player-hours at our level; a starter plays
 * 80 minutes, a replacement about half. Fatigue (low fitness) raises the risk. Deterministic per seed, round and player.
 * Expected: about 16 injuries per club per season and 2-4 players out at a time.
 */
// 30 per 1000 match hours: Argentine senior amateur study (30.9, 2019) and England community rugby (CRISP 29.2,
// 2021-22). Type shares and days lost: research/injuries.json (concussion share and overall rates sourced; most other
// shares and durations are documented estimates).
export const INJURY_RATE_PER_1000H=30;
export const INJURY_TYPES=[
 // [id, name, share, days median, days min, days max, forwards multiplier]
 ["conmocion-cerebral","Conmoción cerebral",0.17,16,12,28,1.0],
 ["desgarro-isquiotibial","Desgarro isquiotibial",0.09,21,7,60,0.6],
 ["esguince-tobillo","Esguince de tobillo",0.07,21,7,56,1.0],
 ["esguince-lcm-rodilla","Esguince de ligamento colateral medial (rodilla)",0.06,28,14,56,1.0],
 ["rotura-lca","Rotura de ligamento cruzado anterior",0.02,240,180,300,0.8],
 ["luxacion-inestabilidad-hombro","Luxación o inestabilidad de hombro",0.04,42,14,180,0.9],
 ["lesion-acromioclavicular","Lesión acromioclavicular",0.03,28,7,84,0.9],
 ["desgarro-gemelo","Desgarro de gemelo (pantorrilla)",0.04,21,7,42,0.6],
 ["contusion-muslo","Hematoma o contusión de cuádriceps",0.04,10,7,28,1.0],
 ["fractura-mano-dedos","Fractura de mano o dedos",0.04,35,21,56,1.0],
 ["fractura-facial-nasal","Fractura facial o nasal",0.03,21,10,42,1.0],
 ["otras-fracturas","Otras fracturas",0.04,56,28,120,1.0],
 ["cuello-espalda","Lesión de cuello o espalda",0.05,21,7,90,1.3],
 ["costillas-torax","Lesión de costillas o tórax",0.04,21,7,42,1.0],
 ["otras","Otras lesiones",0.24,14,7,60,1.0],
];
const unit=(...k)=>hash(k.join('|'))/4294967296;
function rollInjury(world,round,player,minutes,forward){
 const fitnessRisk=player.fitness<70?1.2:player.fitness<85?1.05:.95;
 const p=INJURY_RATE_PER_1000H/1000*minutes/60*fitnessRisk;
 if(unit(world.seed,world.season,round,player.id,'injury')>=p)return null;
 const weights=INJURY_TYPES.map(t=>t[2]*(forward?t[6]:1/t[6])),total=weights.reduce((a,b)=>a+b,0);
 let x=unit(world.seed,world.season,round,player.id,'type')*total,i=0;while(x>weights[i]&&i<weights.length-1)x-=weights[i++];
 const [type,name,,med,min,max]=INJURY_TYPES[i];
 // Skewed around the median: half below it, a long tail up to the maximum.
 const u=unit(world.seed,world.season,round,player.id,'days'),days=u<.5?min+(med-min)*u*2:med+(max-med)*((u-.5)*2)**2;
 return {type,name,weeksOut:Math.max(1,Math.ceil(days/7)),since:round,season:world.season};
}
const FORWARD=new Set(E.POSITIONS.slice(0,8));
/** Heals one week of every injury, then rolls new injuries for the players of the round just played. */
function applyInjuries(world,round){
 const played=world.fixtures.filter(f=>f.round===round&&f.match);
 const minutes=new Map();
 for(const f of played)for(const ids of [f.match.homeLineup,f.match.awayLineup])(ids??[]).forEach((id,i)=>id&&minutes.set(id,i<15?80:25));
 const news=[];
 const clubs=world.clubs.map(c=>({...c,players:c.players.map(p=>{
  let q=p;
  if(q.injury){const weeksOut=q.injury.weeksOut-1;
   if(weeksOut<=0){news.push({round,season:world.season,clubId:c.id,kind:'recovery',playerId:p.id,text:`${p.name} se recuperó (${q.injury.name.toLowerCase()}) y vuelve a estar disponible.`});q={...q,injury:null};}
   else q={...q,injury:{...q.injury,weeksOut}};}
  const m=minutes.get(p.id);
  if(m&&!q.injury){const injury=rollInjury(world,round,q,m,FORWARD.has(q.position));
   if(injury){q={...q,injury,injuries:[...(q.injuries??[]),{season:world.season,round,name:injury.name,weeks:injury.weeksOut}].slice(-20)};news.push({round,season:world.season,clubId:c.id,kind:'injury',playerId:p.id,text:`${p.name}: ${injury.name.toLowerCase()}. Baja estimada: ${injury.weeksOut} ${injury.weeksOut===1?'semana':'semanas'}.`});}}
  return q;
 })}));
 return {...world,clubs,news:[...(world.news??[]),...news].slice(-2000)};
}
/**
 * Parallel tournaments: Intermedia, Pre A, Pre B, M19 and M17 play the same fixture as Primera (same rival and venue
 * each round) and are simulated from squad strength, without a replay. Each team takes, position by position, the
 * best available player of its group; senior players left out of the Primera matchday squad drop to Intermedia, and a
 * short group borrows from the groups below. Results: world.parallel.results[fixtureId][category] = [home, away,
 * homeTries, awayTries]. Deterministic per seed, season, fixture and category.
 */
/** Spreads the senior squad by level: the XV and the best 23 in Primera, the rest in thirds (Intermedia, Pre A, Pre B). */
export function assignSeniorGroups(club){
 const xv=new Set(E.autoLineup(club)),seniors=club.players.filter(p=>p.squad==='Plantel superior').sort((a,b)=>(xv.has(b.id)-xv.has(a.id))||E.overall(b)-E.overall(a));
 const rest=Math.max(0,seniors.length-23),third=Math.ceil(rest/3);
 const group=new Map();let i=0;for(const [g,n] of [['Primera',23],['Intermedia',third],['Pre A',third]])for(const p of seniors.slice(i,i+=n))group.set(p.id,g);
 return {...club,players:club.players.map(p=>p.squad==='Plantel superior'?{...p,seniorSquad:group.get(p.id)??'Pre B'}:p)};
}
export const PARALLEL_CATEGORIES=['Intermedia','Pre A','Pre B','M19','M17'];
const SENIOR_ORDER=['Primera','Intermedia','Pre A','Pre B'];
const groupOf=p=>p.squad==='Plantel superior'?(p.seniorSquad??'Primera'):p.squad;
function categoryTeams(club,matchday){
 const used=new Set(matchday),teams={};
 const pick=(cat,pools)=>{const slots=E.POSITIONS.map(position=>{
  for(const pool of pools){const p=pool.filter(p=>!used.has(p.id)&&E.available(p)&&E.canPlay(p,position)).sort((a,b)=>E.overall(b)-E.overall(a))[0];if(p){used.add(p.id);return E.overall(p);}}
  // Nobody for the position: the best leftover of the group plays out of position, or the slot is a weak fill-in.
  const any=pools[0].filter(p=>!used.has(p.id)&&E.available(p)).sort((a,b)=>E.overall(b)-E.overall(a))[0];
  if(any){used.add(any.id);return E.overall(any)-6;}return null;});
  const known=slots.filter(x=>x!==null),base=known.length?known.reduce((a,b)=>a+b,0)/known.length:55;
  teams[cat]=slots.reduce((n,x)=>n+(x??base-10),0)/15;};
 const seniors=club.players.filter(p=>p.squad==='Plantel superior'),by=g=>seniors.filter(p=>groupOf(p)===g);
 pick('Intermedia',[[...by('Primera'),...by('Intermedia')],by('Pre A'),by('Pre B')]);
 pick('Pre A',[by('Pre A'),by('Pre B'),by('Intermedia')]);
 pick('Pre B',[by('Pre B'),seniors]);
 for(const cat of ['M19','M17'])pick(cat,[club.players.filter(p=>p.squad===cat)]);
 return teams;
}
const poisson=(lambda,u)=>{let k=0,p=Math.exp(-lambda),c=p;while(u>c&&k<25){k++;p*=lambda/k;c+=p;}return k;};
// 0.28 tries per overall point of difference, plus about one point of home advantage; conversions 62 %; about 1.4
// penalty goals a side.
function parallelScore(world,fixtureId,cat,rh,ra){
 const d=rh-ra+1,u=(...k)=>unit(world.seed,world.season,fixtureId,cat,...k),lam=x=>Math.max(.3,Math.min(10,3.2+.28*x));
 const side=(tries,s)=>tries*5+Array.from({length:tries},(_,i)=>u(s,'c',i)<.62?2:0).reduce((a,b)=>a+b,0)+3*poisson(1.4,u(s,'p'));
 const ht=poisson(lam(d),u('ht')),at=poisson(lam(-d),u('at'));
 return [side(ht,'h'),side(at,'a'),ht,at];
}
function playParallelRound(world,round){
 const results={...(world.parallel?.results??{})},clubs=Object.fromEntries(world.clubs.map(c=>[c.id,c]));
 for(const f of world.fixtures.filter(f=>f.round===round&&f.match&&!f.stage&&!results[f.id])){
  const h=categoryTeams(clubs[f.homeId],f.match.homeLineup??[]),a=categoryTeams(clubs[f.awayId],f.match.awayLineup??[]);
  results[f.id]=Object.fromEntries(PARALLEL_CATEGORIES.map(cat=>[cat,parallelScore(world,f.id,cat,h[cat],a[cat])]));
 }
 return {...world,parallel:{...(world.parallel??{}),season:world.season,results}};
}
/** Standings of a parallel category for a division, up to (not including) beforeRound. Same points as Primera. */
export function parallelStandings(world,division,cat,beforeRound=Infinity){
 const rows=world.clubs.filter(c=>c.division===division).map(c=>({clubId:c.id,played:0,won:0,drawn:0,lost:0,pointsFor:0,pointsAgainst:0,tries:0,bonus:0,points:0})),by=Object.fromEntries(rows.map(r=>[r.clubId,r]));
 for(const f of world.fixtures){const r=world.parallel?.results?.[f.id]?.[cat];if(!r||f.division!==division||f.round>=beforeRound)continue;
  const [hs,as,ht,at]=r,h=by[f.homeId],a=by[f.awayId];if(!h||!a)continue;
  for(const [row,pf,pa,t,ot] of [[h,hs,as,ht,at],[a,as,hs,at,ht]]){row.played++;row.pointsFor+=pf;row.pointsAgainst+=pa;row.tries+=t;
   if(pf>pa){row.won++;row.points+=4;}else if(pf<pa)row.lost++;else{row.drawn++;row.points+=2;}
   const bonus=(t>=ot+3?1:0)+(pf<pa&&pa-pf<=7?1:0);row.bonus+=bonus;row.points+=bonus;}
 }
 return rows.sort((a,b)=>b.points-a.points||(b.pointsFor-b.pointsAgainst)-(a.pointsFor-a.pointsAgainst)||b.pointsFor-a.pointsFor);
}
/**
 * Youth development. Juniors grow faster than seniors: after each round an M17 has a 45 % chance (M19, 40 %) of +1 in
 * an attribute of the club's youth plan. A flexible projection, age, season limits and confirmed playing evidence
 * shape growth; actual development can pass the original projection without guaranteeing an outcome.
 */
export const YOUTH_PLANS={
 Integral:{text:'Lo que más pesa en el puesto de cada juvenil.',attrs:null},
 Técnica:{text:'Pase, manejo, juego con el pie, visión y técnica.',attrs:['passing','handling','kicking','vision','technique']},
 Física:{text:'Velocidad, aceleración, fuerza, resistencia y agilidad.',attrs:['pace','acceleration','strength','stamina','agility']},
 Contacto:{text:'Tackle, acarreo, ruck, scrum y maul.',attrs:['tackling','carrying','breakdown','scrummaging','maul']},
 Juego:{text:'Decisiones, ubicación, temple, evasión, offload y juego aéreo.',attrs:['decisions','positioning','composure','evasion','offload','aerial']},
};
const YOUTH_CHANCE={M17:.45,M19:.4};
function developYouth(world,round){
 // Clubs with a manager get a weekly youth report in their inbox.
 const managed=new Set(world.managedClubs??[]),news=[];
 const clubs=world.clubs.map(c=>{const plan=YOUTH_PLANS[world.youthTraining?.[c.id]]??YOUTH_PLANS.Integral,grew=[];
  const players=c.players.map(p=>{
   // Talent also sets the pace: from 0.75× to 1.25× the usual weekly chance (1× on average).
   const chance=YOUTH_CHANCE[p.squad]*(.55+.45*E.talentFactor(p));if(!YOUTH_CHANCE[p.squad]||p.injury||unit(world.seed,world.season,round,p.id,'youth')>=chance)return p;
   const room=Object.keys(p.attributes).filter(a=>(plan.attrs?plan.attrs.includes(a):true)&&E.canDevelopAttribute(p,a));if(!room.length)return p;
   // Integral spreads the work over the 14 attributes that matter most for his position. A focused plan works on its
   // own five, more on those that weigh in his position: Contacto suits forwards, Técnica backs.
   const w=E.ratingWeights[p.position]??{},pickFrom=plan.attrs?room:room.sort((a,b)=>(w[b]??0)-(w[a]??0)).slice(0,14);
   const weightOf=a=>plan.attrs?1.5+(w[a]??0):1,total=pickFrom.reduce((n,a)=>n+weightOf(a),0);
   let x=unit(world.seed,world.season,round,p.id,'youth-attr')*total,i=0;while(i<pickFrom.length-1&&x>=weightOf(pickFrom[i]))x-=weightOf(pickFrom[i++]);
   const a=pickFrom[i];
   const improved=E.developPlayer(p,a,{seed:world.seed,season:world.season,round,mode:'youth',evidence:Stats.playerDevelopmentEvidence(world,p.id)});
   if(improved!==p)grew.push(`${p.name} (${p.squad}) +1 ${E.ATTRIBUTE_LABELS[a].toLowerCase()}`);
   return improved;
  });
  if(managed.has(c.id)&&grew.length)news.push({round,season:world.season,clubId:c.id,kind:'youth',text:`Cantera: ${grew.length} ${grew.length===1?'juvenil mejoró':'juveniles mejoraron'} esta semana. ${grew.slice(0,6).join('; ')}${grew.length>6?'…':''}.`});
  return {...c,players};});
 return {...world,clubs,news:[...(world.news??[]),...news].slice(-2000)};
}
/**
 * Position retraining: a senior player learns a related position over several rounds (one per week; an injured
 * player does not progress). Afterwards he can be picked there, like a documented second position. Only plausible
 * moves: front row among itself, lock and back row, half-back pairs, centres and back three. Never a prop to 10.
 */
export const RETRAIN_WEEKS={
 'Pilar izquierdo':{'Pilar derecho':6,'Hooker':8},'Pilar derecho':{'Pilar izquierdo':6,'Hooker':8},'Hooker':{'Pilar izquierdo':8,'Pilar derecho':8},
 'Segunda línea':{'Ala':6,'Número 8':8},'Ala':{'Segunda línea':8,'Número 8':4},'Número 8':{'Ala':4,'Segunda línea':8},
 'Medio scrum':{'Apertura':8},'Apertura':{'Medio scrum':8,'Centro':6,'Fullback':6},
 'Centro':{'Apertura':8,'Wing':4,'Fullback':6},'Wing':{'Centro':6,'Fullback':4},'Fullback':{'Wing':4,'Centro':6,'Apertura':8},
};
export const MAX_RETRAINING=3;
export function retrainOptions(p){
 const known=new Set([p.position,...(p.positions??[])]),out=new Map();
 // From any position he already plays; the shortest route wins.
 for(const from of known)for(const [to,weeks] of Object.entries(RETRAIN_WEEKS[from]??{}))if(!known.has(to)&&(!out.has(to)||out.get(to)>weeks))out.set(to,weeks);
 return [...out].map(([to,weeks])=>({to,weeks})).sort((a,b)=>a.weeks-b.weeks);
}
// injuredIds: players injured when the week started (they spend it with the physios).
function progressRetraining(world,round,weeks=1,injuredIds=new Set()){
 const news=[];
 const clubs=world.clubs.map(c=>({...c,players:c.players.map(p=>{
  if(!p.retraining||injuredIds.has(p.id))return p;
  const weeksLeft=p.retraining.weeksLeft-weeks;
  if(weeksLeft>0)return {...p,retraining:{...p.retraining,weeksLeft}};
  news.push({round,season:world.season,clubId:c.id,kind:'training',playerId:p.id,text:`${p.name} completó la reconversión: ya puede jugar de ${p.retraining.to.toLowerCase()}.`});
  return {...p,positions:[...new Set([p.position,...(p.positions??[]),p.retraining.to])],retraining:null};
 })}));
 return {...world,clubs,news:[...(world.news??[]),...news].slice(-2000)};
}
/**
 * A full match (event log and packed replay) weighs about 38 KB: 546 of them made a saved league about 24 MB, which
 * every action rewrites and every manager downloads. Only the matches of clubs with a manager (keep) keep their
 * replay; the rest keep score, tries, line-ups, tactics, analysis and the scoring events. Idempotent.
 */
export function slimMatches(world,keep){
 if(!keep)return world;
 return {...world,fixtures:world.fixtures.map(f=>{const m=f.match;
  if(!m||keep.has(f.homeId)||keep.has(f.awayId)||m.slim)return f;
  const {replayTrack,timeline,frames,...rest}=m;
  return {...f,match:{...rest,events:(m.events??[]).filter(e=>e.points!==undefined&&e.points>0),timeline:[],frames:[],slim:true}};
 })};
}
export const hasReplay=f=>Boolean(f.match&&!f.match.slim);
/**
 * URBA playoffs. Top 14: 1st–4th play semi-finals (1 v 4, 2 v 3, the better-placed at home) and the winners the URBA
 * final at a neutral ground; 13th and 14th go down. Primera A and B: the 1st goes up directly and 2nd–5th play
 * semi-finals and a neutral final for the second promotion place; the last two of Primera A go down. A drawn playoff
 * is won by the team with more tries, then by the better-placed one.
 */
export const PLAYOFF_RULES={'Top 14':{seeds:4,offset:0,title:'Final URBA',relegated:2},'Primera A':{seeds:4,offset:1,title:'Final por el ascenso',promoted:1,relegated:2},'Primera B':{seeds:4,offset:1,title:'Final por el ascenso',promoted:1}};
const regularDone=w=>w.fixtures.every(f=>f.stage||f.match);
export function playoffWinner(f,seedOf){const m=f.match;if(!m)return null;
 if(m.homeScore!==m.awayScore)return m.homeScore>m.awayScore?f.homeId:f.awayId;
 if(m.homeTries!==m.awayTries)return m.homeTries>m.awayTries?f.homeId:f.awayId;
 return (seedOf(f.homeId)??99)<=(seedOf(f.awayId)??99)?f.homeId:f.awayId;}
export function playoffState(w,division){
 const rule=PLAYOFF_RULES[division],table=E.getStandings(w,division),seeds=table.slice(rule.offset,rule.offset+rule.seeds).map(r=>r.clubId);
 const seedOf=id=>{const i=seeds.indexOf(id);return i<0?null:i+1;};
 const semis=w.fixtures.filter(f=>f.division===division&&f.stage==='semi'),final=w.fixtures.find(f=>f.division===division&&f.stage==='final');
 return {rule,table,seeds,seedOf,semis,final,winner:final?.match?playoffWinner(final,seedOf):null};
}
function schedulePlayoffs(w){
 if(!regularDone(w))return w;
 const last=Math.max(...w.fixtures.map(f=>f.round)),added=[],slug=d=>d.toLowerCase().replace(/\s+/g,'-');
 for(const division of Object.keys(PLAYOFF_RULES)){
  const st=playoffState(w,division);if(st.seeds.length<4)continue;
  if(!st.semis.length){const [a,b,c,d]=st.seeds;added.push(...[[a,d],[b,c]].map(([h,v],i)=>({id:`${slug(division)}-${w.season}-semi-${i+1}`,division,round:last+1,homeId:h,awayId:v,stage:'semi'})));}
  else if(!st.final&&st.semis.every(f=>f.match)){const [x,y]=st.semis.map(f=>playoffWinner(f,st.seedOf)).sort((p,q)=>st.seedOf(p)-st.seedOf(q));
   added.push({id:`${slug(division)}-${w.season}-final`,division,round:last+1,homeId:x,awayId:y,stage:'final',neutral:true});}
 }
 return added.length?{...w,fixtures:[...w.fixtures,...added]}:w;
}
/** Division moves after the playoffs: the champion of the final, direct promotion of the 1st, two relegated. */
export function seasonMoves(w){
 const moves={},top=playoffState(w,'Top 14'),a=playoffState(w,'Primera A'),b=playoffState(w,'Primera B');
 for(const r of top.table.slice(-2))moves[r.clubId]='Primera A';
 for(const id of [a.table[0]?.clubId,a.winner??a.table[1]?.clubId].filter(Boolean))moves[id]='Top 14';
 for(const r of a.table.slice(-2))moves[r.clubId]='Primera B';
 for(const id of [b.table[0]?.clubId,b.winner??b.table[1]?.clubId].filter(Boolean))moves[id]='Primera A';
 return moves;
}
export function advanceWorld(s,keep){
 s=schedulePlayoffs(s);
 const current=roundOf(s);if(!Number.isFinite(current))throw Error('La temporada terminó.');
 const injured=new Set(s.clubs.flatMap(c=>c.players.filter(p=>p.injury).map(p=>p.id)));
 if(keep)s={...s,managedClubs:[...keep]};
 s=E.autoPlayRound(s);
 s=Stats.recordPlayerStats(s);
 s=slimMatches(progressRetraining(developYouth(applyInjuries(playParallelRound(s,current),current),current),current,1,injured),keep);
 s=schedulePlayoffs(s);
 const clubs=s.clubs.map(c=>{const focus=s.training?.[c.id]||'Equilibrado';const attr={Equilibrado:'stamina',Ataque:'passing',Defensa:'tackling',Formaciones:'scrummaging'}[focus];return {...c,players:c.players.map(p=>{
  if(p.squad!=='Plantel superior')return p;// juniors follow the youth plan
  const every=GROWTH_EVERY[careerStage(p)];
  if(!every||hash(`${s.seed}-${current}-${p.id}`)%every!==0||!E.canDevelopAttribute(p,attr))return p;
  return E.developPlayer(p,attr,{seed:s.seed,season:s.season,round:current,mode:'senior',evidence:Stats.playerDevelopmentEvidence(s,p.id)});
 })};});return {...s,clubs};
}
export const overall=p=>E.overall(p);
/**
 * Retirements and departures between seasons, so promoted juniors do not inflate the senior squad forever:
 *  - from 33, a senior retires with probability 15 % per year past 32 (33: 15 %, 35: 45 %, up to 90 %);
 *  - a documented senior without a known age retires at 20 % a season once his Primera trajectory reaches 9 seasons;
 *  - beyond 66 seniors, the lowest-rated fictional players outside the XV leave the club, down to 64, as long as each
 *    position keeps four players who can play it.
 * Deterministic per seed and season; each case is announced in the news.
 */
const SQUAD_MAX=66,SQUAD_TARGET=64;
function squadTurnover(world){
 const news=[];
 const clubs=world.clubs.map(c=>{
  const xv=new Set(E.autoLineup(c));
  let players=c.players.filter(p=>{
   if(p.squad!=='Plantel superior')return true;
   const chance=p.age!=null?Math.min(.9,Math.max(0,(p.age-32)*.15)):(!p.fictional&&(p.trajectory?.seasons??0)>=9?.2:0);
   if(!chance||unit(world.seed,world.season,p.id,'retire')>=chance)return true;
   news.push({round:0,season:world.season,clubId:c.id,kind:'squad',playerId:p.id,text:`${p.name} se retiró${p.age!=null?` a los ${p.age} años`:''}.`});return false;});
  const seniors=players.filter(p=>p.squad==='Plantel superior');
  if(seniors.length>SQUAD_MAX){
   // Lowest-rated first, but every position keeps at least four players who can play it (injury cover).
   const out=new Set(),left=new Set(seniors.map(p=>p.id));
   for(const p of seniors.filter(p=>p.fictional&&!xv.has(p.id)).sort((a,b)=>E.overall(a)-E.overall(b))){
    if(left.size<=SQUAD_TARGET)break;
    if(seniors.filter(q=>left.has(q.id)&&q.id!==p.id&&E.canPlay(q,p.position)).length<4)continue;
    out.add(p.id);left.delete(p.id);
   }
   for(const p of seniors.filter(p=>out.has(p.id)))news.push({round:0,season:world.season,clubId:c.id,kind:'squad',playerId:p.id,text:`${p.name} dejó el club.`});
   players=players.filter(p=>!out.has(p.id));
  }
  return {...c,players,lineup:(c.lineup??[]).every(id=>players.some(p=>p.id===id))?c.lineup:undefined};
 });
 return {...world,clubs,news:[...(world.news??[]),...news].slice(-2000)};
}
export function advanceSeasonWorld(world){
 if(world.fixtures.some(f=>!f.stage&&!f.match))throw Error('Todavía hay partidos pendientes');
 // Playoffs not played yet (a league saved before they existed): they are simulated here.
 for(let i=0;i<3;i++){world=schedulePlayoffs(world);if(!world.fixtures.some(f=>!f.match))break;world=E.autoPlayRound(world);}
 world=Stats.recordPlayerStats(world);
 const next=E.advanceSeason({...world,nextDivisions:seasonMoves(world)},id=>Stats.playerDevelopmentEvidence(world,id)),date=`${next.season}-11-10`;delete next.nextDivisions;
 const champions=[...new Set(world.clubs.map(c=>c.division))].flatMap(division=>PARALLEL_CATEGORIES.map(category=>({season:world.season,division,category,clubId:parallelStandings(world,division,category)[0]?.clubId})).filter(x=>x.clubId));
// A new season reopens the market: refusals expire; the signings log keeps the last 200.
 next.transfers={log:(world.transfers?.log??[]).slice(-200)};
 next.parallel={season:next.season,results:{},champions:[...(world.parallel?.champions??[]),...champions].slice(-300)};
 // Primera champions of each division, for the club honours (palmarés).
 next.honours=[...(world.honours??[]),...[...new Set(world.clubs.map(c=>c.division))].map(division=>({season:world.season,division,clubId:division==='Top 14'?(playoffState(world,division).winner??E.getStandings(world,division)[0]?.clubId):E.getStandings(world,division)[0]?.clubId})).filter(x=>x.clubId)];
 const firstTeam=new Set(world.clubs.flatMap(c=>c.players.filter(p=>p.squad==='Plantel superior'&&(p.seniorSquad??'Primera')==='Primera').map(p=>p.id)));
 const rolled={...next,simulationDate:date,clubs:next.clubs.map(c=>({...c,players:c.players.map(p=>{
  let q=p.fictional?p:{...p,...ageFields(p,date)};
  if(q.trajectory&&firstTeam.has(q.id)){const t={...q.trajectory,seasons:q.trajectory.seasons+1,gameSeasons:(q.trajectory.gameSeasons??0)+1};q={...q,trajectory:{...t,complete:trajectoryComplete(t)}};}
  // Decline is physical first: one point of pace, acceleration and stamina per season past the stage.
  if(careerStage(q)==='declining')q={...q,attributes:{...q.attributes,...Object.fromEntries(['pace','acceleration','stamina'].map(a=>[a,Math.max(1,q.attributes[a]-1)]))}};
  // The off-season (about 16 weeks) heals most injuries; a long one (cruciate ligament) carries over.
  if(q.injury){const weeksOut=q.injury.weeksOut-16;q={...q,injury:weeksOut>0?{...q.injury,weeksOut}:null};}
  return q;
 })}))};
 // New season, new squads: promoted juniors and aged players are spread by level again. The preseason (16 weeks)
 // finishes any retraining in progress.
 const ready=evolveClubStrength(replenishSquads(squadTurnover(progressRetraining(rolled,0,16))));
 return {...ready,clubs:ready.clubs.map(assignSeniorGroups)};
}
/**
 * Clubs without a manager fill the holes of their XV between seasons (12/11/2026): for each position whose best
 * available player is more than REPLENISH_GAP rating points below what the club promises, a player of the club's
 * level arrives, up to REPLENISH_MAX per club. Without this the big clubs faded on their own (Top 14 XV -1.5 in five
 * seasons, Hindú -4.4) because retirements and departures to Europe were never replaced.
 */
const REPLENISH_GAP=6,REPLENISH_MAX=2;
function replenishSquads(world){
 const managed=new Set(world.managedClubs??[]),news=[];
 const clubs=world.clubs.map(c=>{
  if(managed.has(c.id))return c;
  let club=c;const added=[];
  const ids=E.autoLineup(club),byId=new Map(club.players.map(p=>[p.id,p]));
  const gaps=E.POSITIONS.map((position,i)=>{const p=byId.get(ids[i]);const promised=E.expectedOverall(position,club.strength+E.seniorSquadAdjustment('Primera'));
   return {i,gap:promised-(p&&E.canPlay(p,position)?E.overall(p):0)};}).filter(g=>g.gap>REPLENISH_GAP).sort((a,b)=>b.gap-a.gap).slice(0,REPLENISH_MAX);
  for(const g of gaps){const p=E.replacementPlayer(club,g.i,world.season,world.seed,world.nameWeights);if(club.players.some(q=>q.id===p.id))continue;club={...club,players:[...club.players,p]};added.push(p);}
  for(const p of added)news.push({round:0,season:world.season,clubId:c.id,kind:'squad',playerId:p.id,text:`${p.name} (${p.position}) se sumó al plantel.`});
  return added.length?{...club,lineup:undefined}:club;
 });
 return {...world,clubs,news:[...(world.news??[]),...news].slice(-2000)};
}
/**
 * Club strength moves slowly with the squad (12/11/2026): each season a quarter of the way towards the strength its
 * current XV implies, at most 0.3 attribute points (about 1.5 rating points). It sets the level of the next M17
 * classes, the replacements above and the club objective; matches never read it.
 */
const STRENGTH_DRIFT=.25,STRENGTH_STEP=.3;
function evolveClubStrength(world){
 return {...world,clubs:world.clubs.map(c=>{const step=Math.max(-STRENGTH_STEP,Math.min(STRENGTH_STEP,(E.impliedStrength(c)-c.strength)*STRENGTH_DRIFT));return {...c,strength:Math.round((c.strength+step)*100)/100};})};
}
