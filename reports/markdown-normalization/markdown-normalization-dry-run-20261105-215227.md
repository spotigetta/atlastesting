# Auditoría conservadora del corpus Markdown

- Fecha UTC: `2026-11-05T20:52:27.316763+00:00`
- Herramienta: `2.0.0`
- Modo: **dry-run**
- Archivos revisados: **1452**
- Tamaño: **790.77 MiB**
- Archivos con normalización automática propuesta: **0**
- Archivos señalados para revisión humana: **1127**
- Archivos que no superan validación automática: **0**

La simulación no modifica fuentes. Las incidencias editoriales ambiguas se informan, pero no se corrigen automáticamente.

## Cobertura

| Carpeta | Archivos | MiB | Propuesta automática | Revisión humana |
|---|---:|---:|---:|---:|
| 01_IA_Doctrina_Teologia_Moral | 198 | 65.00 | 0 | 195 |
| 02_IA_Derecho_Canonico | 100 | 14.06 | 0 | 97 |
| 03_IA_Historia_Iglesia_Padres | 194 | 88.99 | 0 | 191 |
| 04_IA_Liturgia | 116 | 73.21 | 0 | 113 |
| 05_IA_OrtodoxIA | 154 | 45.17 | 0 | 149 |
| 05_IA_OrtodoxIA_20 | 20 | 45.17 | 0 | 20 |
| 06_IA_CinePilot | 10 | 29.83 | 0 | 10 |
| 07_IA_BibliotecarIA | 21 | 0.79 | 0 | 4 |
| 08_IA_Los_Clásicos | 300 | 302.68 | 0 | 98 |
| 09_IA_San_JosemarIA | 22 | 8.08 | 0 | 5 |
| 10_IA_Preparador_de_Círculos | 38 | 35.64 | 0 | 22 |
| 11_IA_Vida_de_los_Santos | 265 | 35.01 | 0 | 211 |
| 12_IA_Meditacion_DiarIA | 14 | 47.14 | 0 | 12 |

## Cambios automáticos seguros propuestos

- Ninguno.

## Señales para revisión humana

- `bare_url_inside_prose`: 31210
- `html_entities`: 329
- `malformed_heading_candidate`: 205
- `markdown_link_invalid_target`: 206
- `markdown_link_malformed_candidate`: 48477
- `markdown_link_missing_local_target`: 29877
- `markdown_link_unusual_scheme`: 59
- `multiple_spaces_candidate`: 28591
- `possible_isolated_page_number`: 3747
- `possible_word_split_across_lines`: 13166
- `raw_html`: 620
- `repeated_carets`: 364
- `repeated_header_or_footer_candidate`: 33012
- `trailing_whitespace_preserved`: 2

## Archivos modificados o que se modificarían

La relación completa, hashes, muestras y validaciones está en el informe JSON asociado.

| Archivo | Cambios automáticos |
|---|---|
| — | Ninguno |

## Aplicación segura

Para aplicar este diagnóstico, use el JSON exacto como línea base:

```powershell
python tools/normalize_markdown_corpus.py --apply --baseline "RUTA_AL_INFORME.json"
```

La aplicación se detiene si un archivo cambió desde la auditoría, crea copia de seguridad antes de cada escritura y valida la invariancia semántica e idempotencia.
