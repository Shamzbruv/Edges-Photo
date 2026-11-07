import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import webpush from 'web-push';
const dir=await mkdtemp(path.join(os.tmpdir(),'edge-notification-test-'));process.env.STUDIO_DATA_DIR=dir;process.env.STUDIO_ADMIN_EMAIL='owner@example.test';
const {database,env}=await import('../server/railway-env.mjs');const {pushKeys,deliverPending}=await import('../server/push-notifications.mjs');const db=database(),keys=pushKeys();assert.deepEqual(pushKeys(),keys);process.env.STUDIO_PUSH_PUBLIC_KEY=keys.publicKey;
globalThis.__testNotificationsEnv=env;globalThis.__notificationUser=null;
let source=ts.transpileModule(await readFile('app/api/notifications/route.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/import\s*\{\s*env\s*\}\s*from\s*['"]cloudflare:workers['"];?/, 'const env=globalThis.__testNotificationsEnv;').replace(/import\s*\{\s*getChatGPTUser\s*\}\s*from\s*['"][^'"]+['"];?/, 'const getChatGPTUser=async()=>globalThis.__notificationUser;');
const route=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const owner={email:'owner@example.test'};
async function post(body,user=owner,origin='https://studio.test'){globalThis.__notificationUser=user;const r=await route.POST(new Request('https://studio.test/api/notifications',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}
async function get(user=owner){globalThis.__notificationUser=user;const r=await route.GET(new Request('https://studio.test/api/notifications'));return {status:r.status,data:await r.json()}}
const k=webpush.generateVAPIDKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-device',keys:{p256dh:k.publicKey,auth:Buffer.alloc(16,1).toString('base64url')}};
try{
assert.equal((await get(null)).status,403);assert.equal((await post({action:'subscribe',subscription},null)).status,403);assert.equal((await post({action:'read',all:true},owner,'https://evil.test')).status,403);
assert.equal((await post({action:'subscribe',subscription:{...subscription,endpoint:'https://127.0.0.1/internal'}})).status,400);
assert.equal((await post({action:'subscribe',subscription})).status,200);assert.equal((await post({action:'subscribe',subscription})).status,200);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,1);
await db.prepare('INSERT INTO notifications(id,kind,title,body,url,created_at) VALUES(?,?,?,?,?,?)').bind('booking-test','booking','New booking request','Private Client Name','/admin/bookings',new Date().toISOString()).run();
assert.equal((await get()).data.unread,1);assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_deliveries').first()).n,1);
let sends=0;await deliverPending({db,keys,send:async(s,p,options)=>{sends++;assert.equal(s.endpoint,subscription.endpoint);assert.ok(!p.includes('Private Client Name'));const encrypted=webpush.generateRequestDetails(s,p,options);assert.ok(encrypted.body.byteLength>0)}});assert.equal(sends,1);
await deliverPending({db,keys,send:async()=>{throw new Error('Delivered message must not resend')}});
await post({action:'read',id:'booking-test'});assert.equal((await get()).data.unread,0);
await post({action:'test',endpoint:subscription.endpoint});await deliverPending({db,keys,send:async()=>{throw {statusCode:503}}});const retry=await db.prepare('SELECT * FROM push_deliveries WHERE delivered_at IS NULL').first();assert.equal(retry.attempts,1);assert.ok(retry.next_attempt>Date.now());
await db.prepare('UPDATE push_deliveries SET next_attempt=0 WHERE delivered_at IS NULL').run();await deliverPending({db,keys,send:async()=>{throw {statusCode:410}}});assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,0);
assert.equal((await post({action:'subscribe',subscription})).status,200);assert.equal((await post({action:'unsubscribe',endpoint:subscription.endpoint})).status,200);
console.log('PASS: notification authorization/origin, safe subscription endpoints, durable keys, idempotent subscriptions, transactional delivery queue, encrypted push generation, no resend, transient retry, expired-device removal, unread/read states and unsubscribe.');
}finally{await rm(dir,{recursive:true,force:true})}
