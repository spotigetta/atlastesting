# ADR-001: GitHub Pages como servidor público

## Estado

Aceptada.

## Decisión

GitHub Pages sirve `dist` desde `gh-pages`. Node se usa en construcción, Actions y Gestor local, nunca durante una visita.

## Consecuencias

- La PWA no escribe en el repositorio.
- Los proveedores se materializan como snapshots.
- Las rutas son relativas.
- El contenido grande se carga bajo demanda.
- El propietario controla la única subida inicial.
