param([ValidateSet('', 'fitpoly-local://connect', 'fitpoly-local://connect/')][string]$LaunchUrl = '')
$ErrorActionPreference = 'Stop'
$connectorDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverFile = Join-Path $connectorDir 'server.mjs'
try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:43127/health' -TimeoutSec 2
    if ($health.product -eq 'fitpoly-local-experience' -and $health.version -ge 3) { exit 0 }
    if ($health.product -eq 'fitpoly-local-experience') {
        $listeners = Get-NetTCPConnection -LocalPort 43127 -State Listen -ErrorAction SilentlyContinue
        foreach ($listener in $listeners) {
            $connectorProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
            if ($connectorProcess.Name -eq 'node.exe' -and $connectorProcess.CommandLine -match [regex]::Escape($serverFile)) {
                Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
            }
        }
    }
} catch { }
$nodeBinary = Join-Path $connectorDir 'node.exe'
if (-not (Test-Path -LiteralPath $nodeBinary)) { $nodeBinary = (Get-Command node -ErrorAction Stop).Source }
Start-Process -FilePath $nodeBinary -ArgumentList @('"' + $serverFile + '"') -WorkingDirectory $connectorDir -WindowStyle Hidden
