import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {resolve,relative,extname,basename} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');const files=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git'].includes(e.name))continue;const p=resolve(dir,e.name);assert(!lstatSync(p).isSymbolicLink(),'Unexpected source link');if(e.isDirectory())walk(p);else files.push(p);}}
walk(root);
for(const file of files){
 const path=relative(root,file).replaceAll('\\','/');
 assert(!/\.(?:db|sqlite\d*|docx|pdf|csv|xlsx|parquet|zip|log)$/i.test(path),'Unexpected data/binary file: '+path);
 assert(!(basename(file).startsWith('.env')&&basename(file)!=='.env.example'),'Environment file: '+path);
 const text=readFileSync(file,'utf8');
 assert(!/sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text),'Credential pattern: '+path);
 assert(!/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text),'JWT literal: '+path);
 if(path.startsWith('src/')||path==='index.html'){
  assert(!/api\.(?:openai|deepseek)\.com|[a-z0-9-]+\.supabase\.co|vettalk[^\s'"<>]*\.vercel\.app|VITE_[A-Z_]*(?:API_KEY|TOKEN)/i.test(text),'Live integration: '+path);
  assert(!/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource|MediaRecorder)\s*\(|getUserMedia\s*\(|localStorage\.|sessionStorage\.|navigator\.sendBeacon/.test(text),'External/persistent runtime adapter: '+path);
  if(extname(file)==='.css')assert(!/@import\b|url\(\s*['"]?https?:/i.test(text),'Remote stylesheet resource');
 }
}
const pkg=JSON.parse(readFileSync(resolve(root,'package.json')));const deps={...pkg.dependencies,...pkg.devDependencies};assert(!Object.keys(deps).some(k=>/supabase|openai|deepseek|vercel|iconify/i.test(k)),'Unexpected service SDK');
console.log(JSON.stringify({status:'PASS',files_checked:files.length,scope:'Versionable files and build; known credential signatures, live integration endpoints, runtime network/storage/microphone calls, private file types. Not an exhaustive identity registry.'}));
