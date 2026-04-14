# POPOL 개발 서버 시작 스크립트
Write-Host "POPOL 서버를 시작합니다..." -ForegroundColor Cyan

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 백엔드 시작 (새 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; Write-Host 'Backend 서버 시작 중...' -ForegroundColor Green; npm run dev" -WindowStyle Normal

# 백엔드가 실제로 응답할 때까지 대기 (최대 30초)
Write-Host "백엔드 서버 준비 대기 중..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
$backendReady = $false
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            break
        }
    } catch { }
    Write-Host "  대기 중... ($waited/$maxWait 초)" -ForegroundColor DarkGray
}

if (-not $backendReady) {
    Write-Host "⚠️ 백엔드가 $maxWait 초 내에 시작되지 않았습니다. 로그를 확인하세요." -ForegroundColor Red
} else {
    Write-Host "✅ 백엔드 준비 완료!" -ForegroundColor Green
}

# 프론트엔드 시작 (새 창)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; Write-Host 'Frontend 서버 시작 중...' -ForegroundColor Blue; npm run dev" -WindowStyle Normal

Write-Host "두 서버가 시작되었습니다." -ForegroundColor Green
Write-Host "  백엔드: http://localhost:5000" -ForegroundColor Yellow
Write-Host "  프론트엔드: http://localhost:3000" -ForegroundColor Yellow
