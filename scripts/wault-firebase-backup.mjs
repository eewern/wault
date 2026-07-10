// READ-ONLY full export of the Firebase RTDB to a local JSON snapshot. Writes nothing to Firebase.
import 'dotenv/config';
import { createSign } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DB = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const OUT = process.argv[2] || './_wault_firebase_export.json';

const b64url = (x) => Buffer.from(x).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function jwt(sa){
  const now=Math.floor(Date.now()/1000);
  const h=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const c=b64url(JSON.stringify({iss:sa.client_email,sub:sa.client_email,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'}));
  const sig=createSign('RSA-SHA256').update(`${h}.${c}`).sign(sa.private_key);
  return `${h}.${c}.${b64url(sig)}`;
}
let token;
async function getToken(){
  if(token) return token;
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt(svc)})});
  const j=await res.json(); if(!res.ok) throw new Error(JSON.stringify(j)); token=j.access_token; return token;
}
async function get(path, tries=4){
  const t=await getToken();
  const url=`${DB}/${path.replace(/^\/+/,'')}.json`;
  let lastErr;
  for(let i=0;i<tries;i++){
    try{
      const ctrl=new AbortController();
      const to=setTimeout(()=>ctrl.abort(), 60000);
      const r=await fetch(url,{headers:{authorization:`Bearer ${t}`},signal:ctrl.signal});
      clearTimeout(to);
      if(!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      return await r.json();
    }catch(e){ lastErr=e; console.error(`  retry ${i+1}/${tries} for ${path}: ${e.message}`); await new Promise(r=>setTimeout(r, 1500*(i+1))); }
  }
  throw lastErr;
}

console.log('Exporting full DB (this may take a moment)...');
const full = await get('/');
writeFileSync(OUT, JSON.stringify(full, null, 2));
console.log(`\n✅ Full snapshot written to ${OUT} (${(Buffer.byteLength(JSON.stringify(full))/1024/1024).toFixed(2)} MB)`);

// ---- Summary analysis ----
const pageCount=(ws)=>{if(!ws)return 0;const p=ws.pages;if(Array.isArray(p))return p.length;if(p&&typeof p==='object')return Object.keys(p).length;return 0;};
const iso=(t)=>{const d=new Date(Number(t));return isNaN(d)?String(t):d.toISOString();};

console.log('\n===== LIVE /workspaces =====');
for(const [id,rec] of Object.entries(full.workspaces||{})){
  console.log(`  ${id.padEnd(22)} pages=${String(pageCount(rec.workspace)).padStart(3)} updated_at=${rec.updated_at||''}`);
}

console.log('\n===== BACKUPS per workspace (count, newest, largest page count) =====');
for(const [id,snaps] of Object.entries(full.workspaceBackups||{})){
  const stamps=Object.keys(snaps).sort();
  let maxPages=0, maxStamp='';
  for(const s of stamps){ const pc=pageCount(snaps[s]?.workspace); if(pc>=maxPages){maxPages=pc; maxStamp=s;} }
  const newest=stamps[stamps.length-1];
  console.log(`  ${id.padEnd(22)} count=${String(stamps.length).padStart(3)}  newest=${iso(newest)} (pages=${pageCount(snaps[newest]?.workspace)})  richest=${iso(maxStamp)} (pages=${maxPages})`);
}

console.log('\n===== DRAFTS =====');
for(const [id,users] of Object.entries(full.workspaceDrafts||{})){
  for(const [uid,d] of Object.entries(users)){
    console.log(`  ${id.padEnd(22)} uid=${uid.slice(0,8)} email=${d.email||''} pages=${pageCount(d.workspace)} saved_at=${d.saved_at||''}`);
  }
}

console.log('\n===== CATALOG (name -> ids), grouped to spot duplicates =====');
const byName={};
for(const [id,c] of Object.entries(full.workspaceCatalog||{})){
  const n=(c.name||'').trim()||id;
  (byName[n]=byName[n]||[]).push({id, deleted:c.deleted===true, owner:c.ownerEmail||c.ownerUid, updatedAt:c.updatedAt||''});
}
for(const [name,arr] of Object.entries(byName)){
  console.log(`  "${name}":`);
  for(const e of arr) console.log(`       ${e.id.padEnd(22)} deleted=${e.deleted}  owner=${e.owner}  updatedAt=${e.updatedAt}`);
}
console.log('\nDONE (read-only).');
