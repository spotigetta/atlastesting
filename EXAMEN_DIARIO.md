# Examen diario de Atlas

## Qué se ha implementado

- Acceso destacado desde Inicio, navegación de escritorio, navegación móvil, notificaciones y acceso rápido de la PWA.
- Examen de mediodía opcional y examen nocturno.
- Modos rápido y pausado sobre el mismo registro.
- Gestos: derecha **Sí**, izquierda **No**, arriba **Parcialmente**; **No aplica** permanece como botón inequívoco.
- Explicación visual de gestos la primera vez y tres pasos específicos dentro del tutorial general.
- Notas opcionales, notas marcadas para revisar y ayudas relacionadas con cada norma.
- Selección variada que recuerda localmente las ayudas recientes.
- Favoritos y apertura del documento original dentro del lector cuando existe una relación verificada.
- Catálogo base de 33 normas con frecuencia diaria, semanal, mensual, circunstancial o personal.
- Normas personales: creación, edición, pausa, orden, archivo y recuperación sin borrar el histórico.
- Día de guardia configurable.
- Vistas semanal y mensual sin puntuaciones.
- Preparación privada de una conversación de dirección espiritual o confidencia.
- Avisos configurables de mediodía, noche y segundo aviso opcional.
- Gestor visual para normas, ayudas manuales e inventario de fuentes.

## Modelo de privacidad

El catálogo y las ayudas forman parte de la aplicación pública. Estos datos personales permanecen en `localStorage` y no se envían a GitHub ni a ningún servidor:

1. Configuración del examen.
2. Modificaciones personales de las normas generales.
3. Normas creadas por el usuario.
4. Respuestas históricas.
5. Notas.
6. Ayudas favoritas y recientemente mostradas.
7. Borradores privados.

La exportación general de Atlas incluye estos datos solo cuando el usuario pulsa expresamente **Exportar**. La preparación para dirección espiritual no se comparte automáticamente.

## Biblioteca editorial

`data/examen.json` contiene actualmente:

- 33 normas.
- 1.013 ayudas.
- 947 citas textuales con autor y referencia.
- 66 preguntas o sugerencias identificadas como contenido editorial.
- Relaciones temáticas y relaciones con normas.
- Enlaces al lector documental cuando la coincidencia de obra es suficientemente clara.

Las fuentes editables están en `content/examen/`. El generador `generators/build-examen.mjs` vuelve a relacionarlas en cada construcción.

## Fuentes externas

Las páginas externas entregadas se registran como metadatos y enlaces en `content/examen/sources.json`. No se redistribuye automáticamente el contenido íntegro cuando no existe una licencia expresa. Los Markdown locales continúan siendo la fuente prioritaria.

## Limitaciones y asuntos pendientes

- Una PWA estática no puede garantizar avisos cuando el sistema ha cerrado completamente la aplicación. Para notificaciones remotas garantizadas haría falta un servicio push y consentimiento adicional.
- Quedan para una iteración posterior las acciones de **posponer** desde la propia notificación y **omitir solo hoy**; los horarios, días, segundo aviso y franja de descanso sí están disponibles.
- El examen de mediodía permite activar normas personales propias, pero todavía no incorpora un editor compacto específico para sustituir sus tres preguntas base.
- El calendario litúrgico todavía no dispone de un proveedor canónico incorporado; la alternativa Ángelus/Regina Caeli se deja configurable y no se deduce automáticamente.
- Las frecuencias diaria, por días, de guardia, tercer domingo, manual, fecha y rango están modeladas; faltan controles visuales dedicados para reglas anuales y temporadas litúrgicas.
- No se han descargado ni redistribuido EPUB externos sin comprobar primero su licencia y enlace directo autorizado.
- Las 116 relaciones automáticas iniciales con documentos del lector deben poder someterse a una revisión editorial progresiva desde el Gestor.
- Las cuadrículas semanal y mensual ya distinguen estados sin depender solo del color; aún faltan filtros avanzados, solemnidades y exportación selectiva de esas vistas.
- Los resúmenes descriptivos son deliberadamente prudentes y no realizan diagnósticos morales o espirituales.
