import path from 'node:path';
import {database,env as runtimeEnv} from './railway-env.mjs';
const port=Number(process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be a valid TCP port.');
if(process.env.RAILWAY_ENVIRONMENT_ID){process.env.VINEXT_TRUST_PROXY='1';if(process.env.RAILWAY_PUBLIC_DOMAIN)process.env.VINEXT_TRUSTED_HOSTS=process.env.RAILWAY_PUBLIC_DOMAIN;if(!runtimeEnv.STUDIO_STORAGE_READY)console.warn('Persistent storage setup required: mount a Railway volume at /data before accepting client bookings or uploads.');}
process.env.NODE_ENV='production';
database();
const {startProdServer}=await import('vinext/server/prod-server');
const {server}=await startProdServer({port,host:'0.0.0.0',outDir:path.resolve('dist')});
console.log('Edge Photos production server listening on 0.0.0.0:'+port);
if(!process.env.STUDIO_ADMIN_EMAIL||!process.env.STUDIO_ADMIN_PASSWORD)console.warn('Studio login setup required: configure STUDIO_ADMIN_EMAIL and a strong STUDIO_ADMIN_PASSWORD in Railway variables.');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
