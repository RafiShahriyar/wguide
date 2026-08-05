$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$destDir = Join-Path $root "src-tauri\binaries"

function Find-Go {
    $candidates = @(
        (Get-Command go -ErrorAction SilentlyContinue).Source
        "$env:GOROOT\bin\go.exe"
        "$env:LOCALAPPDATA\Programs\Go\bin\go.exe"
        "C:\Program Files\Go\bin\go.exe"
        "C:\Go\bin\go.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
    return $candidates | Select-Object -First 1
}

function Find-Rustc {
    $candidates = @(
        (Get-Command rustc -ErrorAction SilentlyContinue).Source
        "$env:USERPROFILE\.cargo\bin\rustc.exe"
        "$env:CARGO_HOME\bin\rustc.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
    return $candidates | Select-Object -First 1
}

$go = Find-Go
if (-not $go) {
    throw "Go not found. Install Go (https://go.dev/dl) or add it to PATH."
}

$rustc = Find-Rustc
$hostTriple = if ($rustc) {
    & $rustc --print host-tuple 2>$null
}
if (-not $hostTriple) {
    $hostTriple = "x86_64-pc-windows-msvc"
}

$out = Join-Path $destDir "guideforge-backend-$hostTriple.exe"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir | Out-Null
}

Push-Location (Join-Path $root "backend")
try {
    & $go build -o $out ./cmd/server
    if ($LASTEXITCODE -ne 0) {
        throw "go build failed"
    }
} finally {
    Pop-Location
}

Write-Host "Built Go backend -> $out"