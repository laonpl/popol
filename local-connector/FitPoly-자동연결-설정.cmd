@echo off
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 pause
