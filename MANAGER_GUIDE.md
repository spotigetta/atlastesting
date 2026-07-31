# Guía del Gestor de Atlas

## Abrir

```powershell
npm.cmd run manager
```

Después abre `http://127.0.0.1:8765/gestor/`.

El servidor no reconstruye Atlas al arrancar. Esto evita procesos prolongados o bloqueados.

## Estados

- **Cambios pendientes:** las fuentes difieren del último build.
- **Validado:** catálogo, lector e índice coinciden.
- **Salida dist lista:** existe una construcción pública.
- **Publicado:** solo puede producirse después de que el propietario suba el proyecto.

## Documentos

- Selecciona varios Markdown.
- Elige biblioteca, categoría, autor y año.
- El Gestor evita duplicados.
- Los archivos reciben numeración automática.
- «Renombrar» conserva el ID.
- «Papelera» mueve el documento a `.atlas-trash`.

## Bibliotecas

Una carpeta `NN_IA_Nombre` se detecta al construir. También puede crearse desde el formulario. Las eliminaciones pasan por la papelera.

## Proveedores

La pestaña Proveedores edita YouTube, música e Instagram. Guardar modifica la configuración local; no consulta ni publica.

«Consultar enlaces ahora» ejecuta adaptadores con timeout y conserva el último snapshot válido.

## Centro de publicación

- **Auditar:** compara de inmediato fuentes, catálogo y lector mediante
  metadatos.
- **Validar:** ejecuta controles sin reconstruir.
- **Preparar dist:** construye y valida la salida pública.

Ningún botón realiza `git push` o publica.

El análisis de «Duplicados exactos» permanece en su pestaña propia porque
calcula hashes sobre todo el corpus y, por tanto, puede tardar más. No se ejecuta
al abrir el Gestor.

## Recuperación

Los elementos borrados están en `.atlas-trash`. Muévelos de nuevo a su biblioteca antes de construir.
