# Fuentes para la liturgia y el misal

Revisión: 5 de noviembre de 2026. Alcance: textos en castellano, rito romano, contrastados con la referencia de España cuando existe evidencia concreta. Tras la revisión inicial, el usuario confirmó expresamente los permisos de CEE, iBreviary y las fuentes seleccionadas para este proyecto empresarial. Esa autorización se registra en `data/liturgy/manifest.json`; no se presenta como una licencia abierta para terceros.

## Decisión de integración

Atlas incorpora textos reales, no páginas de menús, para el 5 al 8 de noviembre de 2026. Hay cinco oficios íntegros por fecha (Oficio, Laudes, Hora intermedia, Vísperas y Completas), las lecturas y los propios disponibles, y 83 textos comunes del Misal: ordinario, 70 prefacios y 12 plegarias eucarísticas. El proveedor no expone por separado Tercia, Sexta y Nona en esta interfaz: no se han inventado tres versiones a partir de la única Hora intermedia. El catálogo común es el publicado por iBreviary; no se afirma que sea el libro oficial español íntegro ni una edición concreta verificada.

El importador usa una sesión POST real, comprueba dos veces la fecha, elimina contenido ejecutable y deduplica por SHA-256. La interfaz carga los textos dentro de Atlas y verifica el hash antes de reconstruir el HTML mediante otra lista de elementos permitidos. La atribución CEE y la procedencia se conservan. Los textos ausentes no se componen ni se sustituyen con un propio supuesto.

## Enlaces comprobados de iBreviary

El 5 de noviembre de 2026 se comprobaron mediante HTTP las páginas siguientes y sus encabezados en español. Son páginas públicas del proveedor, no una API. El importador accede a sus páginas de texto bajo el permiso confirmado; los enlaces se conservan como evidencia de origen.

| Acceso | URL |
| --- | --- |
| Breviario | <https://www.ibreviary.com/m2/breviario.php?lang=es> |
| Oficio de lecturas | <https://www.ibreviary.com/m2/breviario.php?lang=es&s=ufficio_delle_letture> |
| Laudes | <https://www.ibreviary.com/m2/breviario.php?lang=es&s=lodi> |
| Hora intermedia | <https://www.ibreviary.com/m2/breviario.php?lang=es&s=ora_media> |
| Vísperas | <https://www.ibreviary.com/m2/breviario.php?lang=es&s=vespri> |
| Completas | <https://www.ibreviary.com/m2/breviario.php?lang=es&s=compieta> |
| Propios de la misa y lecturas | <https://www.ibreviary.com/m2/letture.php?lang=es> |
| Ordinario y otras secciones del Misal | <https://www.ibreviary.com/m2/messale.php?lang=es> |
| Seleccionar fecha e idioma | <https://www.ibreviary.com/m2/opzioni.php?lang=es> |

El menú web ofrece una sola entrada «Hora intermedia»; no se verificaron enlaces distintos para Tercia, Sexta y Nona. No convertir esos tres nombres en enlaces supuestamente distintos.

El menú de `letture.php` incluye antífona/colecta, lecturas, oración sobre las ofrendas, prefacio y comunión. El de `messale.php` ofrece ordinario, prefacio, plegaria eucarística y oración de los fieles. Conservar `lang=es` en cada acceso inicial: los enlaces internos pueden depender de la sesión del proveedor.

### Fecha: prueba que evita un enlace falso

Se pidió `breviario.php?lang=es&giorno=1&mese=1&anno=2026`; siguió mostrando «Jueves, 5 Noviembre 2026». Se probó lo mismo en `opzioni.php`, con el mismo resultado. Los parámetros GET de fecha no seleccionan el día.

El formulario real de `opzioni.php` usa `method="post"`, con los campos `lang`, `giorno`, `mese`, `anno` y `ok`. Una sesión HTTP temporal con este envío:

```text
POST https://www.ibreviary.com/m2/opzioni.php
lang=es&giorno=1&mese=1&anno=2026&ok=ok
```

mostró «Dia: Jueves, 1 Enero 2026». Al abrir el breviario conservando esa sesión apareció «Santa María, Madre de Dios». Esto verifica el selector del proveedor, no una API ni un enlace permanente. Un futuro formulario HTML dirigido a otra pestaña requeriría verificar las cookies en un navegador real. En esta entrega es más seguro abrir Opciones y explicar el paso.

Los [créditos oficiales de iBreviary](https://www.ibreviary.com/credits_en.html) atribuyen sus textos castellanos de Horas y Misal a la CEE. No identifican la edición ni garantizan el calendario propio completo de España. La prueba de 1 de enero dio el nombre esperado pero también `Tipo: Feriale - Tempo: Ordinario`; esa clasificación no se importa como dato correcto. El permiso específico para este proyecto procede de la confirmación del usuario, no de esos créditos.

## Fuente oficial de la CEE

La [presentación oficial de su aplicación](https://www.conferenciaepiscopal.es/la-aplicacion-para-rezar-la-liturgia-de-las-horas-se-podra-descargar-desde-manana/) explica que permite elegir fecha y oficio, destaca la Hora correspondiente y añade los propios del Misal, el Leccionario y el Martirologio. Es el acceso recomendado cuando se necesita la referencia oficial española.

- Android: <https://play.google.com/store/apps/details?id=es.conferencia.episcopal.liturgia>
- iOS: <https://apps.apple.com/es/app/liturgia-de-las-horas-cee/id1528941726>
- Portal oficial de liturgia: <https://www.conferenciaepiscopal.es/comisiones/liturgia/>

La CEE ofrece además [lecturas dominicales y festivas por ciclos](https://www.conferenciaepiscopal.es/liturgia-en-espanol/). Son enlaces a documentos concretos; no cubren todas las ferias ni todas las Horas. Ejemplos comprobados:

- I domingo de Adviento, ciclo A: <https://www.conferenciaepiscopal.es/liturgia/aa1.pdf>
- Navidad, misa de la vigilia, ciclo A: <https://www.conferenciaepiscopal.es/liturgia/anvigilia.pdf>
- Santa María, Madre de Dios: <https://www.conferenciaepiscopal.es/liturgia/amaterdei.pdf>

El [aviso legal de la CEE](https://www.conferenciaepiscopal.es/aviso-legal/), apartados 3.1-3.4, reserva los derechos y exige autorización expresa escrita para reutilizar o reproducir sus contenidos. La incorporación actual se apoya en el permiso específico confirmado por el usuario. No se han importado en masa otros documentos de la CEE ni se ha extendido ese permiso a usos ajenos al proyecto.

## ePrex: referencia observada y límites

Se revisaron el [sitio oficial actual](https://eprex.app/), su [descripción de la aplicación](https://eprex.app/app-oracion/) y la [composición visual oficial](https://backoffice.eprex.app/storage/v1/object/public/web/app-mockups.png). La imagen se abrió y examinó: muestra fecha desplegable, acceso al Evangelio, tarjeta de Horas con Laudes/Oficio/Vísperas/Completas y Tercia/Sexta/Nona, y un lector con rúbricas diferenciadas. Incluye también «Lorem ipsum» en una celebración; es un mockup, no una prueba del calendario real. La web anuncia selección de cualquier día, textos de la CEE y CELAM y uso sin conexión.

No se ejecutó la aplicación nativa: el navegador automatizable devolvió `The browser access host is unavailable`. La inspección visual fue de material publicado por el propio proveedor, no de una sesión funcional instalada. No afirmar que se ha probado el cálculo perpetuo ni la navegación real de la app.

Su [aviso legal](https://eprex.app/aviso-legal/), actualizado en noviembre de 2024, permite visualizar y realizar copias privadas para uso personal (§4), pero prohíbe distribuir, modificar o comunicar públicamente sus contenidos. También pide autorización escrita para enlazar su portal (§5). No se ha encontrado una licencia abierta de sus textos ni un endpoint público documentado. No copiar el corpus, no extraer su backend y no integrar enlaces ePrex como una prestación sin resolver esa condición con el titular. El contacto público del sitio permite plantear una colaboración, pero no se ha enviado ninguna solicitud.

## Calendario, zona horaria y precedencias

La [publicación oficial del calendario 2025-2026](https://www.conferenciaepiscopal.es/cee-calendario-liturgico-pastoral-2025-2026/) confirma ciclo A y año par. El [PDF actualizado el 23 de enero de 2026](https://www.conferenciaepiscopal.es/wp-content/uploads/2026/01/Calendario-Liturgico-CEE-2026.pdf) se consultó directamente: p. PDF 4 reserva reproducción/tratamiento informático; pp. 8-11 explican comienzo del día y concurrencias; pp. 13-14 contienen precedencias. Se examinó visualmente la p. PDF 11. Domingos y solemnidades comienzan la tarde anterior. Las Vísperas concurrentes siguen el rango y, en igualdad, las del día en curso. No cambiar todo el día automáticamente a una hora fija.

Casos oficiales comprobados: el 31 de octubre de 2026 por la tarde corresponde a primeras Vísperas de Todos los Santos; el domingo 1 de noviembre celebra esa solemnidad (p. PDF 339). El 5 de noviembre admite feria o Santa Ángela de la Cruz, pero Toledo tiene celebración propia (p. PDF 343). Esto impide confundir «español» con un calendario único sin variantes.

La CEE [confirma](https://www.conferenciaepiscopal.es/jornadas-y-colectas-2026/) el 6 de enero de 2026 como Epifanía y el 25 de marzo como Anunciación: no sustituir España por países que trasladan Epifanía al domingo. El [documento oficial de Navidad](https://www.conferenciaepiscopal.es/liturgia/anvigilia.pdf) distingue la misa vespertina del 24 de la misa del día 25.

Para Atlas, `Europe/Madrid` y `Atlantic/Canary` son decisiones técnicas de zona civil, no calendarios litúrgicos distintos ni una regla sobre Vísperas. Usar `Intl.DateTimeFormat` con zona explícita; no obtener «hoy» recortando una fecha UTC. Mantener cualquier Hora sugerida como recomendación editable. No derivar ciclo, salterio ni lecturas únicamente de la paridad del año civil.

## Actualización, pruebas y límites comprobados

Actualizar: `node tools/update-liturgy.mjs --days=4`. Fecha inicial explícita: `--date=2026-11-05`. Se admiten lotes de 1 a 14 días; no se afirma que ese sea un límite del proveedor. El lote probado es de cuatro días. `--skip-common` evita volver a descargar el catálogo común. No es una API perpetua ni se ha probado un año completo.

El POST fija `lang=es`, `giorno`, `mese`, `anno` y `ok`. Su cookie de sesión no se guarda en disco. Las páginas `messale.php?s=ordinario` y `s=preghiera_eucaristica` son menús: se siguen únicamente sus enlaces del mismo origen con ID numérico. Ejemplos reales: `messale.php?s=ordinario&id=4` y `messale.php?s=preghiera_eucaristica&id=31`. No se almacenan como oración las páginas que contienen solo enlaces.

Los objetos están en `data/liturgy/objects/{sha256}.json`; cada día guarda referencias a ellos en `data/liturgy/days/`. Son 117 referencias a 115 objetos únicos, unos 510 kB en total. Los informes `reports/liturgy-import.json` y `reports/liturgy-tests.json` registran importación y pruebas. El importador conserva la última fecha completa si una nueva descarga pierde alguna Hora, y conserva el catálogo común previo si su actualización falla.

Comando de pruebas: `node tools/update-liturgy.mjs --test`. Pasaron la comprobación de los hashes de todos los textos, la idempotencia del saneado, las cinco Horas por fecha y los casos de HTML malicioso. Se verificó que contienen entre 797 y 2.447 palabras por oficio en este lote; no son simples menús. El acceso visual automatizado no pudo comprobarse: el host del navegador sigue sin estar disponible.

Limitaciones reales del lote:

- El prefacio específico del día está vacío en las cuatro fechas. Se conserva esa ausencia y se ofrecen los prefacios comunes por separado, sin elegir uno automáticamente.
- El 6 de noviembre también faltan las oraciones de ofrendas y comunión. El proveedor muestra la feria; el calendario CEE prescribe la memoria de santos Pedro Poveda, Inocencio de la Inmaculada y compañeros. Se registra `calendarStatus: mismatch` y la interfaz lo advierte de forma visible antes del texto. No se presenta esa misa como el propio español correcto.
- El 8 de noviembre coincide el nombre de la celebración general con el calendario CEE (`matched`); no certifica los propios diocesanos ni toda la edición textual. Los días 5 y 7 quedan `unverified`, con la explicación correspondiente. Las fechas futuras no revisadas también quedan sin verificar: no se calculan ciclos ni precedencias.

El botón de lectura offline descarga realmente los objetos del día y los 83 textos comunes y comprueba cada entrada de IndexedDB antes de anunciar éxito. Sin almacenamiento disponible o ante un fallo, se informa de que la descarga no se completó. Abrir Atlas instalado no implica que todas las fechas estén guardadas: solo se pueden leer sin conexión las que se hayan almacenado en ese dispositivo.
