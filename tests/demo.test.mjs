import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {ORGANS,DEMO_PATIENT,DEMO_TEMPLATES} from '../src/demo/fixtures.mjs';
import {localSession,simulateTranscription,simulateFindings,createDemoReport} from '../src/demo/adapters.mjs';
import {buildDemoDocx,escapeXml} from '../src/demo/docx.mjs';
import {execFileSync} from 'node:child_process';
test('demo login is an in-memory fictional identity with no token',()=>{assert.equal(localSession().id,'demo-local-only');assert(!JSON.stringify(localSession()).includes('token'));});
test('synthetic fixtures are explicit, immutable and not patient records',()=>{assert(Object.isFrozen(DEMO_PATIENT));assert.equal(DEMO_TEMPLATES.length,2);assert(ORGANS.every(o=>o.transcript.startsWith('SIMULADO:')&&o.result.startsWith('SIMULADO:')));});
test('transcription runs without fetch, microphone or credentials',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN');};try{assert.equal((await simulateTranscription('higado',{delay:0})).text,ORGANS[0].transcript);}finally{globalThis.fetch=previous;}
});
test('simulated dictation can be cancelled',async()=>{const controller=new AbortController();const p=simulateTranscription('higado',{signal:controller.signal});controller.abort();await assert.rejects(p,e=>e.name==='AbortError');});
test('unknown organ and arbitrary clinical text are not processed',()=>{assert.throws(()=>simulateTranscription('unknown'));assert.deepEqual(simulateFindings({higado:'arbitrary input'}),[]);});
test('deterministic findings preserve organ order',()=>{const d=Object.fromEntries([...ORGANS].reverse().map(o=>[o.id,o.transcript]));assert.deepEqual(simulateFindings(d).map(o=>o.id),ORGANS.map(o=>o.id));});
test('report rejects results and templates outside synthetic fixtures',()=>{assert.throws(()=>createDemoReport([{id:'higado',narrative:'unreviewed'}]));assert.throws(()=>createDemoReport([],'private-template'));});
test('DOCX is generated from scratch with expected OOXML parts and disclaimer',()=>{
 const findings=simulateFindings({higado:ORGANS[0].transcript});const files=unzipSync(buildDemoDocx(createDemoReport(findings)));assert.deepEqual(Object.keys(files).sort(),['[Content_Types].xml','_rels/.rels','word/document.xml'].sort());
 const xml=strFromU8(files['word/document.xml']);assert(xml.includes('SYNTHETIC_DEMO'));assert(xml.includes('NOT FOR CLINICAL USE'));assert(xml.includes(DEMO_PATIENT.nombre));assert(xml.includes('Hígado'));assert(!xml.includes('http://api.'));
});
test('DOCX ignores supplied patient replacements and refuses non-demo mode',()=>{const report=createDemoReport([]);report.patient.nombre='NOT_ALLOWED';const xml=strFromU8(unzipSync(buildDemoDocx(report))['word/document.xml']);assert(!xml.includes('NOT_ALLOWED'));assert.throws(()=>buildDemoDocx({...report,mode:'REAL'}));});
test('XML escaping prevents markup injection',()=>assert.equal(escapeXml('<script> & "x"'), '&lt;script&gt; &amp; &quot;x&quot;'));
test('fictional template selection changes layout and preserves the synthetic disclaimer',()=>{
 const xml=id=>strFromU8(unzipSync(buildDemoDocx(createDemoReport([],id)))['word/document.xml']);
 assert(xml('demo-general').includes('Tutor ficticio:'));assert(!xml('demo-compact').includes('Tutor ficticio:'));assert(xml('demo-compact').includes('NOT FOR CLINICAL USE'));
});
test('candidate privacy and offline-source checks',()=>{execFileSync(process.execPath,['scripts/privacy-check.mjs'],{stdio:'pipe'});});
