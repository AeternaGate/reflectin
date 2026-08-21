param(
  [Parameter(Mandatory = $true)][string]$Plan,
  [Parameter(Mandatory = $true)][int]$TaskNumber,
  [string]$OutDir = "D:\Bots\reflectin\.superpowers\sdd\briefs"
)
$plan = Get-Content -LiteralPath $Plan
$inTask = $false
$block = $false
$out = @()
foreach ($line in $plan) {
  if ($line -match '^```') { $block = -not $block; continue }
  if (-not $block -and $line -match '^#{1,6}[ \t]+Task[ \t]+\d+') {
    $inTask = ($line -match "^#{1,6}[ \t]+Task[ \t]+$TaskNumber([^0-9]|$)")
    if ($inTask) { $out += $line }
    continue
  }
  if ($inTask) { $out += $line }
}
if ($out.Count -eq 0) { Write-Error "Task $TaskNumber not found in $Plan"; exit 3 }
$file = Join-Path $OutDir "stage01-task$($TaskNumber)-brief.md"
Set-Content -LiteralPath $file -Value $out -Encoding UTF8
Write-Output "wrote $file : $($out.Count) lines"