# Builds the single-file version of Lantern that is published as a claude.ai artifact.
#   dist\lantern.html          - the page to publish (fragment: the artifact host adds <html>/<head>/<body>)
#   dist\artifact-preview.html - the same page wrapped in a full document with a mock of claude.ai storage,
#                                for local testing only (never published)
# The local app (index.html) needs no build: it loads src\ directly.
# Usage (PowerShell):  & ".\build.ps1"
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding $false
function Read-Utf8([string]$rel) { [IO.File]::ReadAllText((Join-Path $root $rel), [Text.Encoding]::UTF8) }

$index = Read-Utf8 'index.html'
$block = [regex]::Match($index, '(?s)<!-- build:scripts.*?-->(.*?)<!-- /build:scripts -->').Groups[1].Value
$scripts = @([regex]::Matches($block, 'src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
if ($scripts.Count -eq 0) { throw 'No scripts found between the build markers in index.html' }

$css = Read-Utf8 'src\app.css'
$js = ($scripts | ForEach-Object { "/* ---- $_ ---- */`n" + (Read-Utf8 $_) }) -join "`n"

foreach ($bad in @('</script', '<!--')) {
  if ($js.IndexOf($bad, [StringComparison]::OrdinalIgnoreCase) -ge 0) { throw "The scripts contain '$bad', which would break an inline <script>." }
}
if ($css.IndexOf('</style', [StringComparison]::OrdinalIgnoreCase) -ge 0) { throw 'The stylesheet contains </style>.' }

$fonts = 'https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..700;1,400..700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap'
$page = "<title>Lantern</title>`n" +
  "<link rel=""preconnect"" href=""https://fonts.googleapis.com"">`n" +
  "<link rel=""preconnect"" href=""https://fonts.gstatic.com"" crossorigin>`n" +
  "<link rel=""stylesheet"" href=""$fonts"">`n" +
  "<style>`n" + $css + "`n</style>`n" +
  "<div id=""app""></div>`n" +
  "<script>`n" + $js + "`n</script>`n"

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$out = Join-Path $dist 'lantern.html'
[IO.File]::WriteAllText($out, $page, $utf8)

$mock = Read-Utf8 'dev\mock-claude.js'
$preview = "<!doctype html>`n<html lang=""en-GB"">`n<head>`n<meta charset=""utf-8"">`n" +
  "<meta name=""viewport"" content=""width=device-width, initial-scale=1, viewport-fit=cover"">`n</head>`n<body>`n" +
  "<script>`n" + $mock + "`n</script>`n" + $page + "</body>`n</html>`n"
[IO.File]::WriteAllText((Join-Path $dist 'artifact-preview.html'), $preview, $utf8)

'Built {0} ({1:N0} KB from {2} scripts)' -f $out, ((Get-Item $out).Length / 1KB), $scripts.Count
