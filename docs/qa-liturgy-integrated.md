# Revisión independiente de la liturgia integrada

Fecha: 5 de noviembre de 2026. Revisión de `tools/update-liturgy.mjs`, `scripts/liturgy.js`, `scripts/runtime.js`, `scripts/database.js`, el tratamiento del service worker y los datos locales de `data/liturgy`. No se han modificado archivos de producción ni se ha ejecutado una nueva importación del proveedor.

Resultado: no se han reproducido defectos bloqueantes en el lote local. Las pruebas de contratos no equivalen a una revisión visual ni a una certificación litúrgica de cada oración.

## Textos extraídos

El lote contiene las fechas 5 a 8 de noviembre de 2026. Cada fecha tiene las cinco Horas y lecturas de la misa. Hay 83 textos comunes del Misal; en total son 117 referencias a 115 objetos distintos. Se comprobaron todos los objetos, no solo una muestra: su hash SHA-256 coincide con la referencia, el saneado es idempotente y la longitud de texto almacenada coincide con la calculada.

El texto contenido en enlaces representa, como máximo, el 0,516 % del texto de un objeto. Esto contrasta con el umbral del 65 % con el que el importador rechaza menús. Se examinaron también el Ordinario de la Misa y las plegarias eucarísticas I y II: contienen las oraciones, no únicamente enlaces a ellas. El Ordinario tiene 17.252 caracteres de texto y las plegarias I y II, 4.406 y 2.029. La extracción del contenedor `inner` deja fuera el menú exterior en la prueba anidada.

Las ausencias se mantienen explícitas. No hay prefacio específico del día en ninguna de las cuatro fechas; el 6 tampoco hay oración sobre las ofrendas ni oración final de comunión. Los cuatro días tienen `complete: false`. La interfaz enumera lo que falta y ofrece los comunes por separado, sin elegirlos como sustitutos.

## Calendario español

La [publicación de la CEE](https://www.conferenciaepiscopal.es/cee-calendario-liturgico-pastoral-2025-2026/) identifica el calendario 2025-2026 como ciclo A y año par. Se cotejó la página PDF 344 —numeración impresa 342— del [calendario oficial](https://www.conferenciaepiscopal.es/wp-content/uploads/2026/01/Calendario-Liturgico-CEE-2026.pdf), mediante extracción de texto y renderizado local de la página completa. El 6 de noviembre prescribe una memoria obligatoria de los santos Pedro Poveda, Inocencio de la Inmaculada y compañeros, mártires; indica también oficio de la memoria y variantes locales.

El proveedor devuelve la feria del viernes de la semana XXXI. El manifiesto y el día integrado lo registran como `mismatch`. La interfaz muestra antes de la lectura «No corresponde al propio español de esta fecha», identifica la celebración del proveedor y explica qué falta. Cambiar la referencia del calendario a «proveedor» no elimina esa advertencia. No se presenta la feria importada como el propio español correcto del 6 de noviembre.

El estado `matched` del día 8 se limita a la celebración general; la interfaz exige comprobar los propios locales. Los días 5 y 7 permanecen `unverified`. No se deducen rangos, ciclos ni primeras vísperas a partir de la hora civil.

## Saneado y almacenamiento

El importador reconstruye únicamente etiquetas y atributos autorizados. En los objetos actuales no aparecen etiquetas ejecutables, atributos de eventos ni enlaces `javascript:`. Ocho entradas maliciosas adicionales cubrieron scripts, SVG, imágenes con eventos, atributos de eventos, entidades dentro de un esquema peligroso y comillas con `>`: no conservaron contenido ejecutable. Un atributo malformado deja texto residual inofensivo, pero no un atributo ejecutable. Esta comprobación no prueba la ausencia de toda variante futura de HTML malformado.

La interfaz aplica una segunda lista de etiquetas permitidas al copiar el HTML a un fragmento nuevo. No incorpora atributos del proveedor de forma indiscriminada. Comprueba el hash del objeto con Web Crypto cuando está disponible. La ejecución real del saneador DOM en un navegador no pudo revisarse porque el host del navegador está indisponible; las pruebas automatizadas usan contratos y objetos simulados.

«Guardar este día y el Misal sin conexión» solicita el manifiesto, el día, sus objetos disponibles y todos los comunes. Antes de confirmar cada descarga consulta la entrada correspondiente en IndexedDB. Si alguna confirmación falla, informa de una descarga incompleta; no promete haber guardado los textos ausentes del proveedor. La clave que consulta coincide con `AtlasRuntime.url(path)`. Se comprobó también el flujo de apertura en una instancia nueva sin red y el error al intentar abrir contenido nunca guardado.

El almacenamiento sigue sujeto a disponibilidad y borrado por el navegador. El lote descargado no permite prometer textos para fechas arbitrarias; la interfaz limita la selección al intervalo disponible y avisa cuando no hay datos.

## Pruebas y límites

`tools/test-liturgy.mjs` no existe. Se ejecutó `node --test tools/test-runtime-reliability.mjs`: 34 pruebas correctas, incluidas selección de fecha y Hora, discrepancia del calendario, guardado y reapertura sin red, rechazo de fecha del proveedor incorrecta y cancelación al abandonar la pantalla.

Se ejecutó también el `selfTest` del importador en memoria, suprimiendo exclusivamente su escritura de `reports/liturgy-tests.json` para respetar la revisión de solo lectura. Sus comprobaciones pasaron sobre las cuatro fechas y los 115 objetos. El resultado confirmó 20 Horas, 83 textos comunes y 117 referencias. Una comprobación independiente recorrió de nuevo los hashes, las longitudes, las etiquetas prohibidas y la proporción de texto enlazado.

No se ha probado la UI visual, una nueva sesión de red del importador ni un año litúrgico completo. Las comprobaciones sobre HTML y textos locales no certifican que iBreviary identifique la edición española del calendario. Esa limitación se conserva expresamente en los datos y en la interfaz.
