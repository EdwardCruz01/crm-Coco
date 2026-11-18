# Validación remota · 18/11/2026

Pruebas realizadas contra tzmthfapmtjvunijquby con la API y la CLI, sin guardar credenciales en archivos:

- Inicio de sesión de administrador, perfil y rol: correcto.
- RLS habilitado en profiles, user_roles y crm_records: comprobado por SQL.
- Creación de un asesor mediante create-advisor y acceso con su sesión: correcto.
- Asesor intentando insertar proyecto, asignarse rol admin y crear otro asesor: rechazado (403).
- Cuenta sin rol, incluso con role=admin en sus metadatos: cero registros visibles y escritura rechazada (403).
- Acceso anónimo: cero registros comerciales visibles; función DNI rechazada (403).
- Guardado de cliente con prospecto desde asesor y lectura desde administrador: correcto, incluidos campos vacíos.
- Lote con modificación de cliente y proyecto no permitido: rechazado y cliente anterior conservado (transacción atómica).
- Cliente sin nombre, teléfono ni etapa: rechazado (400).
- check-dni con consentimiento: pending_provider (200); sin consentimiento: rechazado (400).
- Foto en carpeta propia: carga y enlace firmado correctos (200); URL pública bloqueada (400).
- Migraciones iniciales registradas y sincronizadas; funciones desplegadas desde archivos JavaScript locales.
- Eliminados los usuarios, cliente, asesor e imagen temporales creados exclusivamente para estas pruebas. Se conserva la cuenta administradora solicitada.

La revisión local pasó 24 pruebas Node/jsdom, incluyendo generación de PDF y rechazo de claves privadas en la configuración. La compilación estática finalizó correctamente. npm audit: cero vulnerabilidades al instalar las dependencias de esta entrega. La nueva capa visual no fue comprobada visualmente en todos los tamaños de pantalla en esta actualización. No se probó entrega de correos, un proveedor real de DNI ni despliegue web público.
