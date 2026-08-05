param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$TauriArgs
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# Ensure the Rust and Go toolchains are resolvable even when this shell's
# PATH was captured before they were installed.
foreach ($dir in @(
    "$env:USERPROFILE\.cargo\bin",
    "$env:CARGO_HOME\bin",
    "C:\Program Files\Go\bin",
    "$env:GOROOT\bin",
    "$env:LOCALAPPDATA\Programs\Go\bin"
)) {
    if ($dir -and (Test-Path $dir) -and ($env:Path -notlike "*$dir*")) {
        $env:Path = "$dir;$env:Path"
    }
}

$tauriCli = Join-Path $root "node_modules\@tauri-apps\cli\tauri.js"
if (-not (Test-Path $tauriCli)) {
    throw "Tauri CLI not found. Run 'npm install' at the repo root first."
}

& node $tauriCli @TauriArgs
exit $LASTEXITCODE
