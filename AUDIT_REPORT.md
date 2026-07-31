# Auditoría estructural de Atlas

## Antes

- 975 documentos activos.
- 1.207 archivos de lector.
- 678,7 MB en `data/documents`.
- 232 archivos generados sobrantes.
- índice único de aproximadamente 33 MB.
- datos duplicados como JSON y JavaScript.
- dependencia pública de `/api`.
- construcción automática al iniciar el servidor.
- versión repetida manualmente.

## Después

- 975 documentos en catálogo, lector y búsqueda.
- cero archivos de lector huérfanos.
- 208,7 MB de lector comprimido.
- 10,7 MB de búsqueda en 36 fragmentos.
- 228,0 MB de salida pública.
- archivo público mayor: 4,8 MB.
- versión única en `package.json`.
- PWA pública sin `/api`.
- build completo: aproximadamente 107 segundos en el equipo auditado.
- 9 pruebas automatizadas.
- 21 comprobaciones de salida.
- QA real en Chrome de Inicio, Descubrir y lector, sin excepciones ni 404.
- Gestor local: arranque aproximado de 0,7 s y auditoría de 0,14 s.
- 975 fuentes activas = 975 fichas = 975 lectores = 975 documentos de búsqueda.

## Riesgos

- El corpus fuente ocupa aproximadamente 601 MB.
- Pages es estático: los proveedores se actualizan por Actions.
- Instagram no garantiza acceso público estable.
- Un documento grande requiere su descarga comprimida inicial.
- `DecompressionStream` necesita un navegador moderno.

## Decisiones

- Mantener la SPA sin framework.
- Comprimir por documento.
- Segmentar el buscador.
- Mantener el Gestor local.
- No publicar desde el equipo.
- Reservar el análisis exhaustivo de hashes para el botón «Analizar ahora» del
  Gestor; la auditoría ordinaria usa metadatos para no releer 600 MB.
