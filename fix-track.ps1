$ErrorActionPreference = 'Stop'
$p = 'c:\xampp\htdocs\proxyy2\src\routes\data\track.tsx'
$c = Get-Content -Path $p -Raw

# Replace "Brokeflex Data" with "BrokeFlex" (handles em-dash variants)
$new = $c -replace 'Brokeflex Data', 'BrokeFlex'
if ($new -ne $c) {
    Set-Content -Path $p -Value $new -NoNewline -Encoding utf8
    Write-Host 'track.tsx title updated.'
} else {
    Write-Host 'No Brokeflex Data found in track.tsx (already updated).'
}

