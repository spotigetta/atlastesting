# Arquitectura de Atlas 5

## Propósito

Atlas conserva la SPA/PWA y su diseño anterior, pero separa las fuentes editables, los artefactos derivados, el Gestor local y la publicación.

## Flujo general

```text
source/libraries + content + assets
                 │
                 ▼
           npm run build
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
 data temporal         validación
       │                   │
       └─────────┬─────────┘
                 ▼
               dist
                 │
     GitHub Actions después de la subida
                 │
                 ▼
             gh-pages
                 │
                 ▼
           GitHub Pages
```

## Capas

### Fuentes de verdad

- `source/libraries`: Markdown de las bibliotecas `NN_IA_*`.
- `content`: bibliotecas, preguntas, Shorts editoriales y proveedores.
- `source/providers/snapshots`: última respuesta válida de los proveedores.
- `assets`: recursos visuales e infografías.
- `package.json`: única versión de la aplicación.
- `source/id-registry.json`: identidad estable de los documentos.

### Construcción

`tools/build.mjs` coordina los generadores existentes sin modificar las vistas. Construye primero en una ubicación temporal, valida y reemplaza `dist` al final.

La salida no contiene el Gestor, `server.mjs`, fuentes Markdown, credenciales ni catálogos JavaScript duplicados.

### PWA pública

La PWA se inicia mediante `database.js`, `runtime.js`, `bootstrap.js`, los datos JSON y los módulos visuales anteriores.

Todas las rutas se resuelven desde `document.baseURI`. Por eso funcionan en localhost y en `https://usuario.github.io/repositorio/`.

### Lector

Cada documento se publica como JSON comprimido con gzip. El navegador lo descarga bajo demanda, lo descomprime y conserva una copia en Cache Storage e IndexedDB. No se precarga el corpus completo.

### Búsqueda

El índice invertido está dividido en 36 fragmentos según la primera letra normalizada. Una búsqueda solo descarga los fragmentos necesarios.

### Gestor

`gestor` y `server.mjs` son herramientas locales. El Gestor escribe exclusivamente en fuentes, valida, construye `dist`, gestiona proveedores y nunca realiza `push`.

### Contenidos externos

`tools/refresh-providers.mjs` mantiene snapshots de YouTube, música, noticias, lecturas, oración, frases de san Josemaría e Instagram cuando exista información válida.

Después de la subida, GitHub Actions ejecutará el actualizador cada seis horas o manualmente. Si un proveedor falla, conserva el snapshot anterior.

## Ramas previstas

- `main`: fuentes.
- `feature/*`: cambios futuros.
- `gh-pages`: salida generada automáticamente.

La IA no ha creado ramas remotas ni ha publicado el proyecto.

## Actualización

Cada build genera `build-manifest.json` con versión y hash. La aplicación consulta ese archivo sin caché cuando el usuario pulsa «Actualizar Atlas». El Service Worker muestra el aviso sin recargar en bucle.

## Seguridad

- No hay claves en el navegador.
- El Gestor escucha en `127.0.0.1`.
- Las rutas de escritura se validan dentro de `source/libraries`.
- Los borrados pasan por `.atlas-trash`.
- La salida se reemplaza de forma atómica.
- Los proveedores tienen timeout.
