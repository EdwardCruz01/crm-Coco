import test from 'node:test';
import assert from 'node:assert/strict';
import * as backend from '../js/backend.js';
import {config} from '../js/config.js';
import {authenticateDemo} from '../js/demo-auth.js';
import {crm,useCrm,CURRENT_USER} from '../js/store.js';
import {canAccess} from '../js/permissions.js';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.window={dispatchEvent(){}};
// Tests explicitly use local demo configuration; never contact the live project.
config.url='';config.key='';
test('admin / 1234 habilita el rol administrador',async()=>{
 backend.enterDemo('admin','1234');
 assert.equal(backend.account.role,'admin');
 assert.equal(backend.demo,true);
 assert.equal(canAccess(backend.account.role,'/usuarios'),true);
 assert.doesNotThrow(()=>crm.saveProject(useCrm().projects[0]));
 await backend.logout();
 assert.equal(backend.account,null);
});
test('asesor / 1234 conserva los límites del asesor',async()=>{
 backend.enterDemo('asesor','1234');
 assert.equal(backend.account.role,'asesor');
 assert.match(CURRENT_USER,/Asesor/);
 assert.equal(canAccess(backend.account.role,'/clientes'),true);
 assert.equal(canAccess(backend.account.role,'/usuarios'),false);
 assert.throws(()=>crm.saveProject(useCrm().projects[0]),/administradores/);
 assert.throws(()=>crm.setTemplate('Visita','No permitido'),/administradores/);
 await backend.logout();
});
test('rechaza claves y usuarios incorrectos sin iniciar sesión',()=>{
 for(const [u,p] of [['admin','123'],['asesor',''],['otro','1234']])assert.throws(()=>backend.enterDemo(u,p),/incorrectos/);
 assert.equal(backend.account,null);
 assert.throws(()=>authenticateDemo('__proto__','1234'),/incorrectos/);
});
test('configurar Supabase desactiva el acceso demo',()=>{
 config.url='https://example.supabase.co';
 try{assert.throws(()=>backend.enterDemo('admin','1234'),/desactivados/);assert.equal(backend.account,null);}
 finally{config.url='';}
});
