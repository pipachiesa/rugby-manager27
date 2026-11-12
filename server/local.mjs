import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const dir='.local-data';await mkdir(dir,{recursive:true});
const keypath=k=>`${dir}/${Buffer.from(k).toString('base64url')}.json`;
const locks=new Map();
const bucket={async get(key){try{const body=await readFile(keypath(key),'utf8');return {etag:createHash('sha256').update(body).digest('hex'),json:async()=>JSON.parse(body)};}catch{return null;}},async put(key,body,options={}){
 const before=locks.get(key)||Promise.resolve();let release;const gate=new Promise(r=>release=r);locks.set(key,before.then(()=>gate));await before;
 try{const old=await this.get(key);if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;await writeFile(keypath(key),body);return {key};}finally{release();}
},async list({prefix,limit=1000}){const files=await readdir(dir);return {objects:files.map(f=>({key:Buffer.from(f.replace(/\.json$/,''),'base64url').toString()})).filter(o=>o.key.startsWith(prefix)).slice(0,limit)};}};
let workerVersion=-1, workerModule;
async function getWorker(){const version=(await stat("dist/server/index.js")).mtimeMs;if(!workerModule||version!==workerVersion){workerVersion=version;workerModule=await import(pathToFileURL(process.cwd()+"/dist/server/index.js").href+"?v="+version);}return workerModule;}
const port=4173;
// Loopback by default. LAN=1 opens it to the local network to try the site on a phone on the same Wi-Fi: the test
// identity has no password, so anyone on that network could play as the local manager while it runs.
const host=process.env.LAN==='1'?'0.0.0.0':'127.0.0.1';
createServer(async(req,res)=>{try{
 const origin=`http://127.0.0.1:${port}`,url=new URL(req.url,origin);
 if(url.pathname==='/signin-with-chatgpt'){res.writeHead(302,{'set-cookie':'local_manager=local-manager; HttpOnly; SameSite=Lax; Path=/','location':'/'});res.end();return;}
 if(url.pathname==='/signout-with-chatgpt'){res.writeHead(302,{'set-cookie':'local_manager=; Max-Age=0; Path=/','location':'/'});res.end();return;}
 const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
 // This is a loopback-only development identity. It is absent from the deployed Worker.
 const id=(req.headers.cookie||'').match(/(?:^|; )local_manager=([a-zA-Z0-9_-]+)/)?.[1];headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');if(id){headers.set('oai-authenticated-user-id',id);headers.set('oai-authenticated-user-full-name','Felipe');}
 const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
 const mod=await getWorker();const response=await mod.default.fetch(request,{BUCKET:bucket,LOCAL_DEV:true});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch(e){console.error(e);res.writeHead(500);res.end('Error de desarrollo');}}).listen(port,host,async()=>{console.log(`Local: http://127.0.0.1:${port}`);if(host!=='127.0.0.1'){const {networkInterfaces}=await import('node:os');for(const list of Object.values(networkInterfaces()))for(const a of list??[])if(a.family==='IPv4'&&!a.internal)console.log(`Red local (celular en el mismo Wi-Fi): http://${a.address}:${port}  · identidad de prueba sin contraseña, cerralo al terminar`);}});
