import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(){try{await env.DB?.prepare('SELECT 1 AS ok').first();if(!env.DB)throw new Error('Database unavailable');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({status:'unavailable'},{status:503})}}
