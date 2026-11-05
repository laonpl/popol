param([string]$InstallRoot = '', [switch]$NoRegistration, [switch]$NoStart)
$ErrorActionPreference = 'Stop'
$sourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $InstallRoot) { $InstallRoot = Join-Path $env:LOCALAPPDATA 'FitPoly\local-experience' }
$targetDir = [IO.Path]::GetFullPath($InstallRoot)
if (-not $NoRegistration -and $targetDir -ne [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'FitPoly\local-experience'))) {
    throw 'Automatic connection must use the per-user FitPoly installation directory.'
}
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
if ((Get-Item -LiteralPath $targetDir).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The installation directory cannot be a link.' }
foreach ($name in @('server.mjs', 'scanner.mjs', 'experienceSelection.mjs', 'experienceEvidence.mjs', 'experienceText.mjs', 'start.ps1', 'setup.ps1', 'remove-connection.ps1', 'README.md', 'node.exe', 'NODE-LICENSE.txt')) {
    $from = Join-Path $sourceDir $name
    $to = Join-Path $targetDir $name
    if ((Test-Path -LiteralPath $from) -and [IO.Path]::GetFullPath($from) -ne [IO.Path]::GetFullPath($to)) {
        if ((Test-Path -LiteralPath $to) -and (Get-FileHash -LiteralPath $from).Hash -eq (Get-FileHash -LiteralPath $to).Hash) { continue }
        Copy-Item -LiteralPath $from -Destination $to -Force
    }
}
$startFile = Join-Path $targetDir 'start.ps1'
if (-not (Test-Path -LiteralPath $startFile)) { throw 'FitPoly connection files are incomplete.' }
if (-not $NoRegistration) {
    $powershell = Join-Path $PSHOME 'powershell.exe'
    $baseCommand = '"' + $powershell + '" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $startFile + '"'
    $protocol = 'HKCU:\Software\Classes\fitpoly-local'
    New-Item -Path "$protocol\shell\open\command" -Force | Out-Null
    Set-Item -LiteralPath $protocol -Value 'URL:FitPoly Local Experience'
    New-ItemProperty -Path $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
    Set-Item -LiteralPath "$protocol\shell\open\command" -Value ($baseCommand + ' -LaunchUrl "%1"')
    $run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    New-Item -Path $run -Force | Out-Null
    New-ItemProperty -Path $run -Name 'FitPolyLocalExperience' -Value $baseCommand -PropertyType String -Force | Out-Null
}
if (-not $NoStart) { & $startFile }
Write-Output 'FitPoly connection is ready. Return to the website and click automatic search.'
