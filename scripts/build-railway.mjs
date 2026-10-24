import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{stdio:'inherit',env:{...process.env,STUDIO_DEPLOY_TARGET:'railway',NODE_ENV:'production'}});
if(result.error)throw result.error;
process.exit(result.status??1);
