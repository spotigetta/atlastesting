@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-atlas.ps1" -Target gestor
if errorlevel 1 pause
