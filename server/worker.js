import * as E from '../web/engine.js';
import {initialWorld,applyClubAction,advanceWorld,advanceSeasonWorld,migrateWorld,roundOf,validateContribution,applyCommunity,catalogWithCommunity,communityFor} from '../web/domain.js';
const COMMUNITY_KEY='community/contributions',COMMUNITY_DAILY=60,COMMUNITY_MAX=50000;
const loadCommunity=async bucket=>{const ob=await bucket.get(COMMUNITY_KEY);return ob?{etag:ob.etag,list:await ob.json()}:{etag:null,list:[]};};
const json=(d,status=200,extra={})=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...extra}});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
// Own accounts: username + email + password. The email is kept only as a SHA-256 hash (to sign in with it and to keep
// it unique); the password as PBKDF2-SHA-256 with a random salt. Sessions are random tokens in an HttpOnly cookie,
// stored hashed in R2 for 30 days. Sites identity (oai-authenticated-user-id) still works alongside.
const SESSION_DAYS=30,PBKDF2_ITERATIONS=100000;
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:PBKDF2_ITERATIONS},key,256));}
const sameHash=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const cookieOf=(request,name)=>(request.headers.get('cookie')||'').match(new RegExp('(?:^|; )'+name+'=([A-Za-z0-9_-]+)'))?.[1];
const sessionCookie=(token,env,maxAge=SESSION_DAYS*86400)=>`tt_session=${token};Path=/;HttpOnly;SameSite=Lax;Max-Age=${maxAge}${env.LOCAL_DEV?'':';Secure'}`;
async function sessionUser(request,env){
 const token=cookieOf(request,'tt_session');if(!token||!env.BUCKET)return null;
 const ob=await env.BUCKET.get(`sessions/${await digest(token)}`);if(!ob)return null;const s=await ob.json();
 return s.expires>Date.now()?s:null;
}
async function handleAuth(request,env,url){
 const bucket=env.BUCKET;if(!bucket)return json({error:'Las cuentas todavía no están disponibles.'},503);
 if(url.pathname==='/api/auth/logout'){const token=cookieOf(request,'tt_session');if(token)await bucket.delete(`sessions/${await digest(token)}`);return json({ok:true},200,{'set-cookie':sessionCookie('x',env,0)});}
 const p=await request.json().catch(()=>({}));
 const start=async account=>{const token=hex(crypto.getRandomValues(new Uint8Array(32)));await bucket.put(`sessions/${await digest(token)}`,JSON.stringify({uid:'acct:'+account.id,name:account.username,expires:Date.now()+SESSION_DAYS*86400000}));return json({signedIn:true,name:account.username,account:true},200,{'set-cookie':sessionCookie(token,env)});};
 if(url.pathname==='/api/auth/register'){
  const username=String(p.username||'').trim(),email=String(p.email||'').trim().toLowerCase(),password=String(p.password||'');
  if(!/^[A-Za-z0-9_.]{3,20}$/.test(username))return json({error:'El usuario lleva de 3 a 20 letras, números, punto o guion bajo.'},400);
  if(!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email))return json({error:'Revisá el mail.'},400);
  if(password.length<8||password.length>200)return json({error:'La contraseña lleva al menos 8 caracteres.'},400);
  const emailKey=`accounts/email/${await digest(email)}`,userKey=`accounts/user/${username.toLowerCase()}`;
  if(await bucket.get(emailKey))return json({error:'Ya hay una cuenta con ese mail.'},409);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),account={id:hex(crypto.getRandomValues(new Uint8Array(12))),username,salt,hash:await passwordHash(password,salt),createdAt:Date.now()};
  if(!await bucket.put(userKey,JSON.stringify(account),{onlyIf:{etagDoesNotMatch:'*'}}))return json({error:'Ese usuario ya existe.'},409);
  if(!await bucket.put(emailKey,username.toLowerCase(),{onlyIf:{etagDoesNotMatch:'*'}})){await bucket.delete(userKey);return json({error:'Ya hay una cuenta con ese mail.'},409);}
  return start(account);
 }
 if(url.pathname==='/api/auth/login'){
  const login=String(p.login||'').trim().toLowerCase(),password=String(p.password||'');
  let name=login;if(login.includes('@')){const ob=await bucket.get(`accounts/email/${await digest(login)}`);name=ob?await ob.text():'';}
  const ob=name&&await bucket.get(`accounts/user/${name}`);const account=ob?await ob.json():null;
  if(!account||!sameHash(await passwordHash(password,account.salt),account.hash))return json({error:'Usuario, mail o contraseña incorrectos.'},401);
  return start(account);
 }
 return json({error:'Ruta no encontrada'},404);
}
export async function handle(request,env,assets,catalog,returns,youth,names={}){
 const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/')){
  const a=assets[url.pathname==='/'?'/index.html':url.pathname];if(!a)return new Response('No encontrado',{status:404});
  const body=a.encoding==='base64'?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body;
  return new Response(body,{headers:{'content-type':a.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
 }
 try{
 if(url.pathname.startsWith('/api/auth/')){
  if(request.method!=='POST'||request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Origen o formato no permitido'},403);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Solicitud demasiado grande'},413);
  return handleAuth(request,env,url);
 }
 const session=await sessionUser(request,env);
 const uid=session?.uid??request.headers.get('oai-authenticated-user-id');
 if(url.pathname==='/api/me')return json({signedIn:!!uid,account:!!session,name:session?.name??(uid?(request.headers.get('oai-authenticated-user-full-name')||'Manager'):null),storage:env.LOCAL_DEV?'local':'online'});
 if(!uid)return json({error:'Iniciá sesión para guardar tu liga online.'},401);
 if(!env.BUCKET)return json({error:'El guardado online todavía no está disponible.'},503);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')))return json({error:'Origen o formato no permitido'},403);
 if(request.method==='POST'&&Number(request.headers.get('content-length')||0)>65536)return json({error:'Solicitud demasiado grande'},413);
 const userKey=await digest(uid), bucket=env.BUCKET;
 // Community data: any signed-in manager can add an approximate age, whether a real player still plays for his club,
 // or his position. Shared by every league; the latest contribution wins. Contributor identity is stored hashed.
 if(url.pathname==='/api/community'){
  if(request.method==='GET'){const id=url.searchParams.get('playerId')??'';const {list}=await loadCommunity(bucket);
   return json({playerId:id,current:communityFor(list,id),history:list.filter(c=>c.playerId===id).slice(-20).map(({type,value,note,at})=>({type,value,note,at}))});}
  if(request.method!=='POST')return json({error:'Método no permitido'},405);
  const p=await request.json();const items=(Array.isArray(p.items)?p.items:[]).slice(0,5);
  if(!items.length)return json({error:'Completá al menos un dato.'},400);
  if(!catalog.players.some(r=>r.id===p.playerId)&&!(catalog.reserves??[]).some(r=>r.id===p.playerId))return json({error:'Ese jugador no está en el catálogo.'},404);
  const now=Date.now(),entries=items.map(i=>({...validateContribution({...i,playerId:p.playerId,note:p.note},new Date(now)),by:userKey,at:now}));
  for(let attempt=0;attempt<3;attempt++){
   const {etag,list}=await loadCommunity(bucket);
   if(list.filter(c=>c.by===userKey&&c.at>now-864e5).length+entries.length>COMMUNITY_DAILY)return json({error:'Llegaste al límite de aportes de hoy.'},429);
   const next=[...list,...entries].slice(-COMMUNITY_MAX);
   const saved=await bucket.put(COMMUNITY_KEY,JSON.stringify(next),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'}});
   if(saved)return json({ok:true,current:communityFor(next,p.playerId)});
  }
  return json({error:'Hubo otros aportes al mismo tiempo. Volvé a intentar.'},409);
 }
 if(request.method==='GET'&&url.pathname==='/api/leagues'){
  const list=await bucket.list({prefix:`members/${userKey}/`});const leagues=[];
  for(const k of list.objects){const code=k.key.split('/').pop();const ob=await bucket.get(`leagues/${code}`);if(ob){const l=await ob.json();const m=l.members.find(m=>m.userId===uid);if(m)leagues.push({code,name:l.name,clubId:m.clubId,round:roundOf(l.world),members:l.members.length});}}
  return json({leagues});
 }
 if(request.method==='POST'&&url.pathname==='/api/leagues'){
  const p=await request.json();const club=catalog.clubs.find(c=>c.id===p.clubId&&c.competitionId!=='interior-a');if(!club)return json({error:'Elegí un club URBA.'},400);
  const owned=await bucket.list({prefix:`members/${userKey}/`,limit:21});if(owned.objects.length>=20)return json({error:'Límite de 20 ligas alcanzado.'},400);
  const bytes=crypto.getRandomValues(new Uint8Array(6));const code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const name=String(p.name||'Liga de amigos').trim().slice(0,60),nick=String(p.nickname||'Manager').trim().slice(0,32);
  const league={code,name,ownerId:uid,version:1,createdAt:Date.now(),members:[{userId:uid,nickname:nick,clubId:p.clubId,ready:false}],world:null};const community=(await loadCommunity(bucket)).list;league.world=applyCommunity(initialWorld(catalogWithCommunity(catalog,community),bytes.reduce((s,n)=>s*31+n,0)>>>0,returns,youth,names),community);
  const created=await bucket.put(`leagues/${code}`,JSON.stringify(league),{onlyIf:{etagDoesNotMatch:'*'}});if(!created)return json({error:'No se pudo reservar el código, intentá de nuevo.'},409);await bucket.put(`members/${userKey}/${code}`,'1');return json(project(league,uid),201);
 }
 const match=url.pathname.match(/^\/api\/leagues\/([A-F0-9]{12})(?:\/(join|action))?$/);if(!match)return json({error:'Ruta no encontrada'},404);
 const code=match[1],obj=await bucket.get(`leagues/${code}`);if(!obj)return json({error:'No encontramos una liga con ese código.'},404);
 const league=await obj.json();league.world=applyCommunity(migrateWorld(league.world,catalog,returns,youth),(await loadCommunity(bucket)).list);const member=league.members.find(m=>m.userId===uid);
 if(request.method==='POST'&&match[2]==='join'){
  const p=await request.json();if(member){await bucket.put(`members/${userKey}/${code}`,'1');return json(project(league,uid));}
  if(league.members.length>=42)return json({error:'Liga completa.'},409);
  if(!league.world.clubs.some(c=>c.id===p.clubId)||league.members.some(m=>m.clubId===p.clubId))return json({error:'El club no está disponible.'},409);
  league.members.push({userId:uid,nickname:String(p.nickname||'Manager').trim().slice(0,32),clubId:p.clubId,ready:false});league.version++;
  const wrote=await bucket.put(`leagues/${code}`,JSON.stringify(league),{onlyIf:{etagMatches:obj.etag}});if(!wrote)return json({error:'La liga cambió. Volvé a intentar.'},409);
  await bucket.put(`members/${userKey}/${code}`,'1');return json(project(league,uid));
 }
 if(!member)return json({error:'Primero unite a esta liga.'},403);
 if(request.method==='GET'){
  if(request.headers.get('if-none-match')===String(league.version))return new Response(null,{status:304});return json(project(league,uid),200,{etag:String(league.version)});
 }
 if(request.method!=='POST'||match[2]!=='action')return json({error:'Método no permitido'},405);
 const p=await request.json();if(p.version!==league.version)return json({error:'Otro manager actualizó la liga. Se recargará el estado.'},409);
 if(p.action==='ready'){
  member.ready=!member.ready;
  // When the last manager says ready, the round (or the new season) is played straight away: nobody waits for the
  // creator to press a button. Everyone then watches their own replay.
  if(member.ready&&league.members.every(m=>m.ready)){
   league.world=Number.isFinite(roundOf(league.world))?advanceWorld(league.world,new Set(league.members.map(m=>m.clubId))):advanceSeasonWorld(league.world);
   for(const m of league.members)m.ready=false;league.lastAdvance={at:Date.now(),by:'auto'};
  }
 }
 else if(p.action==='advance'){
  if(league.ownerId!==uid)return json({error:'Solo el creador puede avanzar la fecha.'},403);
  if(!league.members.every(m=>m.ready))return json({error:'Falta que todos los managers estén listos.'},409);
  if(!Number.isFinite(roundOf(league.world)))return json({error:'La temporada terminó. Iniciá la siguiente temporada.'},400);
  league.world=advanceWorld(league.world,new Set(league.members.map(m=>m.clubId)));for(const m of league.members)m.ready=false;
 }else if(p.action==='next-season'){
  if(league.ownerId!==uid)return json({error:'Solo el creador puede iniciar la temporada.'},403);
  if(!league.members.every(m=>m.ready))return json({error:'Falta que todos los managers estén listos.'},409);
  league.world=advanceSeasonWorld(league.world);for(const m of league.members)m.ready=false;
 }else{
  if(member.ready)return json({error:'Quitá tu estado de listo para editar el equipo.'},409);
  league.world=applyClubAction({...league.world,managedClubs:league.members.map(m=>m.clubId)},member.clubId,p.action,p);
 }
 league.version++;const saved=await bucket.put(`leagues/${code}`,JSON.stringify(league),{onlyIf:{etagMatches:obj.etag}});if(!saved)return json({error:'La liga cambió. Volvé a intentar.'},409);
 return json(project(league,uid));
 }catch(e){return json({error:e instanceof Error?e.message:'No se pudo completar la acción.'},400);}
}
function project(l,uid){const mine=l.members.find(m=>m.userId===uid);const world={...l.world,tactics:mine?{[mine.clubId]:l.world.tactics[mine.clubId]}:{}};return {...l,world,ownerId:undefined,isOwner:l.ownerId===uid,myClubId:mine?.clubId,members:l.members.map(m=>({nickname:m.nickname,clubId:m.clubId,ready:m.ready,isMe:m.userId===uid}))};}
