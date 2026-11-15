import {DEMO_USER,DEMO_PATIENT,ORGANS,DEMO_TEMPLATES,SYNTHETIC_MARKER} from './fixtures.mjs';
export const localSession=()=>({...DEMO_USER});
export function findOrgan(id){const organ=ORGANS.find(x=>x.id===id);if(!organ)throw new Error('Unknown demo organ');return organ;}
export function simulateTranscription(id,{signal,delay=450}={}){
 const organ=findOrgan(id);
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(new DOMException('Cancelled','AbortError'));
  const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('Cancelled','AbortError'));};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve({mode:SYNTHETIC_MARKER,text:organ.transcript});},delay);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
export function simulateFindings(dictations){
 return ORGANS.filter(o=>dictations[o.id]===o.transcript).map(o=>({id:o.id,label:o.label,order:o.order,state:'processed',narrative:o.result,mode:SYNTHETIC_MARKER}));
}
export function createDemoReport(organs,templateId='demo-general'){
 if(!DEMO_TEMPLATES.some(x=>x.id===templateId))throw new Error('Unknown demo template');
 if(organs.some(o=>!ORGANS.some(f=>f.id===o.id&&f.result===o.narrative)))throw new Error('Only synthetic fixture results are allowed');
 return {mode:SYNTHETIC_MARKER,patient:{...DEMO_PATIENT},templateId,organs:organs.map(o=>({...o})),conclusions:'SIMULADO: esta maqueta no emite conclusiones ni diagnósticos clínicos.'};
}
