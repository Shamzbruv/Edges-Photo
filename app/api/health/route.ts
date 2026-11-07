import {supabaseEnabled} from '../../../lib/supabase-proxy';
import config from '../../../lib/supabase-config.json';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){try{if(supabaseEnabled){const r=await fetch(config.url+'/functions/v1/edge-studio?kind=health',{headers:{apikey:config.anonKey,Authorization:'Bearer '+config.anonKey},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Backend unavailable');return Response.json({status:'ok',backend:'supabase'},{headers:{'Cache-Control':'no-store'}})}await env.DB?.prepare('SELECT 1 AS ok').first();if(!env.DB)throw new Error('Database unavailable');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({status:'unavailable'},{status:503})}}
