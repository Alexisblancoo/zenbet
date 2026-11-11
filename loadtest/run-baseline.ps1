# Ejecuta el baseline completo contra el stack aislado de T1.
# Requiere: Docker Desktop, Node 20+, k6, y el .env del stack.
param(
    [string]$BaseUrl = 'http://localhost:15005',
    [switch]$SkipSeed,
    [switch]$SkipRead,
    [switch]$SkipDistinct,
    [switch]$SkipHot,
    [switch]$SkipCashout
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$k6 = (Get-Command k6 -ErrorAction SilentlyContinue).Source
if (-not $k6) { $k6 = 'C:\Program Files\k6\k6.exe' }
if (-not (Test-Path $k6)) { throw 'k6 no encontrado. Instala Grafana k6 o agrega k6 al PATH.' }

New-Item -ItemType Directory -Force 'loadtest/results' | Out-Null

if (-not $SkipSeed) {
    $env:BASE_URL = $BaseUrl
    node loadtest/seed.mjs
    if ($LASTEXITCODE -ne 0) { throw 'El seed falló.' }
}

function Start-ContainerMonitor([string]$name) {
    $out = Join-Path (Get-Location) "loadtest/results/$name-stats.csv"
    Set-Content -Path $out -Value 'timestamp,container,cpu,mem'
    $job = Start-Job -ScriptBlock {
        param($out)
        while ($true) {
            $ts = (Get-Date).ToString('o')
            docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}}' zenbet-t1-backend zenbet-t1-postgres |
                ForEach-Object { "$ts,$_" | Add-Content -Path $out }
            Start-Sleep -Seconds 2
        }
    } -ArgumentList $out
    return @{ Job = $job; File = $out }
}

function Invoke-Scenario([string]$name, [string]$script, [hashtable]$envVars) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    $monitor = Start-ContainerMonitor $name
    try {
        $k6Args = @('run', "--summary-export=loadtest/results/$name.json")
        foreach ($key in $envVars.Keys) { $k6Args += @('-e', "$key=$($envVars[$key])") }
        $k6Args += $script
        & $k6 @k6Args
        $code = $LASTEXITCODE
        Write-Host "k6 exit=$code (99 = threshold incumplido; el resumen queda guardado)."
    }
    finally {
        Stop-Job $monitor.Job -ErrorAction SilentlyContinue
        Remove-Job $monitor.Job -Force -ErrorAction SilentlyContinue
    }
}

if (-not $SkipRead) {
    Invoke-Scenario 'read-events' 'loadtest/scenarios/read-events.js' @{ BASE_URL = $BaseUrl; VUS = 50; DURATION = '60s'; SLEEP = 0.25 }
}
if (-not $SkipDistinct) {
    Invoke-Scenario 'bet-distinct' 'loadtest/scenarios/bet-distinct.js' @{ BASE_URL = $BaseUrl; VUS = 200; DURATION = '60s'; SLEEP = 0.25 }
}
if (-not $SkipHot) {
    Invoke-Scenario 'bet-hot-market' 'loadtest/scenarios/bet-hot-market.js' @{ BASE_URL = $BaseUrl; VUS = 200; DURATION = '30s'; SLEEP = 0.25 }
}
if (-not $SkipCashout) {
    Invoke-Scenario 'cashout' 'loadtest/scenarios/cashout.js' @{ BASE_URL = $BaseUrl; VUS = 200; MAX_DURATION = '90s' }
}

Write-Host "`n=== Resumen ===" -ForegroundColor Cyan
node loadtest/summarize.mjs loadtest/results
