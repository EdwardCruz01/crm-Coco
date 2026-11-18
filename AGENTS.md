# COCO CRM — JavaScript puro

La aplicación activa está en index.html, css/ y js/. No introducir React, JSX o TypeScript. El original se conserva en backup y no se despliega.

Mantener las mutaciones detrás de crm. Las reglas UI no sustituyen RLS. Roles separados de perfiles, claves privilegiadas únicamente en Edge Functions. No inventar verificaciones DNI ni presentar resultados faciales demo como biometría real. No desplegar ni conectar bases remotas sin indicación del propietario.

Ejecutar npm test y npm run build tras cambios funcionales. Publicar únicamente dist. Las funciones Supabase usan JavaScript con el runtime Deno.
