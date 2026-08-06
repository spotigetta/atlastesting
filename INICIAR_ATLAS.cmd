@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-atlas.ps1" -Target app
if errorlevel 1 pause
