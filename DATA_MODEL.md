# Modelo de datos de Atlas

## Principios

- El Markdown es portable y recuperable.
- Los identificadores no cambian al renombrar desde el Gestor.
- Los JSON de `data` y `dist` son derivados.
- Cada dato externo conserva procedencia y fecha.
- El navegador carga únicamente los datos necesarios.

## Entidades

### Library

Definida en `content/libraries.json`. Campos esenciales: `id`, `folder`, `short`, `mark`, `tone`, `description` y `notebookUrl`.

### Document

Procede de un Markdown y su frontmatter. El catálogo añade `id`, `libraryId`, `file`, `title`, `category`, `author`, `year`, `status`, `words` y `contentFile`.

`source/id-registry.json` relaciona la ruta física con el ID. El Gestor actualiza esa relación al renombrar.

### DocumentChunk

Fragmento delimitado por encabezados o tamaño. Contiene índice, Markdown y entradas del esquema lateral.

### Author y Category

Agregados derivados del catálogo.

### Collection y Route

Relacionan documentos mediante IDs estables.

### Short

Campos mínimos: `id`, `type`, `libraryId` y `title`. Puede incluir `text`, `source`, `author`, `reference` y `sourceDocumentId`.

### ExternalProvider y ExternalItem

El proveedor es configuración editable. El elemento normalizado incluye ID, URL, tipo, título, autor, imagen, fecha, fuente y estado.

### BuildManifest

`dist/build-manifest.json` contiene versión, hash, fecha, ruta base y catálogo inicial.

## Repositorio interno

```js
Atlas.repository.libraries.list()
Atlas.repository.documents.list(filters)
Atlas.repository.documents.get(id)
Atlas.repository.documents.search(query, filters)
Atlas.repository.documents.searchText(query, filters)
Atlas.repository.shorts.sample(options)
Atlas.repository.providers.status()
Atlas.repository.maintenance.findDuplicates()
```

## Persistencia

- `localStorage`: preferencias, progreso, favoritos y anotaciones.
- IndexedDB: respuestas JSON y contenidos grandes.
- Cache Storage: shell, documentos e índices.

La versión 2 del almacenamiento incorpora pesos del mezclador sin perder datos anteriores.

## Esquemas

Los contratos están en `schemas`: biblioteca, documento, Short y proveedor.
