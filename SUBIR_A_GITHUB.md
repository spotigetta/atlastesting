# Subir Atlas a GitHub

La carpeta está preparada. La IA no ha subido ni publicado nada.

## 1. Comprobar

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run qa:browser
```

## 2. Crear un repositorio vacío

Crea en GitHub un repositorio sin README, licencia ni `.gitignore` automáticos.

## 3. Subir

No uses el cargador web, porque limita la cantidad de archivos. Usa GitHub Desktop o:

```powershell
git add -A
git commit -m "Preparar Atlas para GitHub Pages"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

Si `origin` existe:

```powershell
git remote set-url origin URL_DEL_REPOSITORIO
git push -u origin main
```

Ningún archivo individual preparado supera 100 MB.
La carpeta `dist/` no se sube desde la rama principal: GitHub Actions la
reconstruye y publica en `gh-pages`.

## 4. Activar Pages una sola vez

1. Abre **Settings → Pages**.
2. Selecciona `gh-pages` cuando el primer workflow la cree.
3. Elige la raíz `/`.
4. Guarda.

También puedes iniciar **Construir y publicar Atlas** desde **Actions → Run workflow**.

## 5. Comprobar

- Abre la URL de Pages.
- Comprueba Inicio, Explorar, Descubrir y un documento.
- Instala la PWA.
- Pulsa «Actualizar Atlas».

## Actualizaciones

```powershell
git add -A
git commit -m "Actualizar Atlas"
git push
```

Actions reconstruirá `gh-pages`.
