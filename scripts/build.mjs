import {build} from 'esbuild';
import './check-public-config.mjs';
import {mkdir,cp} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
await build({stdin:{contents:"export {jsPDF} from 'jspdf'",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',outfile:'vendor/jspdf.js',minify:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js'",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',outfile:'vendor/supabase.js',minify:true});
await mkdir('dist',{recursive:true});
for(const file of ['index.html','js','css','vendor','public'])await cp(file,'dist/'+file,{recursive:true});
console.log('Compilación estática lista en dist. HTML, CSS y JavaScript; sin React.');
