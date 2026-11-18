# Supabase conectado y actualizaciones desde código

Proyecto: tzmthfapmtjvunijquby. Instalado y comprobado el 18/11/2026.

La web utiliza solo la URL raíz HTTPS y la clave publicable de js/config.js. Las claves privadas y contraseñas no se guardan en este repositorio. Las funciones obtienen sus credenciales del entorno de Supabase.

## Actualizar mediante CLI

La CLI está fijada en package-lock.json. En esta computadora ya quedó autenticada y vinculada al proyecto. En otro equipo ejecutar primero:

```sh
npm ci
npx supabase login
npx supabase link tzmthfapmtjvunijquby
```

Los archivos de supabase/migrations/ son la fuente del historial SQL. Crear una migración nueva con un nombre temporal posterior, revisar el SQL y ejecutar:

```sh
npx supabase db push --remote --dry-run
npm run db:migrate
npm run functions:deploy
```

No volver a ejecutar INSTALAR-COCO.sql en este proyecto: es una alternativa de instalación inicial para bases vacías. Las migraciones iniciales ya figuran como aplicadas en el historial remoto. Las nuevas actualizaciones no necesitan automatizar el navegador. Para aplicar un archivo SQL puntual se puede usar npx supabase db query --remote --file RUTA.sql; preferir migraciones para cambios de esquema.

La configuración de autenticación está en supabase/config.toml. Revisar npx supabase config diff antes de npx supabase config push. Solo se modifican las propiedades declaradas. El registro público está desactivado y las cuentas asesor se crean desde Equipo con una sesión admin. Los roles se guardan en user_roles, nunca en los metadatos editables por el usuario.

## Seguridad y permisos

Las tres tablas públicas tienen RLS. Administradores gestionan el CRM; asesores trabajan con clientes, visitas y expedientes, y consultan proyectos/equipo según las reglas del CRM original. Los datos comerciales son compartidos entre el equipo autorizado. Los asesores no pueden escribir proyectos, plantillas, seguimientos administrativos ni roles. Una cuenta sin rol no accede a registros comerciales. Los cambios relacionados usan apply_crm_changes dentro de una transacción.

El bucket coco-profiles es privado, admite imágenes de hasta 5 MB, restringe escritura a la carpeta del propietario y usa enlaces firmados para lectura. Las fotos del flujo facial no se suben. Los prospectos se guardan dentro del cliente y el PDF se genera localmente.

Las funciones create-advisor y check-dni verifican el JWT del usuario con Supabase Auth y consultan su rol antes de ejecutar operaciones. verify_jwt=false evita el verificador de claves heredadas del gateway; la autorización sigue siendo obligatoria dentro de cada función. Referencia: https://supabase.com/docs/guides/functions/auth-headers

## Antes de publicar una web

Actualmente Site URL y redirecciones apuntan al servidor local 5173. Cambiar a la URL HTTPS definitiva cuando se publique. Comprobar recuperación por correo y configurar SMTP si corresponde; Google continúa desactivado. No se enviaron correos de recuperación durante estas pruebas.

Usar npm run build y publicar únicamente dist. vercel.json ya selecciona esa salida. Los respaldos, archivos de trabajo, SQL y credenciales no deben quedar en el alojamiento estático. La clave privada compartida en la conversación debe rotarse desde la gestión de claves; no fue incorporada a los archivos.

## Límites funcionales

DNI: endpoint autenticado desplegado, pendiente de proveedor externo; no devuelve una identidad confirmada. Facial: simulación explícita, no biometría real. Ediciones simultáneas del mismo registro: prevalece la última escritura. Excel conserva el formato HTML .xls del original.
