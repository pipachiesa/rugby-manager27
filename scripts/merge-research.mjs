/** Merge independently sourced identity evidence by stable record ID and club, never by name alone. */
export function mergeResearch(catalog,verification={players:[]},returns={players:[],sources:[]}){
 const result=structuredClone(catalog),records=new Map((verification.players??[]).map(p=>[`${p.clubId}/${p.id}`,p]));
 const knownSources=new Set(result.sources.map(s=>s.id));
 for(const p of result.players){const v=records.get(`${p.clubId}/${p.id}`);if(!v)continue;
  if(v.birthDate&&v.birthDateSource?.url){const id=`verified-birth-${p.id}`;if(!knownSources.has(id)){result.sources.push({id,title:`${v.birthDateSource.publisher} · Fecha de nacimiento de ${p.name}`,url:v.birthDateSource.url,publishedAt:null,verifiedAt:verification.asOf});knownSources.add(id);}p.birthDate=v.birthDate;p.birthDateSourceIds=[...new Set([...(p.birthDateSourceIds??[]),id])];}
  if(v.roster2026){p.rosterEvidenceDate=v.roster2026.matchDate;p.rosterEvidenceCertainty=v.roster2026.certainty;}
 }
 // A 2026 match sheet is historical evidence; a uniquely matched current overseas affiliation supersedes local activity.
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const r of returns.players??[]){
  if(r.status!=='exterior'||!r.originClubId)continue;
  const matches=result.players.filter(p=>p.clubId===r.originClubId&&norm(p.name)===norm(r.name));
  const externalMatches=returns.players.filter(x=>x.status==='exterior'&&x.originClubId===r.originClubId&&norm(x.name)===norm(r.name));
  if(matches.length!==1||externalMatches.length!==1)continue;
  const p=matches[0];p.rosterStatus='departed';p.rosterStatusObservedAt=r.observedAt;p.rosterDepartureSourceIds=r.sourceIds;
  for(const id of r.sourceIds??[]){const source=(returns.sources??[]).find(s=>s.id===id);if(source&&!knownSources.has(id)){result.sources.push(source);knownSources.add(id);}}
 }
 return result;
}

/** Club grounds (research/club-locations.json, for transfer distances) and URBA titles (research/club-honours.json). */
export async function addClubExtras(catalog,readFile){
 const read=f=>readFile(f,'utf8').then(JSON.parse).catch(()=>({clubs:[]}));
 const [locations,honours,kits]=await Promise.all([read('research/club-locations.json'),read('research/club-honours.json'),read('research/club-kits.json')]);
 const reserves=await readFile('research/reserves.json','utf8').then(JSON.parse).catch(()=>null);
 // Real 2026 youth tables (URBA M17 and M19, Grupo II): club rank per category, for the youth squads' level.
 const youthTables=await readFile('research/urba-youth-tables-2026.json','utf8').then(JSON.parse).catch(()=>null);
 if(youthTables)catalog.youthRanks=Object.fromEntries(['M17','M19'].map(k=>[k,Object.fromEntries((youthTables[k]?.clubs??[]).filter(c=>Number.isFinite(c.rank)).map(c=>[c.id,c.rank]))]));
 if(reserves){catalog.reserves=reserves.players;catalog.sources=[...(catalog.sources??[]),reserves.source];}
 for(const c of catalog.clubs){
  const l=locations.clubs.find(x=>x.id===c.id),h=honours.clubs.find(x=>x.id===c.id);
  if(l)c.location={lat:l.lat,lng:l.lng};
  if(h)c.honours={urbaTitles:h.urbaTitles,lastTitle:h.lastTitle};
  // Flat 2D kit design (pattern and colours) researched per club: research/club-kits.json.
  const k=kits.clubs.find(x=>x.id===c.id);if(k)c.kitDesign={home:k.home,away:k.away??null};
  // Crests saved locally as 128 px PNG (public/crests), instead of hotlinking urba.org.ar.
  if(await readFile(`public/crests/${c.id}.png`).then(()=>true,()=>false))c.crest={...c.crest,localPath:`/crests/${c.id}.png`};
 }
 return catalog;
}
