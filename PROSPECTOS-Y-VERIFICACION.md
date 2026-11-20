> Actualización 20/11/2026: se añadieron Marketplace y Adds a los canales existentes (Facebook, TikTok y Referido ya estaban). El campo opcional Observación se guarda con cada prospecto, se puede editar y aparece sobre la nota legal en el PDF. Los textos largos continúan en otra página sin invadir la nota. No requiere una migración SQL: forma parte del prospecto guardado en el cliente.

> Actualización 18/11/2026: Supabase ya está instalado y probado. El detalle actualizado está en VALIDACION-SUPABASE.md. Las notas de conexión pendiente que siguen describen la entrega anterior.

# Prospectos y verificación

Actualización: 18 de noviembre de 2026.

## Clientes y prospectos

Al registrar un cliente se crea una instantánea de prospecto con los datos disponibles. Para los clientes anteriores se ofrece la misma ficha prellenada al abrirla. Editar el prospecto no cambia silenciosamente los datos principales del cliente; los vacíos guardados se respetan y no se rellenan otra vez.

En la ficha: **Prospecto de inscripción**. Desde el botón **WhatsApp**: seleccionar una plantilla o **Enviar prospecto**. Se puede editar, guardar, revisar y descargar un PDF. El proyecto se selecciona del inventario existente; al cambiarlo se proponen tipo, metraje, ubicación y precio, que siguen siendo editables. El nombre del copagador solo se incluye si se elige Sí. El nivel solo aparece para departamentos.

Los importes son valores declarados: no se aplica una tasa de cambio de internet ni se calcula automáticamente un plan financiero. La cuota fraccionada y la financiada, sus cantidades y fechas se conservan por separado. Se agregó la fecha de vigencia de separación para acompañar la nota.

La base del documento es la imagen facilitada por el propietario, copiada sin modificar a `public/prospectos/base-coco.png`. La nota ya impresa se conserva; no se duplica ni se cubre. El formulario se dibuja encima con líneas naranja claro. Los textos extensos pasan a páginas de continuación antes de invadir la nota. El documento es un PDF de lectura; se edita desde el CRM y se vuelve a generar.

No se suben los prospectos a un enlace público. «Compartir archivo» abre el selector del dispositivo si está disponible. Como un enlace `wa.me` no adjunta archivos, la alternativa es descargar el PDF, abrir la conversación y adjuntarlo manualmente. Abrir el mensaje no se registra como entrega confirmada.

## Persistencia

El prospecto vive en `client.prospect`, dentro del JSON del cliente. Se guarda mediante `crm.saveProspect` y el mismo lote transaccional `apply_crm_changes`; no requiere nuevas tablas o políticas. Se registra una interacción al editarlo. Administrador y asesor pueden gestionar prospectos de los clientes a los que el esquema actual da acceso. En demostración se guarda solo en el almacenamiento local existente.

## Verificación

Facial: dos columnas, carga por clic/arrastre, previsualización, finalidad, consentimiento y resultado. Sigue siendo una simulación aleatoria, claramente identificada. La fotografía no se almacena ni en localStorage ni en Supabase.

DNI: selección de cliente, prellenado, comprobación de ocho dígitos, finalidad, consentimiento, resultado y lista de expedientes consultables por nombre/DNI. El proveedor real continúa pendiente; nunca se confirma una identidad con datos inventados. La integración autenticada sigue en `check-dni`.

Los expedientes incluyen finalidad, consentimiento, fecha y responsable. El modo demo los conserva localmente en `coco-verifications-demo-v1`; con Supabase se guardan bajo `kind=verifications`, con las políticas existentes.

## Pruebas

`npm test`: 23 pruebas de lógica, persistencia, formulario DOM, permisos y PDF. `npm run build`: exportación estática actualizada. Revisados visualmente PDF de ejemplo y PDF en blanco con renderizador local. No se pudo realizar revisión visual en el navegador en esta sesión: el servicio de control de navegador no respondió. Supabase y proveedor DNI aún no conectados; sin pruebas remotas.
