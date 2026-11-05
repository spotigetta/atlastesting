# Revisión independiente del corpus editorial

Revisor: agente de producto, distinto del autor de `tools/editorial-corpus.mjs`. Fecha: 5 de noviembre de 2026. Esta revisión no modifica el corpus ni sus metadatos.

## Alcance

Se revisa la limpieza de los documentos públicos generados en `data/documents`, junto con los cambios de metadatos del catálogo. Los Markdown fuente permanecen fuera de esta transformación. El resultado final se contrasta con las copias originales indicadas en `reports/editorial-corpus-apply.json`.

El mapa temático tiene una comprobación separada: `node --test tools/test-discovery-library.mjs`. Sus ocho pruebas comprueban las citas literales y las rutas del lector, además del control de acceso y los errores al abrir el cuaderno.

## Criterios examinados

- Conservar los identificadores y las rutas de contenido. No alterar el orden ni los índices de los fragmentos.
- Mantener los niveles y el orden de los capítulos. Conservar `anchor`, `level` y `chunkIndex` de cada entrada del índice.
- Guardar íntegros los bloques bibliográficos retirados del cuerpo, con su hash y fragmento de origen.
- Asignar autores mediante declaraciones literales de la fuente o un nombre de colección explícito. No deducirlos del asunto de un libro.
- Registrar por separado los títulos de las obras contenidas en una colección y la evidencia de los cambios del catálogo.
- Verificar cada archivo de respaldo y cada exportación Markdown, sin interpretar el hash normalizado como una prueba de equivalencia literaria.

## Revisión de las reglas

Se ha leído el script completo. Las reglas no traducen el texto ni intentan reconstruir frases de OCR por contexto. Las reparaciones de caracteres se restringen a secuencias UTF-8 reversibles, tipografía C1 y ligaduras identificadas. Las URL, los destinos de enlaces y el código quedan fuera de la limpieza de prosa.

Los rótulos `Title:`, `Author:` y `Year:` se retiran de los encabezados visibles; su contenido se mantiene y se registra como metadato. En una colección de varias obras, `workMetadata` conserva los títulos internos y el fragmento en el que se declararon. El título público de la colección deja de presentarla como si contuviera únicamente su primera obra.

La prueba de conservación del propio script contrasta cada resultado con las transformaciones declaradas sobre la copia original. Se añade una comprobación independiente del orden de los caracteres ASCII alfanuméricos del cuerpo. Esta segunda comprobación excluye únicamente los bloques bibliográficos retenidos y las marcas de presentación permitidas, y expande las ligaduras conocidas. No sustituye la revisión lingüística de los caracteres no ASCII.

## Resultado

La comparación independiente del resultado aplicado ha terminado sin diferencias no autorizadas. Abarca los 1.385 documentos y los 14.692 fragmentos del informe definitivo. Se han comparado, en orden, 579.665.497 caracteres ASCII alfanuméricos del cuerpo después de excluir únicamente las marcas descritas. No se ha encontrado una eliminación ni una reordenación en esa secuencia.

| Comprobación independiente | Resultado |
|---|---|
| Identificadores y rutas de contenido | 1.385 conservados |
| Categorías del catálogo | 1.385 conservadas; no se reclasifica a partir del título |
| Entradas del índice | 118.345 con el mismo `anchor`, `level` y `chunkIndex` |
| Índices y cantidad de fragmentos | Sin cambios en los 1.385 documentos |
| Obras internas | 646 entradas `workMetadata` contrastadas con un título bibliográfico literal y su fragmento |
| Autores incorporados | 298 con evidencia declarada, comprobada contra el encabezado, YAML o nombre explícito de la colección |
| Nombres existentes normalizados | Tres cambios de espacios; una marca «Desconocido» pasa a `null` |

La atribución de las obras internas no se deduce de su argumento. Cuando una colección contiene más de un título, su lista `workTitles` coincide con las entradas de `workMetadata`. La colección anónima no recibe un nombre de autor inventado.

El informe de aplicación registra 1.306 cuerpos modificados y 1.311 payloads modificados. Se han corregido metadatos de 939 fichas. Se retienen íntegros 1.256 bloques YAML y 1.938 rótulos bibliográficos. Hay 997 exportaciones Markdown distintas, con 580.175.383 bytes en total.

Las copias utilizadas son las de `reports/editorial-backup-cf85efbf9a4dccf4`. Los resultados de las pruebas ejecutadas son:

- `node tools/editorial-corpus.mjs --test`: correcto.
- Comparación independiente del cuerpo y de la evidencia bibliográfica: cero incidencias.
- `node --test tools/test-discovery-library.mjs`: ocho pruebas correctas después de aplicar la limpieza.
- `node tools/build-discovery-library.mjs --check`: 12 temas y 13 citas literales conservadas.
- `node tools/editorial-corpus.mjs --verify`: correcto; 1.311 payloads modificados, 11.528 fragmentos de esos payloads, 997 exportaciones y 1.313 respaldos verificados. Identificadores y anclas estables.

## Límites

La limpieza no acredita que una atribución ya presente en una edición histórica sea correcta. Permanecen 617 documentos sin autor declarado y 567 sin idioma declarado. Se han señalado 84 etiquetas HTML residuales, 119 posibles encabezados malformados y 223 secuencias de carets; esas marcas requieren inspección de su función antes de retirarlas. Los errores de OCR que requieren interpretar una frase no se corrigen automáticamente.

No se ha observado esta revisión en navegador: el host de automatización no está disponible en la sesión. Las comprobaciones de estructura y contenido descritas aquí se ejecutan sobre los archivos.
