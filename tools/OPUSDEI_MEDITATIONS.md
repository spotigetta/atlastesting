# Importación autorizada de meditaciones del Opus Dei

Atlas guarda cada meditación como un Markdown independiente en:

`content/opusdei-meditations/AAAA/AAAA-MM-DD_titulo.md`

Cada archivo incluye YAML con título, fecha, URL oficial, idioma, categorías, referencias evangélicas, autorización y checksum. El cuerpo conserva el texto íntegro y termina con el enlace oficial.

## Acceso técnico

`opusdei.org` protege estas rutas con Cloudflare. Para que GitHub Actions pueda descargarlas sin simular un navegador, configure una de estas opciones:

1. Un **Cloudflare Access Service Token** con acceso de lectura a `/es/meditation/*`:
   - `OPUSDEI_CF_ACCESS_CLIENT_ID`
   - `OPUSDEI_CF_ACCESS_CLIENT_SECRET`
2. Un endpoint editorial autorizado y estable en `OPUSDEI_SOURCE_BASE`, con token opcional `OPUSDEI_API_TOKEN`.
3. Una regla de Cloudflare que omita el desafío interactivo para el endpoint editorial autenticado.

Guarde las credenciales exclusivamente en **GitHub → Settings → Secrets and variables → Actions**. Nunca se incorporan al JavaScript público ni al repositorio.

## Uso

- Día de hoy: `npm run update:opusdei-meditation`
- Histórico hasta hoy: `npm run backfill:opusdei-meditations`
- Año: `node tools/update-opusdei-meditations.mjs --year 2026 --strict`
- Rango: `node tools/update-opusdei-meditations.mjs --from 2025-11-30 --to 2026-08-15 --strict`

El workflow nocturno descarga el día correspondiente a Madrid. Desde **Actions → Actualizar contenido diario → Run workflow** se puede activar `opusdei_backfill` para importar el histórico. Si falla una descarga, conserva el último Markdown válido y registra el error.
