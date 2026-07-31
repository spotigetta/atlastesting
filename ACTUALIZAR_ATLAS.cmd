@echo off
cd /d "%~dp0"
call npm.cmd run test
if errorlevel 1 (
  echo.
  echo Las pruebas han detectado un problema. No se ha preparado la version.
  pause
  exit /b 1
)
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo No se pudo preparar la version estatica.
  pause
  exit /b 1
)
echo.
echo Atlas se ha preparado correctamente en la carpeta dist.
echo No se ha subido ni publicado ningun archivo.
pause
