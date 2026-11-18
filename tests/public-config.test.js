import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePublicConfig} from '../scripts/check-public-config.mjs';
test('el build rechaza claves privadas y URLs REST en la configuración pública',()=>{
  const url='https://example.supabase.co';
  assert.doesNotThrow(()=>validatePublicConfig({url,key:'sb_publishable_example'}));
  assert.throws(()=>validatePublicConfig({url,key:'sb_secret_example'}),/privadas/);
  const role=Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url');
  assert.throws(()=>validatePublicConfig({url,key:`header.${role}.signature`}),/privadas/);
  assert.throws(()=>validatePublicConfig({url:url+'/rest/v1/',key:'sb_publishable_example'}),/raíz/);
});
