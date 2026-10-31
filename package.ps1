$ErrorActionPreference = 'Stop'
$photoRoot = $PSScriptRoot
$photoExport = Join-Path (Split-Path $photoRoot -Parent) 'exports'
New-Item -ItemType Directory -Path $photoExport -Force | Out-Null
$photoNames = @('index.html', 'style.css', 'engine.js', 'app.js', 'icon.svg', '启动拾光.cmd', 'README.md', 'RUN_LOG.md')
$photoFiles = @($photoNames | ForEach-Object { Join-Path $photoRoot $_ })
$photoZip = Join-Path $photoExport '拾光修图-离线版.zip'
$photoExpected = @{}
foreach ($photoFile in $photoFiles) {
    $photoExpected[[System.IO.Path]::GetFileName($photoFile)] = (Get-FileHash -LiteralPath $photoFile -Algorithm SHA256).Hash
}
Compress-Archive -LiteralPath $photoFiles -DestinationPath $photoZip -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$photoArchive = [System.IO.Compression.ZipFile]::OpenRead($photoZip)
try {
    if ($photoArchive.Entries.Count -ne $photoNames.Count) { throw 'Archive entry count mismatch' }
    foreach ($photoEntry in $photoArchive.Entries) {
        $photoStream = $photoEntry.Open()
        $photoHasher = [System.Security.Cryptography.SHA256]::Create()
        try { $photoHash = [BitConverter]::ToString($photoHasher.ComputeHash($photoStream)).Replace('-', '') }
        finally { $photoStream.Dispose(); $photoHasher.Dispose() }
        if (-not $photoExpected.ContainsKey($photoEntry.FullName) -or $photoExpected[$photoEntry.FullName] -ne $photoHash) {
            throw "Archive hash mismatch: $($photoEntry.FullName)"
        }
    }
} finally { $photoArchive.Dispose() }
$photoZipHash = (Get-FileHash -LiteralPath $photoZip -Algorithm SHA256).Hash
$photoManifest = @('拾光修图离线版 · SHA256', '', "ZIP: $photoZipHash", '', '压缩包内各文件:')
foreach ($photoName in $photoNames) { $photoManifest += "$($photoExpected[$photoName])  $photoName" }
[System.IO.File]::WriteAllLines((Join-Path $photoExport '拾光修图-文件校验.txt'), $photoManifest, [System.Text.UTF8Encoding]::new($false))
$photoChecks = 0
foreach ($photoResult in @('result.json','edge-result.json','finishing-result.json')) {
    $photoReport = Get-Content -Raw -LiteralPath (Join-Path $photoRoot "verification/$photoResult") | ConvertFrom-Json
    if (-not $photoReport.passed) { throw "A verification suite failed: $photoResult" }
    $photoChecks += $photoReport.checks.Count
}
@{ zip = $photoZip; bytes = (Get-Item -LiteralPath $photoZip).Length; sha256 = $photoZipHash; filesVerified = $photoNames.Count; browserChecksPassed = $photoChecks } | ConvertTo-Json
