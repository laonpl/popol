$targets = @(
  "frontend\src\pages\Landing.jsx",
  "frontend\src\pages\experience\ExperienceHub.jsx",
  "frontend\src\pages\experience\ExperienceEditor.jsx",
  "frontend\src\pages\experience\AnalysisResult.jsx",
  "frontend\src\pages\portfolio\FreeformPortfolioEditor.jsx",
  "frontend\src\pages\portfolio\NotionPortfolioEditor.jsx",
  "frontend\src\pages\portfolio\NotionPortfolioPreview.jsx",
  "frontend\src\pages\portfolio\PdfPortfolioExport.jsx",
  "frontend\src\pages\portfolio\PortfolioEditor.jsx",
  "frontend\src\pages\portfolio\PortfolioHub.jsx",
  "frontend\src\pages\portfolio\PortfolioTemplateSelect.jsx",
  "frontend\src\pages\portfolio\PublicPortfolioView.jsx",
  "frontend\src\pages\portfolio\VisualPortfolioTemplates.jsx",
  "frontend\src\components\ChecklistModal.jsx",
  "frontend\src\components\DetailModal.jsx",
  "frontend\src\components\ExportModal.jsx",
  "frontend\src\components\ImportModal.jsx",
  "frontend\src\components\JobLinkInput.jsx",
  "frontend\src\components\KeyExperienceSlider.jsx",
  "frontend\src\components\KeywordTag.jsx",
  "frontend\src\components\Layout.jsx",
  "frontend\src\components\OnboardingOverlay.jsx",
  "frontend\src\components\YooptaMiniEditor.jsx",
  "frontend\src\components\YooptaPortfolioEditor.jsx"
)

# px -> target mapping (+2px each)
$map = @{}
$map[9] = 11
$map[10] = 12
$map[11] = 13
$map[12] = 14
$map[13] = 15
$map[14] = 16
$map[15] = 17
$map[16] = 18
$map[17] = 19
$map[18] = 20

$changed = 0
foreach ($rel in $targets) {
  $path = Join-Path $PWD $rel
  if (-not (Test-Path $path)) {
    Write-Host "SKIP (not found): $rel"
    continue
  }
  $c = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  $orig = $c

  # Pass 1: replace text-[Xpx] with unique placeholder ___FONTX___
  foreach ($px in ($map.Keys | Sort-Object)) {
    $c = $c.Replace("text-[$($px)px]", "___FONT${px}___")
  }

  # Pass 2: replace placeholder with text-[(X+2)px]
  foreach ($px in ($map.Keys | Sort-Object)) {
    $c = $c.Replace("___FONT${px}___", "text-[$($map[$px])px]")
  }

  if ($c -ne $orig) {
    [System.IO.File]::WriteAllText($path, $c, [System.Text.Encoding]::UTF8)
    $changed++
    Write-Host "OK: $(Split-Path $rel -Leaf)"
  } else {
    Write-Host "NO CHANGE: $(Split-Path $rel -Leaf)"
  }
}

Write-Host ""
Write-Host "완료: $changed 파일 업데이트"
