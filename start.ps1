# POPOL 개발 서버 시작 스크립트
Write-Host "POPOL 서버를 시작합니다..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 백엔드 시작 (새 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; Write-Host 'Backend 서버 시작 중...' -ForegroundColor Green; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# 프론트엔드 시작 (새 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; Write-Host 'Frontend 서버 시작 중...' -ForegroundColor Blue; npm run dev" -WindowStyle Normal

Write-Host "두 서버가 시작되었습니다." -ForegroundColor Green
Write-Host "  백엔드: http://localhost:5000" -ForegroundColor Yellow
Write-Host "  프론트엔드: http://localhost:3000" -ForegroundColor Yellow
