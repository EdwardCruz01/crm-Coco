import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {jsPDF} from 'jspdf';
import {makeProspect,normalizeProspect,FIELDS,CHANNELS} from '../js/prospect-model.js';
import {createProspectPdf} from '../js/prospect-pdf.js';
import {crm,useCrm,connectCrm,flushCrm} from '../js/store.js';
globalThis.window={dispatchEvent(){}};
const original=structuredClone(useCrm());
test('cliente nuevo genera un prospecto prellenado en el mismo registro',async()=>{
 connectCrm(structuredClone(original),'Admin','admin',async()=>{});
 const result=crm.saveClient({...original.clients[0],name:'Persona prueba',phone:'900001234',email:'',dni:''});
 await flushCrm();const c=useCrm().clients.find(c=>c.id===result.id);
 assert.equal(c.prospect.fullName,'Persona prueba');assert.equal(c.prospect.phone,'900001234');assert.equal(c.prospect.projectName,original.projects.find(p=>p.id===c.projectIds[0]).name);
});
test('vacíos guardados se conservan y una edición de cliente no borra el prospecto',async()=>{
 connectCrm(structuredClone(original),'Asesor','asesor',async()=>{});
 const c=useCrm().clients[0],p=makeProspect(c,original.projects,original.advisors);p.fullName='';p.email='';p.price='';
 crm.saveProspect(c.id,p);await flushCrm();
 crm.saveClient({...c,name:'Nombre corregido'},c.id);await flushCrm();
 const stored=useCrm().clients.find(x=>x.id===c.id);assert.equal(stored.name,'Nombre corregido');assert.equal(makeProspect(stored).fullName,'');assert.equal(stored.prospect.price,'');
});
test('compra conjunta y nivel son condicionales',()=>{
 const p=normalizeProspect({jointPurchase:'No',jointName:'No debe salir',projectType:'Lote',level:'7'});
 assert.equal(p.jointName,'');assert.equal(p.level,'');
 const q=normalizeProspect({jointPurchase:'Sí',jointName:'María',projectType:'Departamento',level:'7'});assert.equal(q.jointName,'María');assert.equal(q.level,'7');
});
test('datos opcionales vacíos y ceros válidos; DNI y cuotas inválidos se rechazan',()=>{
 assert.equal(normalizeProspect({deposit:'0'}).deposit,'0');assert.equal(normalizeProspect({}).dni,'');
 assert.throws(()=>normalizeProspect({dni:'123'}));assert.throws(()=>normalizeProspect({email:'no-correo'}));assert.throws(()=>normalizeProspect({fractionCount:'2.5'}));assert.throws(()=>normalizeProspect({deposit:'-10'}));
 assert.deepEqual(normalizeProspect({channels:['Facebook','inexistente']}).channels,['Facebook']);
});
test('fallo de guardado revierte el prospecto y su historial',async()=>{
 connectCrm(structuredClone(original),'Admin','admin',async()=>{throw Error('Sin conexión');});
 crm.saveProspect(original.clients[0].id,{fullName:'Temporal'});await assert.rejects(flushCrm());assert.deepEqual(useCrm(),original);
});
test('PDF normal y vacío mantienen una página y el documento no rellena ceros',async()=>{
 const background=new Uint8Array(await readFile('public/prospectos/base-coco.png'));
 const blank=createProspectPdf(jsPDF,{},background);assert.equal(blank.getNumberOfPages(),1);
 const p=makeProspect(original.clients[0],original.projects,original.advisors);p.channels=['Facebook','WhatsApp'];
 assert.equal(createProspectPdf(jsPDF,p,background).getNumberOfPages(),1);
 assert.ok(blank.output('arraybuffer').byteLength>1000);
 const long=createProspectPdf(jsPDF,{address:'Dirección de prueba extensa '.repeat(30),reference:'Referencia extensa '.repeat(40),paymentCommitment:'Detalle del compromiso de pago '.repeat(25)},background);
 assert.ok(long.getNumberOfPages()>1);
});
