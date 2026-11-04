$ErrorActionPreference = 'Stop'
$expectedStart = Join-Path $env:LOCALAPPDATA 'FitPoly\local-experience\start.ps1'
$protocol = 'HKCU:\Software\Classes\fitpoly-local'
$commandKey = Get-Item -LiteralPath "$protocol\shell\open\command" -ErrorAction SilentlyContinue
$command = if ($commandKey) { $commandKey.GetValue('') } else { '' }
if ($command -and $command.Contains($expectedStart)) {
    # Remove only the fixed FitPoly protocol registration, never any filesystem tree.
    Remove-Item -LiteralPath "$protocol\shell\open\command" -Force
    Remove-Item -LiteralPath "$protocol\shell\open" -Force
    Remove-Item -LiteralPath "$protocol\shell" -Force
    Remove-Item -LiteralPath $protocol -Force
}
$run = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$entry = (Get-ItemProperty -LiteralPath $run -Name 'FitPolyLocalExperience' -ErrorAction SilentlyContinue).FitPolyLocalExperience
if ($entry -and $entry.Contains($expectedStart)) { Remove-ItemProperty -LiteralPath $run -Name 'FitPolyLocalExperience' }
Write-Output 'FitPoly automatic connection registration was removed. Installed files were retained.'
