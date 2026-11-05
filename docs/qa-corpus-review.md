# Revisión independiente del corpus

Fecha: 5 de noviembre de 2026. Revisor separado del trabajador que implementó los scripts. Se inspeccionaron `tools/audit-corpus.mjs`, `tools/reconcile-corpus.mjs`, `tools/build-search-index.mjs` y las pruebas de integridad. No se editaron los archivos del trabajador de contenido.

## Hallazgo que cambió la entrega

La primera reconciliación conservaba los IDs de documento, pero no la dirección interna usada por el lector. El nuevo reparto en fragmentos cambió `chunkIndex` de 828 encabezados que conservaban exactamente título, nivel y ocurrencia. En 52 documentos cambió la cantidad de fragmentos. Se compararon 253 payloads contra sus copias previas: 2.956 encabezados coincidentes conservaron el ancla; no apareció ningún cambio de ancla entre ellos.

La regresión afecta al estado existente. `scripts/reader.js` recupera `saved.chunkIndex` y guarda el progreso con el índice del fragmento. Los resaltados también se buscan dentro del fragmento guardado. Acotar un índice fuera de rango al último fragmento evita una excepción, pero no conserva el pasaje. No había una migración entre versiones del contenido.

Ejemplos reproducibles usando `reports/corpus-reconciliation-apply.json` y su `backup`:

| Documento | Fragmentos antes/después | Encabezado sin cambio | Índice antes/después |
| --- | --- | --- | --- |
| `doctrine-0332_Denzinger_parte_02` | 13 / 10 | CLEMENTE X, 1670-1676 | 1 / 0 |
| `doctrine-0591_iuvenescit_ecclesia_es` | 2 / 1 | Notas de procedencia | 1 / 0 |
| `doctrine-0308_Suma_Teologica_II_II_parte_02` | 16 / 17 | Procedencia | 15 / 16 |

El principal decidió revertir las 248 actualizaciones textuales, conservar las 309 rutas verificadas y mantener las cinco conversiones de `text` a `markdown` que no alteran el texto. El índice debe reconstruirse a partir de esos payloads conservados. Esta decisión evita publicar la regresión de posición. Cualquier futura normalización que reparta de nuevo los fragmentos necesitará una migración de progreso y anotaciones, o deberá conservar sus límites anteriores.

## Evidencia de conservación inicial

Se realizó una comprobación independiente con Node, sin invocar las funciones de auditoría del implementador. Se descomprimieron los payloads del plan y se calcularon SHA-256 directamente.

- Los 1.385 IDs y su orden coincidían con el catálogo previo. Se conservaron biblioteca, título y ruta de payload. Los únicos campos de documento modificados eran `sourceFile` en 309 fichas y `words` en 130.
- Los 255 archivos de la copia `reports/corpus-backup-123e33df2c3dba6f` coincidían con sus SHA-256 de origen. Su catálogo era idéntico byte a byte a `HEAD:data/catalog.json`.
- Los 253 payloads escritos se dividían en 248 actualizaciones textuales y cinco conversiones de esquema. Estas cinco conservaban exactamente la secuencia de textos de sus fragmentos.
- Los 1.453 Markdown inventariados conservaron su hash original. Los ocho informes históricos usados como evidencia también mantuvieron sus hashes.
- Las 248 actualizaciones tenían una cadena histórica válida desde el hash del texto antiguo al de la fuente actual. El nuevo `chunks.map(...).join('')` coincidía exactamente con la fuente actual tras eliminar BOM y normalizar saltos de línea.

Esta última igualdad demuestra correspondencia con la fuente; no prueba que el repartido nuevo conserve referencias ni progreso. En 84 de esas actualizaciones cambió la secuencia de palabras, por lo que tampoco sería correcto describir el conjunto como una mera recompresión sin cambio textual. La decisión de reversión evita depender de ese supuesto.

## Revisión de los scripts

El reconciliador evita adivinar por parecido de nombres: exige igualdad de texto o una cadena de hashes de informes históricos aplicados. Los casos ambiguos no se escriben. Verifica el catálogo y las fuentes antes de aplicar, guarda todos los objetivos antes de la primera escritura y verifica las copias. El índice se construye desde los payloads que sirve Atlas, no desde fuentes divergentes.

Se detectó que la primera versión de `audit-corpus.mjs` devolvía éxito aunque el manifiesto no coincidiera. El trabajador añadió verificaciones de digest y un modo `--strict`. Este modo distingue los problemas de correspondencia pendientes de la integridad mecánica del contenido servido. Un resultado normal sin errores no debe anunciarse como sincronización completa de todas las fuentes. Las 248 normalizaciones aplazadas aparecen como `exact-path-normalization-proven`: ese estado tampoco equivale a igualdad textual actual.

Se comprobó que la versión final del reconciliador eliminó tanto `split` como la rama que reemplazaba texto mediante normalización. Un futuro `--apply` conserva el contenido servido y registra esas normalizaciones como pendientes. Este cambio evita que otra ejecución reproduzca la regresión detectada.

Las escrituras se sustituyen mediante archivo temporal y `rename`, una a una. Esto no constituye una transacción de todo el conjunto: una interrupción puede dejar una mezcla de revisiones. Ejecutar reconciliación y construcción del índice sin otro escritor concurrente, terminar las verificaciones y publicar después el conjunto completo. No desplegar desde el directorio a mitad de escritura. Las copias y los informes deben conservarse hasta cerrar la revisión; no basta con que estén en un directorio sin seguimiento de Git.

## Verificación final

Se comprobó después de `reports/corpus-normalization-rollback.json` y de la segunda construcción del índice:

- Los 1.385 payloads se compararon directamente contra sus objetos de Git `HEAD`, sin depender del comparador del implementador. Hay 1.380 gzip idénticos byte a byte. Los cinco restantes son exactamente la conversión del campo `text` a `markdown`, sin otra diferencia en su JSON.
- Cero diferencias de `toc` y cero diferencias en el texto de cada fragmento. Los IDs y el orden permanecen intactos. En las fichas de documento solo cambia `sourceFile`, en 309 casos; los recuentos originales de palabras están restaurados.
- Los 37 segmentos de búsqueda coinciden con sus hashes, tamaños y número de términos. Las 29 copias del segundo build coinciden con los hashes previos de su informe. El orden y la cobertura de los 1.385 documentos coinciden con el catálogo.
- `contentRevision` final: `fa560014fcc2cb8d62666089c817eb40eb5429103bc2764d299c59ca39461bb9`. Revisión del índice: `1df4ef0e6d4404d2a334259c49fe9ccaf846a059f4bc81622dd88f0d4d59fa5a`. Se comprobó su correspondencia entre manifiesto y catálogo. El índice contiene 601.353 términos y 8.928.972 postings.

Comando ejecutado: `node --test tools/test-corpus-integrity.mjs`. Resultado: cinco pruebas aprobadas, cero fallos. Las comprobaciones independientes de hashes y del contenido descritas arriba también terminaron sin discrepancias.

El informe final `reports/corpus-audit-after.json` registra integridad de manifiestos y revisiones correcta, sin errores de payload ni segmentos. Mantiene 38 rutas sin resolver, dos ambiguas y 21 fuentes con texto distinto no reconciliado. Las 248 normalizaciones probadas quedan aplazadas para preservar posiciones. Esas correspondencias pendientes deben resolverse explícitamente; no afectan a la conservación de los payloads originales comprobada aquí, pero impiden afirmar que todo el catálogo está sincronizado con las fuentes actuales.

La regresión material detectada queda retirada de la entrega. No se certifica una migración de posiciones para futuros cambios textuales: precisamente se ha evitado necesitarla en esta versión.
