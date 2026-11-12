import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {handle} from '../server/worker.js';import {mergeResearch} from '../scripts/merge-research.mjs';
const returns=JSON.parse(await readFile('research/returns.json'));const youth=JSON.parse(await readFile('research/youth.json'));const names=JSON.parse(await readFile('research/names.json'));const ages=JSON.parse(await readFile('research/age-verification.json'));const catalog=mergeResearch(JSON.parse(await readFile('research/catalog.json')),ages,returns);
function storage(){const data=new Map();return {async get(k){const body=data.get(k);if(!body)return null;return {etag:createHash('sha256').update(body).digest('hex'),json:async()=>JSON.parse(body),text:async()=>body}},async put(k,v,opt={}){const old=data.get(k);const etag=old?createHash('sha256').update(old).digest('hex'):null;if(opt.onlyIf?.etagMatches&&etag!==opt.onlyIf.etagMatches)return null;if(opt.onlyIf?.etagDoesNotMatch==='*'&&old)return null;data.set(k,v);return {key:k}},async delete(k){data.delete(k)},async list({prefix,limit=1000}){return {objects:[...data.keys()].filter(k=>k.startsWith(prefix)).slice(0,limit).map(key=>({key}))}}};}
function call(bucket,uid,path,method='GET',body,extra={}){const headers={...(uid?{'oai-authenticated-user-id':uid}:{}),...extra};if(method==='POST'){headers['content-type']='application/json';headers.origin??='https://game.test';}return handle(new Request('https://game.test'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})}),{BUCKET:bucket},{},catalog,returns,youth,names);}
test('protected league flow, optimistic concurrency, membership and privacy',async()=>{
 const b=storage();assert.equal((await call(b,null,'/api/leagues')).status,401);
 assert.equal((await call(b,'alice','/api/leagues','POST',{clubId:'newman'},{origin:'https://evil.test'})).status,403);
 let res=await call(b,'alice','/api/leagues','POST',{name:'Liga',nickname:'Alice',clubId:'newman'});assert.equal(res.status,201);let league=await res.json();const path=`/api/leagues/${league.code}`;assert.equal(league.world.fixtures.length,546);assert.equal(Object.keys(league.world.tactics).length,1);
 assert.equal((await call(b,'outsider',path)).status,403);
 assert.equal((await call(b,'outsider',path+'/action','POST',{version:league.version,action:'tactics',tactics:{}})).status,403);
 assert.equal((await call(b,'bob',path+'/join','POST',{clubId:'newman'})).status,409);
 res=await call(b,'bob',path+'/join','POST',{clubId:'alumni',nickname:'Bob'});assert.equal(res.status,200);league=await res.json();assert.equal(league.members.length,2);assert.equal(league.world.tactics.newman,undefined);
 assert.equal((await call(b,'bob',path+'/action','POST',{version:league.version,action:'advance'})).status,403);
 let r=await call(b,'alice',path+'/action','POST',{version:league.version,action:'ready'});league=await r.json();
 assert.equal((await call(b,'alice',path+'/action','POST',{version:league.version,action:'advance'})).status,409);
 // Alice cannot edit while she is ready; unready, edit, ready again.
 assert.equal((await call(b,'alice',path+'/action','POST',{version:league.version,action:'tactics',tactics:{}})).status,409);
 assert.equal(league.world.fixtures.filter(f=>f.match).length,0,'nothing is played while Bob is preparing');
 // Bob is the last one: his «ready» plays the round by itself, once, even if he double-clicks.
 const v0=league.version;
 const results=await Promise.all([call(b,'bob',path+'/action','POST',{version:v0,action:'ready'}),call(b,'bob',path+'/action','POST',{version:v0,action:'ready'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 league=await (await call(b,'alice',path)).json();const v=league.version;assert.equal(league.world.fixtures.filter(f=>f.match).length,21,'round played automatically');assert.ok(league.members.every(m=>!m.ready),'everyone prepares again');
 // Next round: Bob ready, Alice not → still round 2 pending.
 r=await call(b,'bob',path+'/action','POST',{version:v,action:'ready'});league=await r.json();assert.equal(league.world.fixtures.filter(f=>f.match).length,21);
 assert.equal((await call(b,'alice',path+'/action','POST',{version:v,action:'ready'})).status,409,'stale version is refused');
 const listing=await (await call(b,'bob','/api/leagues')).json();assert.equal(listing.leagues[0].code,league.code);
});
test('official fixture and real candidate sources are kept distinct from fictional returns',async()=>{
 const b=storage();const r=await call(b,'carol','/api/leagues','POST',{clubId:'newman'});const l=await r.json();
 assert.ok(l.world.fixtures.every(f=>f.date&&f.sourceIds?.length));
 assert.ok(l.world.returnCandidates.every(c=>!c.player.fictional&&returns.players.some(p=>p.name===c.player.name&&p.status==='exterior')));
 assert.ok(l.world.returnCandidates.every(c=>!['Agustín Creevy','Santiago Cordero','Nicolás Sánchez'].includes(c.player.name)));
});
test('senior categories share a pool and assignment stays within the manager club',async()=>{
 const b=storage();const first=await call(b,'owner','/api/leagues','POST',{clubId:'newman'});let l=await first.json();const club=l.world.clubs.find(c=>c.id==='newman');const rival=l.world.clubs.find(c=>c.id!=='newman');
 for(const g of ['Primera','Intermedia','Pre A','Pre B'])assert.ok(club.players.filter(p=>p.seniorSquad===g).length>=10,g);
 let r=await call(b,'owner',`/api/leagues/${l.code}/action`,'POST',{version:l.version,action:'assign-senior',playerId:rival.players[0].id,seniorSquad:'Pre A'});assert.equal(r.status,400);
 r=await call(b,'owner',`/api/leagues/${l.code}/action`,'POST',{version:l.version,action:'assign-senior',playerId:club.players[0].id,seniorSquad:'Pre A'});assert.equal(r.status,200);l=await r.json();assert.equal(l.world.clubs.find(c=>c.id==='newman').players[0].seniorSquad,'Pre A');
});
test('community data: approximate age, active and position reach every league; new leagues leave out departed players',async()=>{
 const b=storage();let res=await call(b,'dana','/api/leagues','POST',{clubId:'newman'});const l=await res.json();
 const club=l.world.clubs.find(c=>c.id==='banco-nacion')??l.world.clubs.find(c=>c.players.some(p=>!p.fictional&&p.age==null));
 const [p,q]=club.players.filter(x=>!x.fictional&&x.age==null&&x.sourceRecordId);assert.ok(p&&q,'needs real players without age');
 assert.equal((await call(b,null,'/api/community','POST',{playerId:p.sourceRecordId,items:[{type:'age',value:24}]})).status,401);
 assert.equal((await call(b,'eve','/api/community','POST',{playerId:p.sourceRecordId,items:[{type:'age',value:80}]})).status,400);
 assert.equal((await call(b,'eve','/api/community','POST',{playerId:'no-existe',items:[{type:'age',value:24}]})).status,404);
 res=await call(b,'eve','/api/community','POST',{playerId:p.sourceRecordId,items:[{type:'age',value:24},{type:'position',value:'Fullback'}],note:'lo conozco'});assert.equal(res.status,200);
 assert.equal((await call(b,'eve','/api/community','POST',{playerId:q.sourceRecordId,items:[{type:'active',value:false}]})).status,200);
 // An existing league (eve is not even a member) picks it up on the next read.
 const after=await (await call(b,'dana',`/api/leagues/${l.code}`)).json();const p2=after.world.clubs.find(c=>c.id===club.id).players.find(x=>x.id===p.id);
 assert.equal(p2.age,24);assert.equal(p2.ageEstimated,true);assert.equal(p2.ageKnown,false);assert.equal(p2.position,'Fullback');
 assert.equal(after.world.clubs.find(c=>c.id===club.id).players.find(x=>x.id===q.id).community.active,false);
 const fresh=await (await call(b,'frank','/api/leagues','POST',{clubId:'newman'})).json();
 assert.ok(!fresh.world.clubs.flatMap(c=>c.players).some(x=>x.sourceRecordId===q.sourceRecordId),'departed player left out of a new league');
 assert.equal(fresh.world.clubs.flatMap(c=>c.players).find(x=>x.sourceRecordId===p.sourceRecordId)?.age,24);
 const info=await (await call(b,'eve',`/api/community?playerId=${p.sourceRecordId}`)).json();assert.equal(info.current.position,'Fullback');assert.ok(info.history.every(h=>!('by' in h)));
});

test('accounts: sign up with username and email, sign in by either, session cookie identifies the manager',async()=>{
 const b=storage(),post=(path,body,cookie)=>call(b,null,path,'POST',body,cookie?{cookie}:{});
 assert.equal((await post('/api/auth/register',{username:'a',email:'x@y.com',password:'12345678'})).status,400);
 assert.equal((await post('/api/auth/register',{username:'felipe',email:'mal',password:'12345678'})).status,400);
 assert.equal((await post('/api/auth/register',{username:'felipe',email:'f@test.com',password:'corta'})).status,400);
 let res=await post('/api/auth/register',{username:'felipe',email:'F@Test.com',password:'clave-segura'});assert.equal(res.status,200);
 const cookie=res.headers.get('set-cookie').split(';')[0];assert.match(res.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await post('/api/auth/register',{username:'Felipe',email:'otro@test.com',password:'clave-segura'})).status,409,'username is unique');
 assert.equal((await post('/api/auth/register',{username:'otro',email:'f@test.com',password:'clave-segura'})).status,409,'email is unique');
 const keys=(await b.list({prefix:''})).objects.map(o=>o.key);assert.ok(!keys.some(k=>k.includes('f@test.com')),'email is not stored in clear');
 const me=await (await call(b,null,'/api/me','GET',undefined,{cookie})).json();assert.equal(me.signedIn,true);assert.equal(me.name,'felipe');
 res=await call(b,null,'/api/leagues','POST',{name:'Liga',nickname:'Feli',clubId:'newman'},{cookie});assert.equal(res.status,201);
 assert.equal((await post('/api/auth/login',{login:'felipe',password:'otra-clave'})).status,401);
 res=await post('/api/auth/login',{login:'f@test.com',password:'clave-segura'});assert.equal(res.status,200);
 const second=res.headers.get('set-cookie').split(';')[0];
 const listing=await (await call(b,null,'/api/leagues','GET',undefined,{cookie:second})).json();assert.equal(listing.leagues.length,1,'same account, same leagues');
 await post('/api/auth/logout',{},second);assert.equal((await (await call(b,null,'/api/me','GET',undefined,{cookie:second})).json()).signedIn,false);
});
