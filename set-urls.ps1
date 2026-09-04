# Fills in your GitHub username (and optionally a different repo name) across the
# docs, privacy policy, listing copy and manifest.
#
#   .\set-urls.ps1 -User yourname
#   .\set-urls.ps1 -User yourname -Repo my-repo-name

param(
  [Parameter(Mandatory = $true)][string]$User,
  [string]$Repo = 'xtrachat'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

$targets = @(
  'docs\index.html',
  'docs\privacy.html',
  'PRIVACY.md',
  'STORE-LISTING.md',
  'README.md'
)

# UTF-8 without BOM: a BOM in manifest.json can break JSON parsing.
# Read explicitly as UTF-8 too — Get-Content -Raw on PowerShell 5.1 decodes
# BOM-less files as Windows-1252, and re-encoding that mangles every em dash
# and curly quote in the file.
$utf8 = New-Object System.Text.UTF8Encoding $false
function Load([string]$path) {
  return [System.IO.File]::ReadAllText($path, $utf8)
}
function Save([string]$path, [string]$text) {
  [System.IO.File]::WriteAllText($path, $text, $utf8)
}

$changed = 0
foreach ($rel in $targets) {
  $path = Join-Path $root $rel
  if (-not (Test-Path $path)) { continue }
  $text = Load $path
  $new = $text.Replace('YOUR-USERNAME', $User)
  if ($Repo -ne 'xtrachat') {
    $new = $new.Replace("$User/xtrachat", "$User/$Repo")
    $new = $new.Replace("github.io/xtrachat", "github.io/$Repo")
  }
  if ($new -ne $text) {
    Save $path $new
    "updated $rel"
    $changed++
  }
}

# homepage_url points at the GitHub Pages site. Edited as text rather than via
# ConvertTo-Json, which would reformat the entire manifest.
$manifestPath = Join-Path $root 'manifest.json'
$homepage = "https://$User.github.io/$Repo/"
$text = Load $manifestPath
$line = '  "homepage_url": "' + $homepage + '",'

if ($text -match '(?m)^\s*"homepage_url"') {
  $re = [regex]'(?m)^\s*"homepage_url"\s*:.*$'
  $text = $re.Replace($text, { $line }, 1)
} else {
  $re = [regex]'(?m)^\s*"version"\s*:.*$'
  $text = $re.Replace($text, { param($m) $m.Value + "`r`n" + $line }, 1)
}

# Fail loudly rather than writing a broken manifest.
try { $text | ConvertFrom-Json | Out-Null }
catch { throw "Refusing to write manifest.json - result was not valid JSON: $_" }

Save $manifestPath $text
"updated manifest.json (homepage_url = $homepage)"

""
"Pages site:     https://$User.github.io/$Repo/"
"Privacy policy: https://$User.github.io/$Repo/privacy.html"
"Support URL:    https://github.com/$User/$Repo/issues"
"($changed doc file(s) updated. Re-run build.ps1 afterwards.)"
