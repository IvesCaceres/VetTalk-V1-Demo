import {zipSync,strToU8} from 'fflate';
import {createDemoReport} from './adapters.mjs';
import {SYNTHETIC_MARKER} from './fixtures.mjs';
export const escapeXml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const p=text=>`<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
export function buildDemoDocx(report){
 if(report?.mode!==SYNTHETIC_MARKER)throw new Error('Synthetic report required');
 const safe=createDemoReport(report.organs,report.templateId);
 const identity=safe.templateId==='demo-compact'
  ? [`Paciente ficticio: ${safe.patient.nombre}`]
  : [`Paciente ficticio: ${safe.patient.nombre}`,`Especie: ${safe.patient.especie}`,`Tutor ficticio: ${safe.patient.tutor}`,`Centro ficticio: ${safe.patient.clinica}`];
 const lines=['VETTALK V1 — SYNTHETIC DEMONSTRATION','NOT FOR CLINICAL USE / NO APTO PARA USO CLÍNICO',SYNTHETIC_MARKER,`Plantilla: ${safe.templateId}`,...identity,'HALLAZGOS SIMULADOS',...safe.organs.map(o=>`${o.label}: ${o.narrative}`),safe.conclusions,'Generated locally from fixed synthetic fixtures. No original clinical document or private template is included.'];
 const entries={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+lines.map(p).join('')+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1000" w:bottom="1000" w:left="1000"/></w:sectPr></w:body></w:document>',
 };
 return zipSync(Object.fromEntries(Object.entries(entries).map(([name,text])=>[name,strToU8(text)])),{level:6});
}
export function downloadDemoDocx(report){
 const bytes=buildDemoDocx(report);const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
 const link=document.createElement('a');link.href=url;link.download='VetTalk-SYNTHETIC-DEMO.docx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
