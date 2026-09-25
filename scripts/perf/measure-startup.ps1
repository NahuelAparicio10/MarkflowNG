param(
    [int]$Runs = 3,
    [string]$Executable = "src-tauri/target/release/markflow.exe"
)

$ErrorActionPreference = "Stop"
$existing = Get-Process markflow -ErrorAction SilentlyContinue
if ($existing) {
    throw "Close every running Markflow instance before measuring startup."
}

$exe = (Resolve-Path $Executable).Path
$root = Join-Path $env:TEMP "markflow-startup-benchmark"
New-Item -ItemType Directory -Force $root | Out-Null
$document = Join-Path $root "startup benchmark ñ.md"
[IO.File]::WriteAllText($document, "# Startup benchmark`r`n`r`nNo edits.`r`n", [Text.UTF8Encoding]::new($false))
$before = (Get-FileHash $document -Algorithm SHA256).Hash
$results = @()

foreach ($mode in @("empty", "file")) {
    foreach ($run in 1..$Runs) {
        $metrics = Join-Path $root "$mode-$run.jsonl"
        Remove-Item $metrics -ErrorAction SilentlyContinue
        $env:MARKFLOW_STARTUP_METRICS_FILE = $metrics
        $process = if ($mode -eq "file") {
            Start-Process -FilePath $exe -ArgumentList ('"{0}"' -f $document) -PassThru
        } else {
            Start-Process -FilePath $exe -PassThru
        }
        $target = if ($mode -eq "file") { "startup-document-visible" } else { "first-paint" }
        $deadline = (Get-Date).AddSeconds(20)
        do {
            Start-Sleep -Milliseconds 50
            $marks = if (Test-Path $metrics) {
                Get-Content $metrics | ForEach-Object { $_ | ConvertFrom-Json }
            } else { @() }
            $found = $marks | Where-Object name -eq $target | Select-Object -Last 1
        } while (-not $found -and (Get-Date) -lt $deadline -and -not $process.HasExited)

        $backend = ($marks | Where-Object name -eq "backend-ready" | Select-Object -Last 1).milliseconds
        $results += [pscustomobject]@{
            Mode = $mode
            Run = $run
            BackendReadyMs = $backend
            WebviewTargetMs = $found.milliseconds
            ApproxProcessToTargetMs = if ($found) { [math]::Round($backend + $found.milliseconds, 1) } else { $null }
        }
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
        $process.WaitForExit()
        Start-Sleep -Milliseconds 300
    }
}

Remove-Item Env:MARKFLOW_STARTUP_METRICS_FILE -ErrorAction SilentlyContinue
$after = (Get-FileHash $document -Algorithm SHA256).Hash
$results | Format-Table -AutoSize
if ($before -ne $after) { throw "The associated startup document changed during the benchmark." }
Write-Host "Document SHA-256 preserved: $after"
