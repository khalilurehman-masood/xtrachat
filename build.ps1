# Packages the extension for the Chrome Web Store.
# The ZIP must contain manifest.json at its ROOT, not inside a folder.

$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$stage = Join-Path $env:TEMP "xtrachat-build"
$outDir = Join-Path $src "dist"

$manifest = Get-Content (Join-Path $src 'manifest.json') -Raw | ConvertFrom-Json
$zip = Join-Path $outDir ("xtrachat-v{0}.zip" -f $manifest.version)

# Only these ship. Everything else (docs, build script, plans) stays out.
$include = @(
  'manifest.json',
  'background.js',
  'content.js',
  'styles.js',
  'offscreen.html',
  'offscreen.js',
  'popup.html',
  'popup.js',
  'welcome.html',
  'welcome.js'
)
$includeDirs = @('icons', 'vendor')

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($f in $include) {
  $p = Join-Path $src $f
  if (-not (Test-Path $p)) { throw "Missing required file: $f" }
  Copy-Item $p $stage
}

foreach ($d in $includeDirs) {
  $p = Join-Path $src $d
  if (-not (Test-Path $p)) { throw "Missing required directory: $d" }
  Copy-Item $p $stage -Recurse
}

# Store-listing artwork is not part of the package.
Remove-Item (Join-Path $stage 'icons\store-icon-128.png') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $stage 'icons\promo-440x280.png') -Force -ErrorAction SilentlyContinue

if (Test-Path $zip) { Remove-Item $zip -Force }

# NOT Compress-Archive: PowerShell 5.1 writes entry names with backslashes, which
# violates the ZIP spec (names must use "/") and can leave Chrome unable to
# resolve nested paths like icons/icon16.png. Build the archive by hand instead.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($_.FullName)
    try { $fileStream.CopyTo($entryStream) }
    finally { $fileStream.Dispose(); $entryStream.Dispose() }
  }
} finally {
  $archive.Dispose()
  $zipStream.Dispose()
}

Remove-Item $stage -Recurse -Force

$size = (Get-Item $zip).Length
"Packaged: $zip"
"Size:     {0:N0} KB" -f ($size / 1KB)
""
"Contents:"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
$archive.Entries | Sort-Object FullName | ForEach-Object { "  {0,-32} {1,9:N0} B" -f $_.FullName, $_.Length }
$archive.Dispose()
