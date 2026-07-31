# ATLAS · Mercabá

Atlas es la PWA documental de las bibliotecas especializadas de Mercabá. La
versión pública es completamente estática y está preparada para alojarse en
GitHub Pages. El Gestor es una herramienta local: modifica las fuentes y prepara
la siguiente versión, pero nunca publica por sí mismo.

La interfaz visual, el lector, la búsqueda, las bibliotecas, Descubrir, las
infografías, los mapas, las estadísticas, la personalización y las animaciones
se conservan. La refactorización 5.0 cambia su arquitectura para que exista una
sola fuente de verdad y el resultado publicado pueda reconstruirse siempre.

## Modelo de trabajo

```text
source/libraries/              Markdown y carpetas NN_IA_*
source/providers/              configuración y snapshots externos
            │
            ▼
       npm run build
            │
            ▼
dist/                          PWA estática lista para GitHub Pages
```

- Añadir una carpeta `NN_IA_Nombre` crea una biblioteca.
- Añadir, editar o retirar un Markdown cambia el catálogo en el próximo build.
- Los documentos conservan identificadores estables mediante
  `source/id-registry.json`.
- Los contenidos externos se guardan como snapshots estáticos para que la PWA
  no dependa de un servidor Node.
- `dist/` es derivado: no se edita manualmente.

## Requisitos

- Node.js 22 o posterior.
- No hay dependencias npm de producción.

## Comandos

```powershell
npm install
npm run test
npm run validate
npm run build
npm run preview
```

`npm run preview` sirve `dist/` en `http://127.0.0.1:4173`. Para abrir el Gestor
local:

```powershell
npm run manager
```

Después se accede a `http://127.0.0.1:8765/gestor/`. También puede utilizarse
`ACTUALIZAR_ATLAS.cmd`, que ejecuta las pruebas y prepara `dist/`.

## Actualización de contenidos externos

```powershell
npm run refresh:external
npm run build
```

Los adaptadores conservan el último snapshot válido cuando un proveedor no
responde. En GitHub, los workflows incluidos pueden refrescar esos snapshots,
construir la aplicación y publicar el resultado en la rama `gh-pages`.

## Subida

Codex no autentica, no crea el repositorio remoto, no hace commit, no hace push
y no activa GitHub Pages. El proyecto queda preparado para que su propietario
realice esas operaciones siguiendo [SUBIR_A_GITHUB.md](SUBIR_A_GITHUB.md) y
[DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md).

## Documentación

- [Arquitectura](ARCHITECTURE.md)
- [Modelo de datos](DATA_MODEL.md)
- [Guía del Gestor](MANAGER_GUIDE.md)
- [Inventario de paridad](PARITY_INVENTORY.md)
- [Auditoría técnica](AUDIT_REPORT.md)
- [Despliegue en GitHub Pages](DEPLOY_GITHUB_PAGES.md)
- [Subida manual a GitHub](SUBIR_A_GITHUB.md)
- [Rollback](ROLLBACK.md)
- [Decisión arquitectónica](docs/decisions/ADR-001-static-pages.md)
- [Documentación funcional histórica](DOCUMENTACION_COMPLETA.md)

## Seguridad de publicación

Antes de subir una versión:

```powershell
npm run test
npm run build
npm run audit
```

El pipeline comprueba versiones, IDs, documentos, índice de búsqueda, rutas
relativas, archivos huérfanos y referencias incompatibles con GitHub Pages.
