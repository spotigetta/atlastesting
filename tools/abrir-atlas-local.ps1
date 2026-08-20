param([int]$Port = 8766)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$address = "http://127.0.0.1:$Port/"
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $address | Out-Null } catch {
  Start-Process -FilePath 'node' -ArgumentList 'tools/local-server.mjs' -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Milliseconds 650
}
try { Start-Process $address } catch { Write-Host "Atlas ya está listo en: $address" }
