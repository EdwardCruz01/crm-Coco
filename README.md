# COCO Inmobiliaria CRM

Actualización 18/11/2026: prospectos editables y PDF sobre la base COCO, selección de mensajes o prospecto desde WhatsApp, y nueva interfaz facial/DNI. Ver `PROSPECTOS-Y-VERIFICACION.md` para funcionamiento y límites de verificación.

Aplicación principal adaptada en esta raíz a HTML, CSS y JavaScript ES Modules. Sin React, JSX, TypeScript ni TanStack en la aplicación activa.

## Iniciar

Con Node.js 22: `npm install`, `npm run build`, `npm run dev`. Abrir http://127.0.0.1:5173. No abrir index.html por doble clic: los módulos necesitan un servidor HTTP.

La aplicación está configurada con la URL y clave publicable del proyecto Supabase. El acceso real utiliza correo y contraseña; las cuentas y roles se administran en el servidor. No se incluyen contraseñas ni claves privadas en el repositorio.

Para una demostración independiente: `npm run demo` y abrir http://127.0.0.1:5174. Usar `admin` / `1234` o `asesor` / `1234`. Este servidor solo escucha en la computadora local y sustituye la configuración de la API en memoria; trabaja con datos ficticios y nunca escribe en Supabase. La compilación de producción no habilita esos accesos.

## Estructura

- `index.html`, `css/app.css`: entrada y diseño responsive.
- `js/app.js`: pantallas, navegación y eventos DOM.
- `js/store.js`: reglas de negocio portadas del CRM original.
- `js/backend.js`: Supabase Auth, perfiles, carga paginada y persistencia por lotes.
- `js/config.js`: URL y clave publicable de Supabase.
- `css/polish.css`: apariencia naranja, emojis accesibles, tarjetas y acceso de bienvenida.
- `supabase/setup`: esquema sin datos demo, RLS, almacenamiento privado e integridad.
- `supabase/functions`: alta de asesores y límite de integración DNI, ejecutados en servidor.
- `supabase/migrations`: cambios SQL versionados para aplicar desde la CLI.
- `tests`: pruebas de negocio, autorización y recuperación ante fallo.
- `dist`: resultado estático para publicar; no incluye archivos privados ni respaldos.
- `backup/original-react.zip` y `backup/legacy`: original recuperable, excluido del arranque y del despliegue.

## Funciones

Dashboard e indicadores; clientes con filtros guardados, archivado, historial, compatibilidad y propuestas; embudo Kanban y tabla; agenda mensual/semanal y estados; seguimientos agrupados y plantillas WhatsApp; proyectos; ocho reportes CSV/Excel; expedientes DNI/facial; equipo; perfil y contraseñas. Se conservan colores cálidos, tipografías Manrope/Fraunces, barra lateral oscura y tarjetas del diseño original. Los componentes se reconstruyeron con controles HTML nativos.

Ejecutar `npm test` y `npm run build` para verificar. La compilación rechaza claves privadas en la configuración pública. Ver `CONEXION-SUPABASE.md` para migraciones y `VALIDACION-SUPABASE.md` para las pruebas remotas realizadas.

Para alojamiento estático usar únicamente `dist/`. `vercel.json` configura esa carpeta como salida; subir el código a GitHub no publica por sí mismo una web. Antes del lanzamiento, establecer el dominio HTTPS real en las redirecciones de Supabase Auth y comprobar la recuperación de contraseña por correo.

Límites heredados: facial demostrativo, DNI sin proveedor, documentos del cliente sin carga implementada y última escritura prevalece al editar simultáneamente el mismo registro. La exportación Excel es HTML `.xls`, como en el original. No se mantienen los proveedores propietarios de acceso de Lovable: se utiliza Supabase Auth.
