# Plan de reversión

## Antes de subir

El commit anterior permanece en el historial local. No se ha modificado ningún remoto.

## Después de subir

1. Identifica el commit estable de `main`.
2. Crea una rama de reversión.
3. Revierte los commits problemáticos.
4. Ejecuta `npm test` y `npm run build`.
5. Fusiona y sube.
6. Actions reconstruirá `gh-pages`.

No edites `gh-pages` manualmente.

## Proveedores

Recupera la versión anterior del snapshot en `source/providers/snapshots`.

## Borrados

Antes de subir, recupera documentos desde `.atlas-trash`. Esta carpeta no se sube.
