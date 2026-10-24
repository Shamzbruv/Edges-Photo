import {env} from 'cloudflare:workers';
import {authConfigured,createSession,SESSION_COOKIE,secureEqual} from '../../../lib/admin-session';
export const dynamic='force-dynamic';
const attempts=new Map<string,{count:number,reset:number}>();
const e=()=>env as unknown as Record<string,any>;
export async function GET(){return Response.json({runtime:e().STUDIO_RUNTIME==='railway'?'railway':'sites',configured:authConfigured(e())},{headers:{'Cache-Control':'no-store'}})}
export async function POST(req:Request){const settings=e();if(settings.STUDIO_RUNTIME!=='railway')return Response.json({error:'Use ChatGPT sign-in on this deployment.'},{status:400});if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});let b:any;try{b=await req.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
const secure=new URL(req.url).protocol==='https:'?'; Secure':'';
if(b.action==='logout')return Response.json({ok:true},{headers:{'Set-Cookie':SESSION_COOKIE+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+secure,'Cache-Control':'no-store'}});
if(!authConfigured(settings))return Response.json({error:'Studio login needs setup. Set STUDIO_ADMIN_EMAIL and a STUDIO_ADMIN_PASSWORD of at least 16 characters in Railway variables, then redeploy.'},{status:503});
const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const now=Date.now();for(const [k,v] of attempts)if(v.reset<now)attempts.delete(k);if(attempts.size>10000)attempts.clear();const current=attempts.get(address)||{count:0,reset:now+15*60000};if(current.count>=10)return Response.json({error:'Too many attempts. Please try again in 15 minutes.'},{status:429});current.count++;attempts.set(address,current);
const email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=typeof b.password==='string'?b.password:'';
if(password.length>1024||!settings.STUDIO_ADMIN_EMAIL.split(',').map((s:string)=>s.trim().toLowerCase()).includes(email)||!secureEqual(password,settings.STUDIO_ADMIN_PASSWORD))return Response.json({error:'Email or password is incorrect.'},{status:401});
attempts.delete(address);return Response.json({ok:true},{headers:{'Set-Cookie':SESSION_COOKIE+'='+createSession(email,settings)+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200'+secure,'Cache-Control':'no-store'}})}
