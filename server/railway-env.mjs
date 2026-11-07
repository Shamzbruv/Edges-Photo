// Node implementation of the small D1/R2 surface used by the studio API.
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,readdirSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
let connection;
const root=()=>path.resolve(process.env.STUDIO_DATA_DIR||process.env.RAILWAY_VOLUME_MOUNT_PATH||'.studio-data');
export function database(){
 if(connection)return connection;
 mkdirSync(root(),{recursive:true,mode:0o700});
 const sqlite=new DatabaseSync(path.join(root(),'studio.sqlite'));
 sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS _studio_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
 for(const name of readdirSync(path.resolve('drizzle')).filter(n=>n.endsWith('.sql')).sort()){
  const sql=readFileSync(path.resolve('drizzle',name),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
  const applied=sqlite.prepare('SELECT checksum FROM _studio_migrations WHERE name=?').get(name);
  if(applied){if(applied.checksum!==checksum)throw new Error('Applied migration changed: '+name);continue}
  sqlite.exec('BEGIN IMMEDIATE');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO _studio_migrations(name,checksum) VALUES(?,?)').run(name,checksum);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}
 }
 function prepare(sql,values=[]){return {bind(...p){return prepare(sql,p)},async first(column){const r=sqlite.prepare(sql).get(...values);return r?(column?r[column]:r):null},async all(){return {results:sqlite.prepare(sql).all(...values),success:true}},async run(){const v=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(v.changes)}}},execute(){const v=sqlite.prepare(sql).run(...values);return {success:true,meta:{changes:Number(v.changes)}}}}}
 connection={prepare,async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 return connection;
}
function objectPath(key){if(typeof key!=='string'||!/^galleries\/[a-f0-9-]+\/[a-f0-9-]+$/.test(key))throw new Error('Invalid object key');return path.join(root(),'photos',key)}
export const bucket={async put(key,bytes,options={}){const file=objectPath(key);mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';writeFileSync(temp,new Uint8Array(bytes),{mode:0o600});writeFileSync(file+'.json',JSON.stringify(options.httpMetadata||{}),{mode:0o600});renameSync(temp,file)},async get(key){const file=objectPath(key);if(!existsSync(file))return null;return {body:readFileSync(file),httpMetadata:JSON.parse(readFileSync(file+'.json','utf8'))}},async delete(key){const file=objectPath(key);for(const p of [file,file+'.json'])if(existsSync(p))unlinkSync(p)}};
export const env=new Proxy({}, {get(_target,key){if(key==='STUDIO_PUSH_PUBLIC_KEY')return process.env.STUDIO_PUSH_PUBLIC_KEY||null;if(key==='DB')return database();if(key==='BUCKET')return bucket;if(key==='STUDIO_RUNTIME')return 'railway';if(key==='STUDIO_STORAGE_READY')return !process.env.RAILWAY_ENVIRONMENT_ID||!!process.env.RAILWAY_VOLUME_MOUNT_PATH&&root()===path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH);return process.env[key]}});

// Multipart uploads keep request memory bounded and survive process restarts.
const {createReadStream,createWriteStream}=await import('node:fs');
const {pipeline}=await import('node:stream/promises');
const {Readable}=await import('node:stream');
const {randomUUID}=await import('node:crypto');
const {mkdir,writeFile,rename,rm,stat,readFile}=await import('node:fs/promises');
const uploadDirectory=(key,uploadId)=>{objectPath(key);if(!/^[a-f0-9-]{36}$/.test(uploadId))throw new Error('Invalid upload ID');return path.join(root(),'uploads',uploadId)};
bucket.createMultipartUpload=async(key,options={})=>{const uploadId=randomUUID(),dir=uploadDirectory(key,uploadId);await mkdir(dir,{recursive:true,mode:0o700});await writeFile(path.join(dir,'meta.json'),JSON.stringify({key,options}),{mode:0o600});return bucket.resumeMultipartUpload(key,uploadId)};
bucket.resumeMultipartUpload=(key,uploadId)=>{const dir=uploadDirectory(key,uploadId);async function meta(){const m=JSON.parse(await readFile(path.join(dir,'meta.json'),'utf8'));if(m.key!==key)throw new Error('Upload does not match object');return m}
return {uploadId,key,async uploadPart(partNumber,bytes){await meta();if(!Number.isInteger(partNumber)||partNumber<1||partNumber>10000)throw new Error('Invalid part');const file=path.join(dir,String(partNumber)),temp=file+'.'+randomUUID();await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);return {partNumber,etag:createHash('sha256').update(bytes).digest('hex')}},async complete(parts){const m=await meta(),file=objectPath(key);await mkdir(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.upload';async function* content(){for(const p of parts){const partFile=path.join(dir,String(p.partNumber));const hash=createHash('sha256');for await(const chunk of createReadStream(partFile)){hash.update(chunk);yield chunk}if(hash.digest('hex')!==p.etag)throw new Error('Upload checksum mismatch')}}try{await pipeline(Readable.from(content()),createWriteStream(temp,{mode:0o600}));await writeFile(file+'.json',JSON.stringify(m.options.httpMetadata||{}),{mode:0o600});await rename(temp,file)}catch(e){await rm(temp,{force:true});throw e}return {key}},async abort(){await rm(dir,{recursive:true,force:true})}}};
// Stream originals instead of loading an entire full-resolution image in RAM.
bucket.get=async(key)=>{const file=objectPath(key);try{await stat(file)}catch(e){if(e.code==='ENOENT')return null;throw e}return {body:Readable.toWeb(createReadStream(file)),httpMetadata:JSON.parse(await readFile(file+'.json','utf8'))}};
