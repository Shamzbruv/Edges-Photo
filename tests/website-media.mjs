import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
const dir=await mkdtemp(path.join(os.tmpdir(),'edge-media-'));
process.env.STUDIO_DATA_DIR=dir;
const runtime=await import('../server/railway-env.mjs');
globalThis.__mediaEnv=runtime.env;globalThis.__mediaUser=null;process.env.STUDIO_ADMIN_EMAIL='owner@example.test';
let code=ts.transpileModule(await readFile('app/api/website/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import[^;]*supabase-proxy['"];?/, 'const supabaseEnabled=false; const proxySupabase=()=>{};').replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/, 'const env=globalThis.__mediaEnv;').replace(/import\s*\{\s*getChatGPTUser\s*\}\s*from\s*['"][^'"]+['"];?/, 'const getChatGPTUser=async()=>globalThis.__mediaUser;');
const route=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const owner={email:'owner@example.test'};
async function post(body,user=owner,query='',raw=false,origin='https://studio.test'){globalThis.__mediaUser=user;const r=await route.POST(new Request('https://studio.test/api/website'+query,{method:'POST',headers:{Origin:origin,'Content-Type':raw?'application/octet-stream':'application/json'},body:raw?body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}
async function get(query,user=null){globalThis.__mediaUser=user;return route.GET(new Request('https://studio.test/api/website?'+query))}
try{
assert.equal((await post({action:'start'},null)).status,403);
assert.equal((await post({action:'start'},owner,'',false,'https://evil.test')).status,403);
const original=new Uint8Array(24*1024*1024+123);original.set([255,216,255,224]);
const start=await post({action:'start',name:'full-resolution.jpg',mime:'image/jpeg',size:original.length,collection:'weddings'});assert.equal(start.status,200);const {id,chunkSize}=start.data;
assert.equal((await post({action:'complete',id})).status,409);
assert.equal((await post(new Uint8Array(chunkSize+1),owner,`?action=part&id=${id}&part=1`,true)).status,413);
for(let n=1;n<=Math.ceil(original.length/chunkSize);n++){const part=original.slice((n-1)*chunkSize,n*chunkSize);assert.equal((await post(part,owner,`?action=part&id=${id}&part=${n}`,true)).status,200);if(n===1){const saved=await (await get('action=status&id='+id,owner)).json();assert.equal(saved.parts.length,1);assert.equal((await post(part,owner,`?action=part&id=${id}&part=1`,true)).status,200)}}
assert.equal((await post({action:'complete',id})).status,200);assert.equal((await post({action:'complete',id})).status,200);
assert.equal((await get('action=image&id='+id)).status,403);assert.equal((await (await get('action=public')).json()).photos.length,0);
const image=await get('action=image&id='+id,owner);assert.deepEqual(new Uint8Array(await image.arrayBuffer()),original);
assert.equal((await post(new Uint8Array([255,216,255,224,0]),owner,'?action=preview&id='+id,true)).status,200);
assert.equal((await post({action:'save',id,caption:'Our wedding day',collection:'weddings',position:1,published:true,featured:true})).status,200);
assert.equal((await (await get('action=public')).json()).photos[0].caption,'Our wedding day');assert.equal((await (await get('action=image&id='+id)).arrayBuffer()).byteLength,5);
assert.equal((await (await get('action=image&id='+id+'&original=1')).arrayBuffer()).byteLength,original.length);
assert.deepEqual(await readdir(path.join(dir,'uploads')),[]);
const bad=await post({action:'start',name:'fake.png',mime:'image/png',size:4,collection:'portraits'});assert.equal((await post(new Uint8Array(4),owner,`?action=part&id=${bad.data.id}&part=1`,true)).status,400);
// Resume a multipart handle after module reload, using its disk metadata.
const key=`galleries/${crypto.randomUUID()}/${crypto.randomUUID()}`,m=await runtime.bucket.createMultipartUpload(key,{httpMetadata:{contentType:'image/jpeg'}}),part=await m.uploadPart(1,new Uint8Array([255,216,255]));const restarted=await import('../server/railway-env.mjs?restart=1');await restarted.bucket.resumeMultipartUpload(key,m.uploadId).complete([part]);assert.equal((await new Response((await restarted.bucket.get(key)).body).arrayBuffer()).byteLength,3);
assert.equal((await post({action:'delete',id},null)).status,403);assert.equal((await post({action:'delete',id})).status,200);assert.equal((await get('action=image&id='+id)).status,404);
console.log('Website media: 24 MB+ upload, chunk bounds/retry/resume, disk restart, drafts, publication, previews, originals, auth, origin and deletion passed.');
}finally{await rm(dir,{recursive:true,force:true})}
