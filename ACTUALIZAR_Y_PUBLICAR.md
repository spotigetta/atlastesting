# Actualizar y publicar Atlas

Este es el recorrido normal después de cambiar programación, documentos o contenidos desde el Gestor.

## 1. Guardar y comprobar en el ordenador

1. Guarda los archivos modificados.
2. Si has usado el Gestor, comprueba que cada formulario confirma **Guardado**. Sus cambios se escriben en las carpetas `content/` o `source/` del proyecto.
3. Abre `GESTOR_ATLAS.cmd` y entra en **Publicación**.
4. Pulsa **Preparar versión**. Atlas ejecuta pruebas y construye una copia local; no publica nada todavía.
5. Si aparece un error, corrígelo antes de continuar.

## 2. Crear el commit en GitHub Desktop

1. Abre **GitHub Desktop**.
2. En **Current repository**, selecciona el repositorio `atlas`.
3. Abre la pestaña **Changes** y revisa los archivos. Marca solo los que deban formar parte de la actualización.
4. Escribe un resumen breve en **Summary**, por ejemplo: `Mejorar Descubrir e Instagram`.
5. Opcionalmente añade detalles en **Description**.
6. Pulsa **Commit to main** (o **Commit to master**, según la rama que muestre GitHub Desktop).

El commit sigue estando únicamente en tu ordenador.

## 3. Subir la actualización

1. En GitHub Desktop pulsa **Push origin**.
2. Espera a que termine. No hace falta subir manualmente `dist/` ni tocar la rama `gh-pages`.

## 4. Comprobar la publicación en GitHub

1. Entra en el repositorio desde el navegador.
2. Pulsa la pestaña **Actions**.
3. Abre **Construir y publicar Atlas**.
4. Espera a que el proceso termine con un círculo verde.
5. Si aparece rojo, abre el trabajo fallido para ver el mensaje; la versión pública anterior seguirá disponible.
6. Abre la dirección pública de Atlas y fuerza una actualización con `Ctrl+F5`, o pulsa **Actualizar Atlas** dentro de la aplicación.

## Cambios automáticos de Internet

El workflow **Actualizar proveedores externos** se ejecuta cada seis horas. Actualiza los snapshots de YouTube, música, noticias, lecturas, oración y otros proveedores que respondan, y vuelve a publicar la PWA. El gesto de arrastrar hacia abajo en **Descubrir** y el botón **Actualizar Atlas** descargan la última publicación disponible; GitHub Pages no puede ejecutar scrapers directamente desde el navegador.

## Regla sencilla

`Modificar → Preparar versión → Commit to main → Push origin → Actions verde → Actualizar Atlas`
