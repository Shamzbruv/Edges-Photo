import ts from 'typescript';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const dir='supabase/functions/edge-studio';mkdirSync(dir,{recursive:true});
for(const name of ['studio','website','notifications','content']){
 let source=readFileSync('app/api/'+name+'/route.ts','utf8');source=source.replace(/import \{supabaseEnabled,proxySupabase\}[^\n]+\n/,'').replace(/if\(supabaseEnabled\)return proxySupabase\('[^']+',req\);/g,'');
 let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 js=js.replace(/import \{ env \} from ['"]cloudflare:workers['"];\n/,'').replace(/import \{ getChatGPTUser \} from [^;]+;\n/,'').replace(/export const dynamic = [^;]+;\n/,'');
 const imports=[];js=js.replace(/^import .+;$/gm,line=>{imports.push(line.replace(/\.\.\/\.\.\/\.\.\/lib\/studio/g,'./studio.ts').replace(/\.\.\/\.\.\/\.\.\/lib\/content-schema/g,'./content-schema.ts'));return ''});
 js=js.replace(/export async function/g,'async function');writeFileSync(dir+'/'+name+'-handler.ts',imports.join('\n')+'\nexport function createHandlers(context:any){\nconst env=context.env;const getChatGPTUser=async()=>context.user;\n'+js+'\nreturn {GET,POST};\n}\n');
}
for(const name of ['studio','content-schema'])writeFileSync(dir+'/'+name+'.ts',readFileSync('lib/'+name+'.ts','utf8'));
