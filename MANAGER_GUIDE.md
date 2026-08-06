# Guía del Gestor de Atlas

## Abrir

Haz doble clic en `GESTOR_ATLAS.cmd` o ejecuta `npm.cmd run manager` y abre `http://127.0.0.1:8765/gestor/`.

El acceso directo comprueba que el servidor pertenece a la versión actual. Si encuentra una instancia antigua de Atlas, la sustituye; así se evita el mensaje «Ruta API no encontrada».

## Documentos

- Usa **Encontrar documentos y palabras** para buscar por ficha o literalmente dentro de los Markdown.
- Selecciona hasta cien archivos Markdown a la vez.
- Elige biblioteca, categoría, autor y año.
- El Gestor evita duplicados y asigna numeración automática.
- Renombrar conserva el identificador; eliminar mueve el documento a `.atlas-trash`.

## Bibliotecas IA

Una carpeta `NN_IA_Nombre` se detecta al construir. El formulario también permite crear, editar, activar, desactivar o retirar una IA. Las eliminaciones pasan por la papelera.

## Shorts, frases y enlaces

Los formularios crean y retiran tarjetas sin editar JSON. En **Noticias y lecturas** basta con pegar una URL: Atlas detecta el tipo y recupera, cuando la web lo permite, título, descripción, autor e imagen. La vista previa se puede revisar antes de guardarla. Admite noticias, lecturas, oración, vídeos, música e Instagram.

## Examen diario

La pestaña **Examen diario** permite editar el catálogo general de normas, incorporar ayudas nuevas y mantener el inventario de fuentes. Una cita textual exige autor, obra y referencia; los consejos y preguntas quedan identificados como contenido editorial. La configuración y el histórico íntimo de los usuarios nunca aparecen en el Gestor porque solo existen en sus dispositivos.

## Proveedores

YouTube, música e Instagram aparecen como fichas interactivas. Puedes añadir, habilitar, deshabilitar o retirar canales. El JSON queda oculto en **Edición avanzada** para casos excepcionales.

**Consultar enlaces ahora** ejecuta los adaptadores con tiempo máximo y conserva el último snapshot válido. Instagram limita el acceso automático sin una sesión autenticada: Atlas mantiene una tarjeta por cada perfil configurado y añade publicaciones concretas detectadas por GitHub Actions o introducidas por URL.

## Publicación

La pestaña **Publicación** muestra el recorrido completo:

`Modificar → Preparar versión → Commit to main → Push origin → Actions verde → Actualizar Atlas`

**Preparar versión** construye y valida la salida, pero ningún botón del Gestor ejecuta `git push`. Consulta [ACTUALIZAR_Y_PUBLICAR.md](ACTUALIZAR_Y_PUBLICAR.md) para el detalle de clics en GitHub Desktop y GitHub.

## Recuperación

Los elementos borrados están en `.atlas-trash`. Muévelos de nuevo a su biblioteca antes de construir si deseas restaurarlos.
