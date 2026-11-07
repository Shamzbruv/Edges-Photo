import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir=await mkdtemp(path.join(os.tmpdir(),'edge-gallery-'));
process.env.STUDIO_DATA_DIR=dir;process.env.STUDIO_ADMIN_EMAIL='owner@example.test';
const runtime=await import('../server/railway-env.mjs');
globalThis.__galleryEnv=runtime.env;globalThis.__galleryUser=null;
let code=ts.transpileModule(await readFile('app/api/website/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import[^;]*supabase-proxy['"];?/, 'const supabaseEnabled=false;const proxySupabase=()=>{};').replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/, 'const env=globalThis.__galleryEnv;').replace(/import\s*\{\s*getChatGPTUser\s*\}\s*from\s*['"][^'"]+['"];?/, 'const getChatGPTUser=async()=>globalThis.__galleryUser;');
const route=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
async function save(body,user={email:'owner@example.test'},origin='https://studio.test'){globalThis.__galleryUser=user;return route.POST(new Request('https://studio.test/api/website',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'save',...body})}))}
const pub=async()=>{globalThis.__galleryUser=null;return (await route.GET(new Request('https://studio.test/api/website?action=public'))).json()};
try{
 // Metadata fixtures only. No image or file upload is performed.
 const db=runtime.database();for(const [id,collection,published,position] of [['general','gallery',0,2],['wedding','weddings',1,1],['private','gallery',0,0]])await db.prepare('INSERT INTO website_photos(id,object_key,name,mime,size,collection,caption,published,position,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,'galleries/'+id+'/unused',id+'.jpg','image/jpeg',1,collection,'Caption '+id,published,position,'2026-11-07T21:00:00.000Z').run();
 let v=await pub();assert.ok(v.collections.includes('gallery'));assert.deepEqual(v.photos.map(p=>p.id),['wedding']);
 const change={id:'general',caption:'A spontaneous moment',collection:'gallery',position:2,published:true,featured:false};
 assert.equal((await save(change,null)).status,403);assert.equal((await save(change,undefined,'https://evil.test')).status,403);
 assert.equal((await save(change)).status,200);v=await pub();assert.deepEqual(v.photos.map(p=>p.id),['wedding','general']);assert.equal(v.photos[1].collection,'gallery');assert.equal(v.photos[1].caption,'A spontaneous moment');assert.ok(!JSON.stringify(v).includes('object_key'));
 assert.equal((await save({...change,collection:'invalid'})).status,400);
 assert.equal((await save({...change,collection:'portraits'})).status,200);v=await pub();assert.equal(v.photos.find(p=>p.id==='general').collection,'portraits');
 assert.equal((await save({...change,published:false})).status,200);assert.deepEqual((await pub()).photos.map(p=>p.id),['wedding']);
 console.log('PASS: general-gallery metadata, publication/unpublication, collection changes, ordering, draft privacy, safe public fields, invalid collections, auth and origin. No photographs uploaded.');
}finally{await rm(dir,{recursive:true,force:true})}
