# Despliegue preparado para GitHub Pages

## Automatización

Cuando el proyecto esté en GitHub:

- `ci.yml` valida ramas y pull requests;
- `deploy-pages.yml` construye `dist` y actualiza `gh-pages`;
- `refresh-providers.yml` actualiza snapshots cada seis horas y vuelve a publicar.

## No realizado

No se ha iniciado sesión, creado un repositorio remoto, creado ramas remotas, hecho commit o push, activado Pages ni desplegado.

## Modelo

```text
main → Actions → npm run build → dist → gh-pages → GitHub Pages
```

`gh-pages` es generada y no debe editarse.

## Ruta base

La PWA funciona en `https://USUARIO.github.io/REPOSITORIO/` sin escribir el nombre del repositorio en el código.

## Permisos

- CI: lectura.
- despliegue: escritura para `gh-pages`.
- proveedores: escritura de snapshots y `gh-pages`.

No hay tokens almacenados; Actions utiliza `GITHUB_TOKEN`.

## Fallos

La rama pública solo se sustituye tras build y validación. Si un proveedor falla, se conserva su snapshot. Si falla el build, no se despliega.
