// Start the actual production build, exercise HTTP workflows, and restart it.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dataDir=mkdtempSync(path.join(tmpdir(),'edge-railway-test-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port;let child,logs='';
const env={...process.env,PORT:String(port),STUDIO_DATA_DIR:dataDir,RAILWAY_VOLUME_MOUNT_PATH:dataDir,RAILWAY_ENVIRONMENT_ID:'isolated-test',STUDIO_ADMIN_EMAIL:'studio@example.test',STUDIO_ADMIN_PASSWORD:'Runtime-test-password-2026-only',NODE_ENV:'production'};
async function start(){child=spawn(process.execPath,['server/start-railway.mjs'],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>{logs+=d});child.stderr.on('data',d=>{logs+=d});const deadline=Date.now()+20000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error('Production server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('Server did not become healthy: '+logs)}
async function stop(){if(!child||child.exitCode!==null)return;const exit=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exit}
let cookie='';
async function get(action,args={},extra={}){const r=await fetch(base+'/api/studio?'+new URLSearchParams({action,...args}),{headers:{...(cookie?{Cookie:cookie}:{}),...extra}});return {status:r.status,data:await r.json()}}
async function post(action,body={}){const r=await fetch(base+'/api/studio',{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({action,...body})});return {status:r.status,data:await r.json()}}
try{
 await start();
 assert.match(await (await fetch(base)).text(),/Beyond/);
 assert.equal((await fetch(base+'/images/hero.webp')).status,200);
 const pages=[['/work','best light.'],['/work/portraits','The art of being you.'],['/work/weddings','Always, from here.'],['/work/celebrations','Made for this moment.'],['/sessions','A different edge.'],['/experience','More than'],['/about','A feeling for people.'],['/journal','Field notes'],['/journal/prepare-for-your-portrait','Build outfits that work together'],['/journal/wedding-photo-timeline','Make the family list specific'],['/journal/choose-your-favourites','Build a balanced shortlist'],['/journal/care-for-your-final-images','Keep more than one copy'],['/client-lounge','Your collection.'],['/contact','Tell us what'],['/book','something beautiful.'],['/admin/bookings','workspace is protected'],['/admin/galleries','workspace is protected'],['/admin/payments','workspace is protected'],['/admin/settings','workspace is protected'],['/admin/website','workspace is protected'],['/admin/preview/website','WORKSPACE PREVIEW'],['/admin/preview/bookings','WORKSPACE PREVIEW'],['/admin/preview/galleries','WORKSPACE PREVIEW'],['/admin/preview/payments','WORKSPACE PREVIEW'],['/admin/preview/settings','WORKSPACE PREVIEW']];
 const pageResults=await Promise.all(pages.map(async([route,content])=>{const r=await fetch(base+route),html=await r.text();assert.equal(r.status,200,route);assert.ok(html.toLowerCase().includes(content.toLowerCase()),route+' missing content');return html}));
 for(const route of ['/work/missing','/journal/missing','/admin/missing','/admin/preview/missing'])assert.equal((await fetch(base+route)).status,404,route);
 // All internal page destinations exposed by the public navigation must resolve.
 const destinations=new Set(pageResults.flatMap(html=>[...html.matchAll(/href="(\/[^"#?]*)/g)].map(m=>m[1])).filter(h=>!h.startsWith('/_')&&!h.startsWith('/api/')&&!h.startsWith('/images/')));
 for(const href of destinations)assert.ok((await fetch(base+href)).status<400,'Broken destination '+href);
 console.log('PASS: 25 content/workspace pages, unknown-route 404s and internal navigation destinations.');

 assert.equal((await get('dashboard')).status,403);
 assert.equal((await get('dashboard',{}, {'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'studio@example.test'})).status,403);
 const auth=await fetch(base+'/api/auth',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'studio@example.test',password:env.STUDIO_ADMIN_PASSWORD})});assert.equal(auth.status,200);cookie=auth.headers.get('set-cookie').split(';')[0];
 assert.equal((await get('dashboard')).status,200);
 const config=(await get('config')).data;assert.equal(config.authPath,'/studio-login');config.settings.pricingApproved=true;
 assert.equal((await post('saveSettings',{settings:config.settings})).status,200);
 const date=new Date(Date.now()+12*86400000);while(date.getUTCDay()===0)date.setUTCDate(date.getUTCDate()+1);
 const booking=await post('book',{name:'Runtime Test',email:'client@example.test',phone:'8765550100',service:'portrait',date:date.toISOString().slice(0,10),time:'09:00',location:'Test studio',notes:'HTTP runtime test',method:'cash',consent:true});assert.equal(booking.status,200);
 const created=await post('createGallery',{title:'Runtime Test Gallery',email:'client@example.test',limit:1});assert.equal(created.status,200);
 const g=(await get('adminGallery',{id:created.data.id})).data.gallery;
 const form=new FormData();form.set('galleryId',g.id);form.set('kind','proof');form.set('file',new File([readFileSync('public/images/hero.webp')],'test.webp',{type:'image/webp'}));const uploaded=await fetch(base+'/api/studio',{method:'POST',headers:{Origin:base,Cookie:cookie},body:form});assert.equal(uploaded.status,200);
 assert.equal((await post('galleryStatus',{id:g.id,status:'proofing'})).status,200);
 const photo=(await get('gallery',{token:g.token})).data.photos[0];
 assert.equal((await post('select',{token:g.token,ids:[photo.id],notes:'Preserve natural light.'})).status,200);
 await stop();await start();
 assert.equal((await get('booking',{token:booking.data.token})).data.booking.name,'Runtime Test');
 assert.equal((await get('gallery',{token:g.token})).data.photos[0].selected,1);
 const image=await fetch(base+'/api/studio?'+new URLSearchParams({action:'photo',token:g.token,id:photo.id}));assert.equal(image.status,200);assert.ok((await image.arrayBuffer()).byteLength>1000);
 // Website photos upload independently from GitHub, including files over the old cap.
 async function media(body,query='',raw=false){const r=await fetch(base+'/api/website'+query,{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':raw?'application/octet-stream':'application/json'},body:raw?body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data}
 const original=new Uint8Array(24*1024*1024+8);original.set([255,216,255,224]);
 const upload=await media({action:'start',name:'large-original.jpg',mime:'image/jpeg',size:original.length,collection:'weddings'});
 await media(original.slice(0,upload.chunkSize),`?action=part&id=${upload.id}&part=1`,true);
 await stop();await start();
 const status=await (await fetch(base+'/api/website?action=status&id='+upload.id,{headers:{Cookie:cookie}})).json();assert.equal(status.parts.length,1);
 for(let n=2;n<=Math.ceil(original.length/upload.chunkSize);n++)await media(original.slice((n-1)*upload.chunkSize,n*upload.chunkSize),`?action=part&id=${upload.id}&part=${n}`,true);
 await media({action:'complete',id:upload.id});
 assert.equal((await fetch(base+'/api/website?action=image&id='+upload.id)).status,403);
 await media({action:'save',id:upload.id,caption:'Runtime wedding',collection:'weddings',position:0,published:true,featured:true});
 const publicPhotos=await (await fetch(base+'/api/website?action=public')).json();assert.equal(publicPhotos.photos[0].id,upload.id);
 assert.equal((await (await fetch(base+'/api/website?action=image&id='+upload.id)).arrayBuffer()).byteLength,original.length);
 console.log('PASS: website management routes, authenticated 24 MB+ multipart HTTP upload, resume after production restart, private drafts and published originals.');
 // Railway's HTTPS proxy must preserve the request origin for protected POSTs.
 const proxy=await fetch(base+'/api/studio',{method:'POST',headers:{Origin:base.replace('http:','https:'),'X-Forwarded-Proto':'https',Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'saveSettings',settings:config.settings})});assert.equal(proxy.status,200);
 console.log('PASS: production boot on PORT, homepage/assets, healthcheck, rejection of spoofed platform headers, password login, database migrations, booking, photo upload, selection, persistent restart and HTTPS proxy origins.');
}finally{await stop();rmSync(dataDir,{recursive:true,force:true})}
