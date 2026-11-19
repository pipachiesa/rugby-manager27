import * as E from '../web/engine.js';
import {initialWorld,applyClubAction,advanceWorld,advanceSeasonWorld,migrateWorld,roundOf,validateContribution,applyCommunity,catalogWithCommunity,communityFor} from '../web/domain.js';
const COMMUNITY_KEY='community/contributions',COMMUNITY_DAILY=60,COMMUNITY_MAX=50000;
const loadCommunity=async bucket=>{const ob=await bucket.get(COMMUNITY_KEY);return ob?{etag:ob.etag,list:await ob.json()}:{etag:null,list:[]};};
// Corrections are not applied right away: they wait in community/pending/<id> and the admin gets an email
// («Ajuste RM27») with a link to approve or reject them. Only approved ones join community/contributions.
// The admin address is the ADMIN_EMAIL secret (never in the public repo); EMAIL is the send_email binding.
const PENDING='community/pending/';
const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const describeEntry=e=>e.type==='age'?`Edad aproximada: nacido ~${String(e.value).slice(0,4)}`:e.type==='active'?(e.value?'Sigue en el club':'Ya no juega en el club'):e.type==='position'?`Puesto: ${e.value}`:e.type==='name'?`Nombre: ${e.value}`:`Estadísticas: ${e.value.text||'—'}${e.value.level!=null?` (nivel sugerido ${e.value.level})`:''}`;
const reviewPage=(title,body)=>new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title><style>body{font:16px system-ui,sans-serif;background:#0e2a1d;color:#f4efe2;margin:0;padding:24px}main{max-width:560px;margin:auto;background:#163a29;border-radius:10px;padding:24px}h1{font-size:22px;margin:0 0 12px}li{margin:6px 0}small{color:#bcd3c3}form{display:inline}button{font:600 15px system-ui;border:0;border-radius:7px;padding:10px 18px;margin:16px 8px 0 0;cursor:pointer}.ok{background:#f4efe2;color:#0e2a1d}.no{background:transparent;color:#f4efe2;border:1px solid #6f8f7c}</style><main>${body}</main></html>`,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex','referrer-policy':'no-referrer'}});
async function handleReview(request,env,url){
 const bucket=env.BUCKET;if(!bucket)return reviewPage('Ajuste RM27','<p>El guardado online no está disponible.</p>');
 const form=request.method==='POST'?Object.fromEntries(await request.formData()):{};
 const id=String(form.id??url.searchParams.get('id')??'');
 if(!/^[a-f0-9]{48}$/.test(id))return reviewPage('Ajuste RM27','<h1>Enlace no válido</h1>');
 const ob=await bucket.get(PENDING+id);
 if(!ob)return reviewPage('Ajuste RM27','<h1>Este ajuste ya se resolvió</h1><p>Ya fue aprobado o rechazado.</p>');
 const item=await ob.json();
 const summary=`<p><strong>${escHtml(item.playerName)}</strong> · ${escHtml(item.clubName)}</p><ul>${item.entries.map(e=>`<li>${escHtml(describeEntry(e))}</li>`).join('')}</ul>${item.note?`<p><small>Nota: ${escHtml(item.note)}</small></p>`:''}<p><small>Enviado por ${escHtml(item.byName)} el ${new Date(item.at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</small></p>`;
 if(request.method!=='POST')return reviewPage('Ajuste RM27',`<h1>Ajuste RM27</h1>${summary}<form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="decision" value="approve"><button class="ok">Aprobar</button></form><form method="post"><input type="hidden" name="id" value="${id}"><input type="hidden" name="decision" value="reject"><button class="no">Rechazar</button></form>`);
 // The page sends no referrer, so browsers post Origin: null; the 48-character id is what authorizes the decision.
 const origin=request.headers.get('origin');if(origin&&origin!=='null'&&origin!==url.origin)return reviewPage('Ajuste RM27','<h1>Origen no permitido</h1>');
 if(form.decision==='approve'){
  const now=Date.now(),entries=item.entries.map(e=>({...e,by:item.by,at:now}));
  let saved=false;
  for(let attempt=0;attempt<3&&!saved;attempt++){const {etag,list}=await loadCommunity(bucket);saved=!!await bucket.put(COMMUNITY_KEY,JSON.stringify([...list,...entries].slice(-COMMUNITY_MAX)),{onlyIf:etag?{etagMatches:etag}:new Headers({'If-None-Match':'*'})});}
  if(!saved)return reviewPage('Ajuste RM27','<h1>No se pudo guardar</h1><p>Hubo otros cambios al mismo tiempo. Volvé a abrir el enlace.</p>');
  await bucket.delete(PENDING+id);
  return reviewPage('Ajuste RM27',`<h1>Aprobado</h1>${summary}<p>Ya se aplica en todas las ligas.</p>`);
 }
 await bucket.delete(PENDING+id);
 return reviewPage('Ajuste RM27',`<h1>Rechazado</h1>${summary}<p>No se aplicó.</p>`);
}
async function notifyAdmin(env,url,item){
 if(!env.EMAIL||!env.ADMIN_EMAIL)return false;
 const link=`${url.origin}/api/community/review?id=${item.id}`,lines=item.entries.map(describeEntry);
 try{
  await env.EMAIL.send({to:env.ADMIN_EMAIL,from:{email:env.EMAIL_FROM||`ajustes@${url.hostname}`,name:'Rugby Manager 27'},subject:'Ajuste RM27',
   text:`${item.playerName} (${item.clubName})\n\n${lines.map(l=>'- '+l).join('\n')}${item.note?`\n\nNota: ${item.note}`:''}\n\nEnviado por ${item.byName}.\n\nAprobar o rechazar: ${link}\n`,
   html:`<p><strong>${escHtml(item.playerName)}</strong> (${escHtml(item.clubName)})</p><ul>${lines.map(l=>`<li>${escHtml(l)}</li>`).join('')}</ul>${item.note?`<p>Nota: ${escHtml(item.note)}</p>`:''}<p>Enviado por ${escHtml(item.byName)}.</p><p><a href="${link}">Aprobar o rechazar</a></p>`});
  return true;
 }catch(error){console.error('notifyAdmin',error?.code,error?.message);return false;}
}
const json=(d,status=200,extra={})=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...extra}});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
class PayloadTooLarge extends Error {}
class ProtectionUnavailable extends Error {}
const SAVE_SLOTS=5,SAVE_MAX_BYTES=24*1024*1024;
async function saveIndex(bucket,userKey){const o=await bucket.get(`saves/${userKey}/index`);try{return o?await o.json():[];}catch{return [];}}
async function readJsonLimited(request,limit){
 const reader=request.body?.getReader();if(!reader)throw new Error('Solicitud vacía');
 let size=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new PayloadTooLarge('Solicitud demasiado grande');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('JSON no válido');}
}
async function enforceLimit(request,env,binding){
 if(env.IDENTITY_MODE!=='accounts')return true;
 if(!env[binding])throw new ProtectionUnavailable('Protección de acceso no disponible');
 const address=request.headers.get('cf-connecting-ip')||'unknown';
 return (await env[binding].limit({key:address})).success;
}
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
 const p=await readJsonLimited(request,4096);
 const start=async account=>{const token=hex(crypto.getRandomValues(new Uint8Array(32)));await bucket.put(`sessions/${await digest(token)}`,JSON.stringify({uid:'acct:'+account.id,name:account.username,expires:Date.now()+SESSION_DAYS*86400000}));return json({signedIn:true,name:account.username,account:true},200,{'set-cookie':sessionCookie(token,env)});};
 if(url.pathname==='/api/auth/register'){
  const username=String(p.username||'').trim(),email=String(p.email||'').trim().toLowerCase(),password=String(p.password||'');
  if(!/^[A-Za-z0-9_.]{3,20}$/.test(username))return json({error:'El usuario lleva de 3 a 20 letras, números, punto o guion bajo.'},400);
  if(!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email))return json({error:'Revisá el mail.'},400);
  if(password.length<8||password.length>200)return json({error:'La contraseña lleva al menos 8 caracteres.'},400);
  const emailKey=`accounts/email/${await digest(email)}`,userKey=`accounts/user/${username.toLowerCase()}`;
  if(await bucket.get(emailKey))return json({error:'Ya hay una cuenta con ese mail.'},409);
  const salt=hex(crypto.getRandomValues(new Uint8Array(16))),account={id:hex(crypto.getRandomValues(new Uint8Array(12))),username,salt,hash:await passwordHash(password,salt),createdAt:Date.now()};
  if(!await bucket.put(userKey,JSON.stringify(account),{onlyIf:new Headers({'If-None-Match':'*'})}))return json({error:'Ese usuario ya existe.'},409);
  if(!await bucket.put(emailKey,username.toLowerCase(),{onlyIf:new Headers({'If-None-Match':'*'})})){await bucket.delete(userKey);return json({error:'Ya hay una cuenta con ese mail.'},409);}
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
 if(!await enforceLimit(request,env,'API_RATE_LIMIT'))return json({error:'Demasiadas solicitudes. Intentá más tarde.'},429);
 if(url.pathname.startsWith('/api/auth/')){
  if(request.method!=='POST'||request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Origen o formato no permitido'},403);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Solicitud demasiado grande'},413);
  if((url.pathname==='/api/auth/login'||url.pathname==='/api/auth/register')&&!await enforceLimit(request,env,'AUTH_RATE_LIMIT'))return json({error:'Demasiados intentos. Esperá un minuto.'},429);
  return await handleAuth(request,env,url);
 }
 if(url.pathname==='/api/community/review')return await handleReview(request,env,url);
 const session=await sessionUser(request,env);
 // Direct public Workers cannot trust identity headers supplied by the visitor.
 const uid=session?.uid??(env.IDENTITY_MODE==='accounts'?null:request.headers.get('oai-authenticated-user-id'));
 if(url.pathname==='/api/me')return json({signedIn:!!uid,account:!!session,name:session?.name??(uid?(request.headers.get('oai-authenticated-user-full-name')||'Manager'):null),storage:env.LOCAL_DEV?'local':'online'});
 if(!uid)return json({error:'Iniciá sesión para guardar tu liga online.'},401);
 if(!env.BUCKET)return json({error:'El guardado online todavía no está disponible.'},503);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')))return json({error:'Origen o formato no permitido'},403);
 if(request.method==='POST'&&!url.pathname.startsWith('/api/saves/')&&Number(request.headers.get('content-length')||0)>65536)return json({error:'Solicitud demasiado grande'},413);
 const userKey=await digest(uid), bucket=env.BUCKET;
 // Community data: any signed-in manager can propose a name, approximate age, position, whether a real player still
 // plays for his club or a stats comment. Proposals wait for the admin's approval (email «Ajuste RM27»); approved ones
 // are shared by every league and the latest wins. Contributor identity is stored hashed.
 if(url.pathname==='/api/community'){
  // ?all=1: every approved correction (without who sent it), so solo games and open leagues can pick them up.
  if(request.method==='GET'&&url.searchParams.get('all')){const {list}=await loadCommunity(bucket);return json({stamp:list.length?`${list.length}-${list.at(-1).at}`:'0',list:list.map(({playerId,type,value,at})=>({playerId,type,value,at}))});}
  if(request.method==='GET'){const id=url.searchParams.get('playerId')??'';const {list}=await loadCommunity(bucket);
   return json({playerId:id,current:communityFor(list,id),history:list.filter(c=>c.playerId===id).slice(-20).map(({type,value,note,at})=>({type,value,note,at}))});}
  if(request.method!=='POST')return json({error:'Método no permitido'},405);
  const p=await readJsonLimited(request,65536);const items=(Array.isArray(p.items)?p.items:[]).slice(0,5);
  if(!items.length)return json({error:'Completá al menos un dato.'},400);
  if(!catalog.players.some(r=>r.id===p.playerId)&&!(catalog.reserves??[]).some(r=>r.id===p.playerId))return json({error:'Ese jugador no está en el catálogo.'},404);
  const now=Date.now(),entries=items.map(i=>validateContribution({...i,playerId:p.playerId},new Date(now)));
  const dayKey=`community/daily/${userKey}/${new Date(now).toISOString().slice(0,10)}`,used=Number(await (await bucket.get(dayKey))?.text()??0);
  if(used+entries.length>COMMUNITY_DAILY)return json({error:'Llegaste al límite de aportes de hoy.'},429);
  await bucket.put(dayKey,String(used+entries.length));
  const record=catalog.players.find(r=>r.id===p.playerId)??(catalog.reserves??[]).find(r=>r.id===p.playerId);
  const item={id:hex(crypto.getRandomValues(new Uint8Array(24))),playerId:p.playerId,playerName:record?.name??p.playerId,clubName:catalog.clubs.find(c=>c.id===record?.clubId)?.name??'',
   entries,note:String(p.note??'').trim().slice(0,200),by:userKey,byName:session?.name??'Manager',at:now};
  await bucket.put(PENDING+item.id,JSON.stringify(item));
  const emailed=await notifyAdmin(env,url,item);
  return json({ok:true,pending:true,emailed});
 }
 // Solo games saved to the account (18/11/2026): before, they lived only in one browser, so another device (or a
 // browser that clears its storage) showed none. Up to SAVE_SLOTS per account; the world travels gzipped in base64.
 if(url.pathname==='/api/saves'&&request.method==='GET')return json({saves:await saveIndex(bucket,userKey)});
 const saveMatch=url.pathname.match(/^\/api\/saves\/([a-z0-9]{4,24})(\/delete)?$/);
 if(saveMatch){
  const [,id,del]=saveMatch,key=`saves/${userKey}/${id}`,index=await saveIndex(bucket,userKey);
  if(request.method==='GET'){const o=await bucket.get(key);if(!o)return json({error:'No se encontró la partida.'},404);return json(await o.json());}
  if(request.method!=='POST')return json({error:'Método no permitido'},405);
  if(del){await bucket.delete(key);await bucket.put(`saves/${userKey}/index`,JSON.stringify(index.filter(m=>m.id!==id)));return json({ok:true});}
  const p=await readJsonLimited(request,SAVE_MAX_BYTES);
  if(typeof p.data!=='string'||!p.meta)return json({error:'Partida no válida.'},400);
  if(!index.some(m=>m.id===id)&&index.length>=SAVE_SLOTS)return json({error:`Podés tener hasta ${SAVE_SLOTS} partidas. Borrá una para empezar otra.`},400);
  const clean=v=>String(v??'').slice(0,60);
  const meta={id,clubId:clean(p.meta.clubId),manager:clean(p.meta.manager),season:Number(p.meta.season)||null,round:Number(p.meta.round)||null,date:clean(p.meta.date),savedAt:Number(p.meta.savedAt)||Date.now(),size:p.data.length};
  // A save from another device that is older than the stored one is refused, so a stale tab cannot undo progress.
  const stored=index.find(m=>m.id===id);if(stored&&stored.savedAt>meta.savedAt&&!p.force)return json({error:'Hay una versión más nueva de esta partida.',newer:stored},409);
  await bucket.put(key,JSON.stringify({meta,data:p.data}));
  await bucket.put(`saves/${userKey}/index`,JSON.stringify([...index.filter(m=>m.id!==id),meta].sort((a,b)=>b.savedAt-a.savedAt)));
  return json({ok:true,meta});
 }
 if(request.method==='GET'&&url.pathname==='/api/leagues'){
  const list=await bucket.list({prefix:`members/${userKey}/`});const leagues=[];
  for(const k of list.objects){const code=k.key.split('/').pop();const ob=await bucket.get(`leagues/${code}`);if(ob){const l=await ob.json();const m=l.members.find(m=>m.userId===uid);if(m)leagues.push({code,name:l.name,clubId:m.clubId,round:roundOf(l.world),members:l.members.length});}}
  return json({leagues});
 }
 if(request.method==='POST'&&url.pathname==='/api/leagues'){
  const p=await readJsonLimited(request,65536);const club=catalog.clubs.find(c=>c.id===p.clubId&&c.competitionId!=='interior-a');if(!club)return json({error:'Elegí un club URBA.'},400);
  const owned=await bucket.list({prefix:`members/${userKey}/`,limit:21});if(owned.objects.length>=20)return json({error:'Límite de 20 ligas alcanzado.'},400);
  const bytes=crypto.getRandomValues(new Uint8Array(6));const code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const name=String(p.name||'Liga de amigos').trim().slice(0,60),nick=String(p.nickname||'Manager').trim().slice(0,32);
  const league={code,name,ownerId:uid,version:1,createdAt:Date.now(),members:[{userId:uid,nickname:nick,clubId:p.clubId,ready:false}],world:null};const community=(await loadCommunity(bucket)).list;league.world=applyCommunity(initialWorld(catalogWithCommunity(catalog,community),bytes.reduce((s,n)=>s*31+n,0)>>>0,returns,youth,names),community);
  const created=await bucket.put(`leagues/${code}`,JSON.stringify(league),{onlyIf:new Headers({'If-None-Match':'*'})});if(!created)return json({error:'No se pudo reservar el código, intentá de nuevo.'},409);await bucket.put(`members/${userKey}/${code}`,'1');return json(project(league,uid),201);
 }
 const match=url.pathname.match(/^\/api\/leagues\/([A-F0-9]{12})(?:\/(join|action|watch))?$/);if(!match)return json({error:'Ruta no encontrada'},404);
 // Replay progress (16/11/2026): how far each manager has watched his latest matches, so a live change never alters
 // what the rival manager already saw. Stored apart (watch/<code>) so it never bumps the league version.
 if(request.method==='POST'&&match[2]==='watch'){
  if(!await bucket.get(`members/${userKey}/${match[1]}`))return json({error:'No sos miembro de esta liga.'},403);
  const p=await readJsonLimited(request,4096),fid=String(p.fixtureId??'').slice(0,120),sec=Math.max(0,Math.min(4800,Math.floor(Number(p.second)||0)));
  for(let attempt=0;attempt<3;attempt++){
   const ob=await bucket.get(`watch/${match[1]}`),data=ob?await ob.json():{};
   if((data[fid]?.[userKey]??-1)>=sec)return json({ok:true});
   const next={...data,[fid]:{...(data[fid]??{}),[userKey]:sec}};
   for(const k of Object.keys(next).slice(0,-40))delete next[k];
   if(await bucket.put(`watch/${match[1]}`,JSON.stringify(next),{onlyIf:ob?{etagMatches:ob.etag}:new Headers({'If-None-Match':'*'})}))return json({ok:true});
  }
  return json({ok:false},409);
 }
 const code=match[1],obj=await bucket.get(`leagues/${code}`);if(!obj)return json({error:'No encontramos una liga con ese código.'},404);
 const league=await obj.json();league.world=applyCommunity(migrateWorld(league.world,catalog,returns,youth),(await loadCommunity(bucket)).list);const member=league.members.find(m=>m.userId===uid);
 if(request.method==='POST'&&match[2]==='join'){
  const p=await readJsonLimited(request,65536);if(member){await bucket.put(`members/${userKey}/${code}`,'1');return json(project(league,uid));}
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
 const p=await readJsonLimited(request,65536);if(p.version!==league.version)return json({error:'Otro manager actualizó la liga. Se recargará el estado.'},409);
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
  // Live change against another manager: allowed only from the point his replay has reached (never trust the client).
  delete p.__rivalSeen;
  if(p.action==='live-change'){const f=league.world.fixtures.find(x=>x.id===p.fixtureId),rival=f&&(f.homeId===member.clubId?f.awayId:f.homeId),rm=league.members.find(m=>m.clubId===rival);
   if(rm){const ob=await bucket.get(`watch/${code}`),data=ob?await ob.json():{};p.__rivalSeen=data[f.id]?.[await digest(rm.userId)]??0;}}
  league.world=applyClubAction({...league.world,managedClubs:league.members.map(m=>m.clubId)},member.clubId,p.action,p);
 }
 league.version++;const saved=await bucket.put(`leagues/${code}`,JSON.stringify(league),{onlyIf:{etagMatches:obj.etag}});if(!saved)return json({error:'La liga cambió. Volvé a intentar.'},409);
 return json(project(league,uid));
 }catch(e){return json({error:e instanceof Error?e.message:'No se pudo completar la acción.'},e instanceof PayloadTooLarge?413:e instanceof ProtectionUnavailable?503:400);}
}
function project(l,uid){const mine=l.members.find(m=>m.userId===uid);const world={...l.world,tactics:mine?{[mine.clubId]:l.world.tactics[mine.clubId]}:{}};return {...l,world,ownerId:undefined,isOwner:l.ownerId===uid,myClubId:mine?.clubId,members:l.members.map(m=>({nickname:m.nickname,clubId:m.clubId,ready:m.ready,isMe:m.userId===uid}))};}
