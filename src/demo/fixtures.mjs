// Written specifically for this mockup. Not extracted from reports or private templates.
export const SYNTHETIC_MARKER='SYNTHETIC_DEMO';
export const DEMO_USER=Object.freeze({id:'demo-local-only',name:'Profesional de demostración (ficticio)'});
export const DEMO_PATIENT=Object.freeze({nombre:'PACIENTE-SINTETICO-001',especie:'Canino ficticio',tutor:'TUTOR-FICTICIO',clinica:'CENTRO-DEMO-FICTICIO',study:'Demostración abdominal; sin examen real'});
export const ORGANS=Object.freeze([
 {id:'higado',label:'Hígado'},{id:'bazo',label:'Bazo'},{id:'rinones',label:'Riñones'},
 {id:'vejiga',label:'Vejiga'},{id:'pancreas',label:'Páncreas'},{id:'adrenales',label:'Adrenales'},
 {id:'intestino',label:'Intestino'},{id:'linfonodos',label:'Linfonodos'},
].map((x,i)=>Object.freeze({...x,order:i,transcript:`SIMULADO: dictado ficticio para ${x.label.toLowerCase()}. No corresponde a un paciente ni a una observación real.`,result:`SIMULADO: ejemplo de presentación de ${x.label.toLowerCase()}. Sin interpretación ni validación clínica.`})));
export const DEMO_TEMPLATES=Object.freeze([
 Object.freeze({id:'demo-general',label:'Plantilla ficticia general',description:'Encabezado, datos sintéticos, hallazgos simulados y aviso de limitaciones.'}),
 Object.freeze({id:'demo-compact',label:'Plantilla ficticia breve',description:'Versión compacta creada para la maqueta; no procede de documentos clínicos.'}),
]);
