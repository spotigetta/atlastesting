# Lectura y liturgia: entrega local

Fecha: 5 de noviembre de 2026. Versión pública conservada: 1.0.14; construcción local: `reading-liturgy-20261105`. No se ha realizado commit, push ni publicación.

## Resultado

El lector muestra enlaces, notas y tablas sin los defectos reproducidos en las pruebas. Busca en el texto visible incluso cuando la frase cruza una etiqueta de énfasis. Guarda la posición continua según el fragmento visible y permite reintentar una apertura fallida. Se han corregido carreras entre aperturas y refrescos, y la búsqueda vuelve a intentar cargar tras recuperar conexión.

La reconciliación recupera 309 rutas fuente con evidencia de igualdad o normalización histórica. Conserva los 1.385 identificadores, el texto y los límites de fragmento. Solo cinco payloads cambian de esquema `text` a `markdown`. El índice regenerado contiene los mismos documentos que el catálogo: no faltan ni sobran IDs. Los hashes de contenido e índice se incorporan a las claves de caché. El build comprueba también esa correspondencia antes de permitir una publicación.

En Rezar, «Horas y misa» abre `#/liturgia`. Permite seleccionar fecha, volver a hoy y distinguir Península/Baleares de Canarias. Incluye accesos españoles a las horas, lecturas y propios de la misa y ordinario del misal. La fecha se transmite con el formulario POST que usa iBreviary, no con parámetros GET ignorados. Los textos se leen en la fuente externa. El formulario y los enlaces están contrastados por HTTP y contratos locales; no se verificaron las cookies del formulario en un navegador real.

## Comprobaciones

- `npm.cmd test`: 63 pruebas de renderer, búsqueda y contratos de ejecución.
- `npm.cmd run test:corpus`: cinco pruebas de conservación de fuentes, copias y correspondencia del índice.
- `npm.cmd run build`: correcto; valida 12 bibliotecas y 1.385 documentos, incluidos hashes del contenido publicado.
- HTTP local: inicio, lector, módulo y estilos de liturgia y catálogo responden 200 en el puerto 8766.
- `git diff --check`: sin errores en los cambios del encargo.

Autor y revisor se separaron para lector, datos y pruebas. La revisión detectó una regresión real al volver a fragmentar 248 documentos: habría desplazado progreso y subrayados existentes. Se restauraron esos payloads y se retiró esa operación del sincronizador. Las copias siguen en `reports/corpus-backup-*` y `reports/search-backup-*`, excluidas de Git pero conservadas en disco. Los informes registran la aplicación y la reversión.

## Pendientes y límites

El navegador devolvió `The browser access host is unavailable`. No se ha verificado visualmente móvil, teclado, scroll nativo ni selección real de texto. Las pruebas de contratos no sustituyen esos recorridos.

El inventario y el normalizador revisaron los archivos, pero no equivalen a una corrección editorial completa: 38 rutas no tienen correspondencia demostrada, dos son ambiguas y 21 fuentes difieren de su payload sin una transformación probada. Otras 248 normalizaciones históricas requieren migrar referencias y marcas antes de sincronizar. El normalizador propone cero cambios seguros adicionales y señala 1.127 documentos para revisión humana. No se ha inventado texto para resolver OCR o encabezados dudosos.

No hay autorización identificada para redistribuir el corpus litúrgico oficial completo. La alternativa entregada usa enlaces externos y no permite leer esos textos sin conexión dentro de Atlas. No incorpora motor de calendario ni certifica celebraciones, precedencias o variantes diocesanas de iBreviary. La aplicación oficial de la CEE se mantiene como referencia española. La observación de ePrex fue de su web y material oficial, no una prueba de la aplicación nativa.

Las reconstrucciones escriben varios archivos: deben terminar y validarse antes de publicar. No desplegar a mitad de una reconstrucción.

## Evidencia

- [Fuentes y condiciones litúrgicas](liturgy-sources-review.md).
- [Revisión independiente del corpus](qa-corpus-review.md).
- [Pruebas de ejecución y límites](qa-runtime-review.md).
- Auditoría final: `reports/corpus-audit-after.json`.
- Reversión segura: `reports/corpus-normalization-rollback.json`.
