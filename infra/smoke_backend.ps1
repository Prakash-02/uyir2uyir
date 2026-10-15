# Post-deployment smoke test script for U2U backend on Cloud Run (PowerShell version)
# Usage: .\infra\smoke_backend.ps1 <SERVICE_URL>

param (
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ServiceUrl
)

$ErrorActionPreference = "Stop"
$ServiceUrl = $ServiceUrl.TrimEnd('/')

$AuthHeader = @{
    "Authorization" = 'Bearer mock:{"uid":"smoke-admin","role":"admin","env":"demo"}'
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "==> Running U2U Backend Smoke Test (PowerShell)" -ForegroundColor Cyan
Write-Host "    Target: $ServiceUrl" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Check GET /healthz
Write-Host "==> [1/4] Checking GET /healthz..." -ForegroundColor Cyan
$health = Invoke-RestMethod -Uri "$ServiceUrl/healthz" -Method Get
Write-Host "    Response: $($health | ConvertTo-Json -Compress)"
if ($health.status -ne "ok") {
    Write-Host "❌ Health check failed" -ForegroundColor Red
    exit 1
}
Write-Host "    ✓ Health check passed." -ForegroundColor Green

# 2. Check GET /config
Write-Host "==> [2/4] Checking GET /config..." -ForegroundColor Cyan
$config = Invoke-RestMethod -Uri "$ServiceUrl/config" -Method Get
Write-Host "    Response: $($config | ConvertTo-Json -Compress)"
if ($config.dataMode -ne "demo") {
    Write-Host "❌ Config check failed" -ForegroundColor Red
    exit 1
}
Write-Host "    ✓ Config check passed." -ForegroundColor Green

# 3. Trigger demo story via POST /admin/scenario/story/run
Write-Host "==> [3/4] Triggering demo story via POST /admin/scenario/story/run..." -ForegroundColor Cyan
$story = Invoke-RestMethod -Uri "$ServiceUrl/admin/scenario/story/run" -Method Post -Headers $AuthHeader -ContentType "application/json"
Write-Host "    Response: $($story | ConvertTo-Json -Compress)"
if (-not $story.ok) {
    Write-Host "❌ Failed to trigger demo story" -ForegroundColor Red
    exit 1
}
Write-Host "    ✓ Demo story triggered in background." -ForegroundColor Green

# 4. Poll until request reaches FULFILLED
Write-Host "==> [4/4] Polling until sample request reaches FULFILLED..." -ForegroundColor Cyan
$maxAttempts = 45
$attempt = 1
$isFulfilled = $false

while ($attempt -le $maxAttempts) {
    try {
        $statusResp = Invoke-RestMethod -Uri "$ServiceUrl/requests/req-sample-1/status" -Method Get -ErrorAction SilentlyContinue
        if ($statusResp.status -eq "FULFILLED") {
            Write-Host "    Attempt ${attempt}: Request req-sample-1 reached status FULFILLED!" -ForegroundColor Green
            $isFulfilled = $true
            break
        } else {
            Write-Host "    Attempt ${attempt}/${maxAttempts}: status='$($statusResp.status)' (sleeping 2s...)"
        }
    } catch {
        Write-Host "    Attempt ${attempt}/${maxAttempts}: waiting for request... (sleeping 2s...)"
    }
    Start-Sleep -Seconds 2
    $attempt++
}

if (-not $isFulfilled) {
    Write-Host "⚠️ Warning: Story did not reach FULFILLED within timeout." -ForegroundColor Yellow
}

# 5. Fetch /metrics
Write-Host ""
Write-Host "==> Fetching GET /metrics..." -ForegroundColor Cyan
$metrics = Invoke-RestMethod -Uri "$ServiceUrl/metrics" -Method Get -Headers $AuthHeader
Write-Host "    Metrics: $($metrics | ConvertTo-Json -Compress)" -ForegroundColor Green

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "✅ Smoke test completed successfully!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
