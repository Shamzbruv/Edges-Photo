import {spawnSync} from 'node:child_process';
const railway=process.env.STUDIO_DEPLOY_TARGET==='railway'||!!process.env.RAILWAY_ENVIRONMENT_ID;
const result=spawnSync(process.execPath,railway?['scripts/build-railway.mjs']:['scripts/run-framework.mjs','build'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exit(result.status??1);
