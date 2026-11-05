# Revisión de lector, caché y liturgia

Fecha: 2026-11-05. Entorno: Node.js 24.14.0 en Windows.

Resultado de runtime e integración: 36 pruebas de contratos aprobadas, sin fallos. También se ejecutaron las siguientes suites:

| Suite | Resultado |
| --- | --- |
| Renderizador y recuperación del lector | 25 aprobadas |
| Búsqueda sobre grafo DOM | 8 aprobadas |
| Runtime, caché y liturgia integrada | 36 aprobadas |
| Selector y almacenamiento de ediciones | 11 aprobadas |
| Descubrimiento y mapas de biblioteca | 8 aprobadas |
| Preguntas de descubrimiento en shorts | 3 aprobadas |
| Integridad de las traducciones registradas | 4 aprobadas |
| Corpus, respaldos y revisiones compartidas | 7 aprobadas; ejecución completa inicial y repetición del contrato de búsqueda tras regenerar el índice |

Comandos ejecutados:

```powershell
npm.cmd test
node tools/tests-reader-editions.mjs
node tools/test-discovery-library.mjs
node --test tools/translate-library-test.mjs
node tools/update-liturgy.mjs --test
node --test tools/test-corpus-integrity.mjs
node --test --test-name-pattern="search coverage" tools/test-corpus-integrity.mjs
```

Son 102 comprobaciones distintas aprobadas. La ejecución final de `npm.cmd test` reunió 95; las otras 7 corresponden al corpus. Ninguna se cuenta como prueba de navegador. El importador litúrgico añade su verificación completa de los datos reales, descrita más abajo, sin sumarla como un número arbitrario de tests. El envoltorio PowerShell `npm.ps1` está bloqueado por la política local; se utilizó `npm.cmd`.

Se ejecutan los archivos reales de producción en contextos Node VM separados. El arnés usa respuestas HTTP y bytes gzip reales de Node; simula DOM, CacheStorage, IndexedDB mediante un adaptador y localStorage. No es una prueba visual ni demuestra el comportamiento de un Service Worker instalado en un navegador. El navegador disponible no pudo utilizarse; no se sustituyó por Selenium.

## Defectos reproducidos y cierre

| Caso | Reproducción y resultado observado antes de corregir | Resultado esperado y comprobación final |
| --- | --- | --- |
| Búsqueda tras fallo del manifiesto | Primera petición rechazada; segunda búsqueda con conexión restaurada volvía a rechazar la misma promesa sin pedir el manifiesto. | Borra la promesa rechazada. La segunda búsqueda solicita el manifiesto y encuentra el documento. |
| Búsqueda tras fallo de fragmento del índice | Manifiesto correcto y primer fragmento rechazado; la segunda búsqueda reutilizaba el rechazo. | Elimina esa entrada de `shardPromises`; la segunda búsqueda recupera el fragmento y sus coincidencias. |
| Carrera entre lectura y refresco | Lectura normal pendiente, refresco versión 2 completado, lectura antigua versión 1 completada después. Una nueva instancia offline obtenía versión 1. | La respuesta antigua no sobrescribe el valor persistente nuevo; la instancia offline obtiene versión 2. |
| Refresco de documento en Service Worker | Documento versión 1 cacheado; petición `no-store` con `cache-control: no-cache` y servidor versión 2 devolvía versión 1. | Respeta el refresco explícito y devuelve versión 2. |
| Catálogo con servidor temporalmente caído | Catálogo válido cacheado, siguiente petición responde HTTP 503. Se devolvía 503 pese a existir copia. | Retorna el catálogo cacheado con estado 200. |

Los dos cambios de reintento en `scripts/search.js` los hizo el revisor. Los cambios de runtime y Service Worker los hizo el integrador; se volvieron a ejecutar las pruebas sobre esos archivos.

La inspección inicial también identificó cuatro módulos cargados por bootstrap que faltaban en el shell instalado: `architecture-polish.js`, `learning-rotate.js`, `opus-simple.js` y `learning-reorder.js`. El test final enumera los módulos del bootstrap real y confirma su presencia en el shell. Esta comprobación ya estaba corregida al ejecutar por primera vez el arnés.

## Recorridos cubiertos

El runtime conserva la subruta pública al resolver documentos. Dos lecturas simultáneas comparten una petición; una petición fallida puede repetirse. Un documento leído online vuelve a abrirse en una instancia nueva offline mediante el adaptador de almacenamiento. El JSON gzip se descomprime a partir de bytes comprimidos reales. Un refresco sustituye el valor antiguo en memoria.

Se cambian `catalog.meta.contentRevision` y `searchRevision` mientras las rutas permanecen iguales. El test confirma nuevas peticiones con parámetros de revisión distintos y la recuperación offline del contenido de la revisión nueva. Los identificadores de documento no cambian. El catálogo y los scripts no reciben esos parámetros.

También se cambia `ATLAS_EDITIONS.revision` manteniendo la ruta de la traducción. Se verifica que la versión nueva sustituye a la anterior en memoria y que una instancia offline nueva recupera la revisión correcta. El manifiesto de ediciones se actualiza por red con respaldo de caché, sin llevar el parámetro de revisión de los payloads.

La búsqueda literal descarta un candidato si el término del índice no aparece en su Markdown. Los reintentos del manifiesto y de los fragmentos se comprobaron por separado.

El Service Worker almacena un documento recién abierto y después lo sirve sin red. Se comprueba que el shell incluye los módulos que el bootstrap carga y todos los CSS locales enlazados por `index.html`. Cada ruta del shell existe en disco. El test de refresco comprueba la petición explícita; el de error HTTP comprueba el catálogo cacheado.

El lector no modifica la nueva ruta cuando se abandona una apertura pendiente, tanto si la carga termina bien como si falla. Tampoco inicia el temporizador de lectura tras abandonar esa apertura. Otro test provoca un fallo y pulsa el control local «Reintentar» dos veces. Se confirma que el botón queda desactivado, que solo solicita una nueva carga y que el renderizado real se completa; al salir se guarda su progreso.

La incorporación de los botones de recuperación requirió ampliar el DOM simulado: `#main` ahora consulta sus controles y los botones ejecutan los listeners registrados con su comportamiento `once`. Antes de actualizar el arnés, la suite falló con `main.querySelector is not a function`; era una función ausente del mock. No se retiró la comprobación de recuperación: se reforzó para probar el botón en vez de llamar directamente a `reader.open` por segunda vez. El arnés del autor confirma también que se conserva la consulta original, que un control obsoleto no reabre el lector y que se puede regresar a la biblioteca del documento desde el error.

Se simulan fragmentos con longitudes distintas: el guardado registra el fragmento visible y su proporción interna, sin inferir el índice por porcentaje global. También se restaura un progreso antiguo que apuntaba al fragmento 99 en un documento actualizado con solo dos fragmentos. Se señaló al autor que se estaba usando el índice original sin limitar durante la restauración; este lo corrigió y el test final comprueba la posición del último fragmento válido.

Los contratos de salida comprueban el uso del historial anterior y la ficha del documento cuando no hay historial o este no cambia la ruta. El formulario de notas guarda su texto en el documento actual y cierra el editor. Se ejecuta `storage.js` dos veces sobre el mismo almacén para comprobar que persisten un favorito, su progreso y una nota. Estas comprobaciones no reproducen un historial gráfico real del navegador.

El arnés de búsqueda del autor ejecutado por el revisor comprueba frases que cruzan etiquetas de énfasis, saltos de línea, offsets literales y la conservación de subrayados al limpiar marcas de búsqueda. Los tests del renderizador cubren enlaces, referencias entre fragmentos, notas al pie y tablas, entre otros bloques Markdown. No se detectaron otros defectos materiales en la revisión independiente del lector.

## Liturgia

Se ejecuta `scripts/liturgy.js` con un reloj fijado a `2026-11-05T23:30:00Z`. Madrid debe mostrar el 6 de noviembre a las 00:30 y Canarias el 5 a las 23:30. Una comprobación en julio cubre los desfases de verano. Se verifica que cambiar de zona persiste la elección y que «Hoy» emplea esa zona.

La versión final lee los textos dentro de Atlas. Las pruebas antiguas de un formulario POST externo se reemplazaron por recorridos de carga y selección; no se conservaron como pruebas supuestamente válidas de una interfaz que ya no existe.

El arnés carga el manifiesto, el día y sus objetos mediante el runtime real, con un adaptador de almacenamiento compartido. Cambia de laudes a vísperas, cambia la fecha civil y abre el ordinario del Misal. Se comprueba que los textos comunes no se asignan automáticamente al día. Otro caso presenta una celebración que no coincide con la referencia española y exige el aviso visible de discrepancia, así como el aviso de propios ausentes sin sustituirlos ni escoger un prefacio.

La prueba de descarga pulsa «Guardar este día y el Misal sin conexión», crea otra instancia del runtime sin red y comprueba que abre las horas guardadas y el Misal. Una instancia offline sin datos muestra el error y el control de reintento. Los eventos de conexión actualizan el estado. Una fecha confirmada por el proveedor distinta de la solicitada se rechaza; tras corregir el dato y pulsar «Volver a intentar», el texto se carga. Abandonar la pantalla mientras un objeto sigue pendiente no sobrescribe la nueva ruta.

Si el adaptador no confirma que los datos han quedado guardados, la pantalla informa de que no se completó la descarga y no anuncia éxito. Los enlaces internos del Misal se interceptan para desplazarse dentro del texto, sin cambiar el hash que utiliza el router de Atlas.

El DOM de esta prueba solo interpreta el texto de fixtures sencillos; no pretende acreditar la sanitización HTML de un navegador. Se ejecutó además `node tools/update-liturgy.mjs --test` sobre los datos reales: 4 días del 5 al 8 de noviembre, 20 horas, 83 textos comunes, 117 referencias y 115 objetos únicos. El importador comprobó los hashes, la idempotencia del saneamiento y casos de etiquetas ejecutables, atributos de eventos y enlaces JavaScript. El informe está en `reports/liturgy-tests.json`.

## Ediciones y vigencia de la revisión

La suite del lector comprueba que abre el original por defecto y que solo ofrece traducciones con estado `reviewed`. Rechaza versiones con fragmentos o anclas alterados, conserva el acceso al original y no deja que una traducción pendiente reemplace otra ruta. El progreso y las notas se guardan por edición; los favoritos conservan la identidad del documento original. La consulta y el fragmento lógico se mantienen al alternar versiones. No se anuncia como castellano un original de idioma desconocido.

`sourceHash` identifica los bytes gzip exactos de la fuente. Una limpieza técnica también cambia ese hash: no hay una excepción automática que prolongue la revisión anterior. Se comprobó que el importador exige aprobación independiente para los hashes de fuente y destino finales. La validación pública invoca ahora el validador de ediciones y rechaza una traducción registrada cuyo hash de fuente no coincide con el corpus actual. Las cinco traducciones registradas pasan los contratos de anclas, fragmentos y evidencias de revisión. La revisión es editorial con IA, no revisión humana ni edición oficial.

El selector no calcula por sí mismo el hash gzip del original en el navegador. La vigencia de la relación fuente/traducción depende del manifiesto producido y de la validación obligatoria del build; una manipulación externa posterior al build no queda cubierta por ese control.

## Corpus editorial y procedencia

Se adaptó `tools/test-corpus-integrity.mjs` al cambio editorial autorizado. Comparar cada gzip final con el original sin transformar ya no era un criterio válido: ahora se exige una cadena comprobable desde el respaldo de reconciliación hasta la entrada del proceso editorial y desde esta hasta el payload final.

Las pruebas conservan la comprobación de todos los Markdown originales sin modificar. Verifican los bytes de los respaldos, las direcciones históricas de fragmentos y del índice, los hashes de cada bloque de metadatos extraído y los hashes de los fragmentos finales. El test adicional ejecuta `node tools/editorial-corpus.mjs --verify`: compara cada fragmento con la transformación autorizada de su copia original, sin volver a aplicar cambios al corpus. Esta ejecución completa pasó: 1.385 documentos, 1.311 payloads modificados, 11.528 fragmentos contrastados, 997 exportaciones Markdown y 1.313 respaldos.

La primera ejecución de la suite detectó el índice de búsqueda anterior a la limpieza: su digest seguía siendo `fa5600…`, mientras el catálogo ya declaraba `545dd1…`. No se eliminó esa comprobación. Después de regenerar el índice se repitió el contrato y pasó: `payloadDigest` coincide con `545dd160606357fac26115a290dcc2d97b9e3d790987b0b0e5a7511e35e8cd49`; la revisión de búsqueda es `98e773f770810eea10f2676de689fd4d1dac50fd5c2853b8dd9aa74a132c6eb8`. No se repitió el costoso verificador de los cuerpos, porque estos no cambiaron tras su comprobación completa. La auditoría léxica independiente del proceso editorial se documenta por separado en `docs/qa-editorial-corpus.md`.

## Límites pendientes de comprobar en navegador

No se verificaron tamaños de pantalla, ajuste tipográfico, foco tras interactuar, selección nativa de texto, posición real de scroll ni historial de navegación. La inspección de CSS no sustituye esas pruebas.

El arnés no simula cuotas agotadas, bloqueo de almacenamiento, evicción de cachés ni la terminación del proceso del Service Worker durante escrituras. El test de persistencia usa un adaptador de IndexedDB; no acredita una transacción IndexedDB real.

El precache de módulos y estilos locales sí está cubierto. Se corrigieron los CSS y módulos que faltaban. Los textos litúrgicos se almacenan a medida que se abren o se descargan con su control específico; instalar el shell no equivale a haber descargado todas las fechas. Las fuentes externas de Google no forman parte de esa copia offline.

Las revisiones de contenido y búsqueda forman parte de la clave de caché para evitar reutilizar documentos antiguos con la misma ruta. La prueba confirma el comportamiento local con revisiones diferentes; no constituye una prueba de despliegue ni de actualización de instalaciones existentes. La generación efectiva de los hashes pertenece a las comprobaciones del proceso de construcción del corpus.
