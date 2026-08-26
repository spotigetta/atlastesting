# Atlas 6.4: arquitectura progresiva

## Propósito

Atlas sigue siendo la misma PWA documental, con el mismo catálogo, lectores, buscadores, cuadernos NotebookLM, feeds, herramientas y almacenamiento local. La versión 6.4 cambia la puerta de entrada y la jerarquía, no duplica ni sustituye los datos.

Principio de producto: **sencillo por fuera, enorme por dentro**.

## Navegación pública

- **Inicio:** uso cotidiano, búsqueda, Hoy, Continúa y cuatro intenciones.
- **Biblioteca:** corpus completo, Biblia y acceso a las bibliotecas.
- **Preguntar:** recomendador de cuadernos NotebookLM; no genera doctrina.
- **Rezar:** Meditación DiarIA, Evangelio, santos, escucha, examen, confesión y Misa.
- **Formarse:** rutas accesibles y, en un segundo nivel, herramientas de estudio.
- **Descubrir:** feed vivo, reducido a seis filtros principales y un menú Más.
- **Opus Dei:** recursos públicos y zona OD localmente bloqueada.
- **Mi Atlas:** actividad, datos locales, ajustes, notificaciones y desbloqueos.

En móvil se muestran cinco acciones: Inicio, Biblioteca, Preguntar, Rezar y Más. En escritorio aparecen los siete espacios y el avatar de Mi Atlas.

## Inventario y migración de rutas

| Función o ruta histórica | Ubicación principal 6.4 | Acceso contextual | Estado |
|---|---|---|---|
| `/` | Inicio | — | Vista reorganizada; ruta conservada |
| `/explore` | Formarse · Estudio avanzado | Biblioteca y Más | Conservada |
| `/infographics` | Preguntar · Especialistas | Tutoriales de cada IA | Conservada |
| `/library/*`, `/document/*`, `/reader/*`, `/author/*` | Biblioteca | Preguntar sobre la obra | Conservadas |
| `/bible`, `/bible/jerusalem` | Biblioteca · estantería bíblica | Lector y referencias | Conservadas |
| `/questions` | Preguntar / Biblioteca | Búsqueda global | Conservada |
| `/discover`, `/short/*` | Descubrir | Inicio y Opus Dei | Conservadas |
| `/youth` | Opus Dei | Rezar · Escuchar y Descubrir | Conservada |
| `/music` | Rezar · Escuchar | Descubrir · Música | Conservada |
| `/sources` | Descubrir | Estudio avanzado | Conservada |
| `/spiritual/*` | Rezar | Opus Dei cuando procede | Conservadas |
| `/examen/*` | Rezar | Mi Atlas y Opus Dei | Conservadas con puerta OD |
| `/salvation` | Formarse | Ruta destacada | Conservada |
| `/routes`, `/route/*` | Formarse · Aprender | Continúa | Conservadas |
| `/collections`, `/collection/*` | Biblioteca / Formarse | Búsqueda | Conservadas |
| `/timeline`, `/map`, `/graph`, `/compare` | Formarse · Estudiar | Bibliotecas concretas | Conservadas |
| `/saved`, `/updates`, `/notifications` | Mi Atlas | Cabecera y ajustes | Conservadas |

Las nuevas rutas (`/biblioteca`, `/preguntar`, `/rezar`, `/formarse`, `/opus-dei`, `/mi-atlas`, `/more`, `/descubre-atlas`) son capas de composición. Enlazan los módulos antiguos en vez de copiarlos.

## Datos y dependencias

La fuente principal sigue siendo `data/catalog.json`; cada documento mantiene un único identificador y una única ficha base. Las apariciones en Inicio, Formarse, Rezar o Descubrir son enlaces contextuales al mismo objeto.

Carga inicial:

1. catálogo y contenidos diarios pequeños;
2. módulos de interfaz;
3. primera pintura;
4. corpus secundarios pesados (santos por experiencias, examen, citas, cronologías y guías);
5. evento `atlas:data-ready` para actualizar únicamente las pantallas dependientes.

El service worker no incluye esos corpus pesados en el precache. Los guarda en la caché documental cuando se solicitan por primera vez.

## Desbloqueo OD

- Sin código: Preparador de Círculos oculto y examen general público.
- Código `OD`: se añade `preparadora-circulos` a `settings.unlockedFeatures` en `mercaba-atlas-v2`.
- Con desbloqueo: aparecen la biblioteca del Preparador y el examen específico completo existente.
- Volver a bloquear elimina solo la marca de desbloqueo; no borra notas, historial ni otros datos.

## Componentes nuevos

- `scripts/architecture.js`: composiciones de las ocho áreas y examen general.
- `styles/architecture-6.4.css`: sistema visual responsive superpuesto al existente.
- `assets/images/atlas-share-card.png`: tarjeta 1200 × 630 para WhatsApp/Open Graph.
- `#/descubre-atlas`: presentación compartible de seis escenas.

## Conservación y reversibilidad

No se ha eliminado ninguna ruta histórica ni módulo. `renderHome()` antiguo permanece en `app.js` durante esta fase aunque la ruta principal use la nueva composición. Esto permite comparar, recuperar una vista o migrar funciones pendientes sin pérdida.

## Validación mínima antes de publicar

1. Ejecutar `node --check` sobre todos los scripts.
2. Abrir Inicio y las ocho áreas nuevas a ancho móvil.
3. Comprobar búsqueda, una ficha, lector y Biblia.
4. Probar el código OD, abrir Preparador y examen completo, volver a bloquear.
5. Abrir Descubrir y verificar filtros, guardado y compartir.
6. Abrir `share/` y validar la miniatura 1200 × 630.
7. Comprobar instalación/actualización PWA y versión 6.4.0.
8. Ejecutar `node tools/build-share-pages.mjs` antes del commit de publicación.
