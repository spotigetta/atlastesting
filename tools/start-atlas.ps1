param(
  [ValidateSet("app", "gestor")]
  [string]$Target = "app"
)

$ErrorActionPreference = "Stop"
$AtlasRoot = Split-Path -Parent $PSScriptRoot
$Port = 8765
$BaseUrl = "http://127.0.0.1:$Port"
$TargetUrl = if ($Target -eq "gestor") { "$BaseUrl/gestor/" } else { "$BaseUrl/" }

function Test-CurrentAtlas {
  try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 2
    return $health.ok -and [int]$health.managerApi -ge 3
  } catch { return $false }
}

if (-not (Test-CurrentAtlas)) {
  $looksLikeAtlas = $false
  try {
    $statusProbe = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/api/status" -TimeoutSec 2
    $looksLikeAtlas = $statusProbe.Content -match '"libraries"|"documents"|"version"'
  } catch {
    try { $looksLikeAtlas = (Invoke-WebRequest -UseBasicParsing -Uri $BaseUrl -TimeoutSec 2).Content -match '<title>Atlas' } catch {}
  }
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = [string]$process.CommandLine
    if ($looksLikeAtlas -and $process.Name -eq "node.exe" -and $commandLine.ToLowerInvariant().Contains("server.mjs")) {
      Stop-Process -Id $listener.OwningProcess -Force
      Start-Sleep -Milliseconds 350
    } else {
      throw "El puerto $Port lo usa otro programa. Cierralo y vuelve a abrir Atlas."
    }
  }

  $logDirectory = Join-Path $AtlasRoot "generated\launcher"
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
  Start-Process -FilePath "node" -ArgumentList "server.mjs" -WorkingDirectory $AtlasRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "atlas.log") -RedirectStandardError (Join-Path $logDirectory "atlas-error.log")
  $ready = $false
  for ($attempt = 0; $attempt -lt 24; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-CurrentAtlas) { $ready = $true; break }
  }
  if (-not $ready) { throw "Atlas no ha podido arrancar. Revisa generated\launcher\atlas-error.log." }
}

Start-Process $TargetUrl
