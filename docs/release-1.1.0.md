# Atlas 1.1.0: alcance comprobado

## Biblioteca

Se revisaron los 1.385 documentos y sus 14.692 fragmentos. Se reformatearon 1.306 cuerpos Markdown: cambiaron 2.523 fragmentos. Se conservaron los índices de fragmento y los destinos del índice de capítulos. Los originales permanecen intactos; los respaldos y 997 exportaciones deduplicadas quedan en `reports/` local, fuera de la publicación.

Se corrigieron 939 fichas con evidencia del documento. Se extrajeron 1.256 bloques YAML del cuerpo de lectura, conservando el bloque original y su hash. Se identificaron 646 obras internas. El índice de búsqueda se reconstruyó para los 1.385 documentos. Permanecen 617 campos de autor y 567 idiomas sin declaración suficiente: no se inventaron.

La revisión independiente comparó el contenido léxico y las 118.345 entradas del índice. Los residuos ambiguos quedan registrados para revisión editorial; no se presenta el corpus como una edición crítica terminada.

## Ediciones en castellano

El lector permite elegir original o castellano cuando existe una edición revisada. Conserva por separado sus notas y posición. Hay cinco traducciones completas del texto fuente disponible: la Regla de san Agustín, De la disciplina cristiana, De la utilidad del ayuno y las páginas biográficas de Darwin Ramos y Clare Crockett. Estas dos últimas son páginas web completas, no libros comerciales completos.

Son traducciones propias revisadas por un segundo agente de IA, sin revisión humana; no son ediciones oficiales. Sus fuentes suman 98.435 caracteres. Se mantienen pendientes 599 textos únicos no castellanos o de idioma indeterminado, con 437.696.443 caracteres. La traducción íntegra de la biblioteca no está terminada. El inventario y las herramientas permiten continuar por obras, con control de procedencia y revisión antes de publicarlas.

## Recorridos

Preguntar explica que se elige una IA y se escribe en NotebookLM. El mapa temático enlaza documentos reales y distingue sus síntesis editoriales de las citas literales. Incluye doce temas y preguntas de descubrimiento vinculadas a las fuentes. Rezar muestra explícitamente la función de la IA.

## Liturgia

Se incorporaron textos reales de iBreviary del 5 al 8 de noviembre de 2026: veinte horas y 83 textos comunes del misal. La actualización diaria importa cuatro días. La descarga sin conexión se anuncia como completada solo después de comprobar el almacenamiento.

Se indica el calendario de España como referencia y la celebración efectivamente proporcionada por la fuente. El 6 de noviembre existe una discrepancia con el calendario español de la CEE y se advierte antes de leer. Los propios ausentes no se inventan. La fuente ofrece una hora intermedia, no tres formularios separados. Las fechas no contrastadas se identifican como tales.

## Verificación y límites

Pasaron las pruebas automatizadas del lector, las ediciones, el descubrimiento y la carga litúrgica, junto con la validación del build y la revisión completa del corpus. Los informes independientes están en `docs/qa-editorial-corpus.md`, `docs/qa-runtime-review.md` y `docs/qa-liturgy-integrated.md`.

No se pudo abrir el navegador automatizado: su host no estaba disponible. Quedan pendientes las comprobaciones visuales reales en móvil y escritorio, incluido el comportamiento físico del scroll. Las pruebas de contratos no sustituyen esa revisión.
