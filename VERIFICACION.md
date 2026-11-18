> Actualización 18/11/2026: Supabase ya está instalado y probado. El detalle actualizado está en VALIDACION-SUPABASE.md. Las notas de conexión pendiente que siguen describen la entrega anterior.

# Verificación de la adaptación

Fecha: 17 de noviembre de 2026.

- JavaScript activo: comprobación sintáctica sin errores.
- `npm test`: 8 pruebas aprobadas (teléfonos, duplicados, permisos, consentimiento/DNI, compatibilidad, escritura agrupada, reversión de errores, rechazo de gestión de proyectos por asesores).
- `npm run build`: correcto. Resultado estático sin React en `dist`.
- Navegación en navegador: dashboard, clientes, embudo, visitas, seguimientos, proyectos, reportes, verificación, equipo y cuenta.
- Alta de un cliente ficticio y archivado: comprobados desde la interfaz; conserva ficha e historial. El registro QA queda archivado solo en el navegador de la demostración.
- Consola de navegador: sin errores durante ese recorrido.
- Responsive: comprobadas clientes, embudo, agenda y reportes en viewport móvil. Ancho del documento igual al viewport (375 px); las tablas y el calendario tienen desplazamiento interno. Panel comprobado también a 1440 px de ancho.

No verificado contra servicios remotos: autenticación real, correos de recuperación, políticas SQL aplicadas, carga de avatar y Edge Functions. Se verificarán al conectar Supabase. No se promete ausencia absoluta de fallos ni fidelidad píxel por píxel: los componentes originales de React se reconstruyeron con HTML nativo y CSS, conservando identidad visual y módulos.

El respaldo está en `backup/original-react.zip`; los archivos retirados del arranque están en `backup/legacy`. No se borraron datos operativos ni se conectó una base externa.
