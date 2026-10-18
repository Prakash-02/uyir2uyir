# ==============================================================================
# Deploy Frontend Guard & Builder (PowerShell)
# Enforces production HTTP mode and Cloud Run backend URL presence before deploy.
# Does NOT deploy directly (prints command for user execution).
# ==============================================================================
$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $RepoRoot "frontend"
$EnvFile = Join-Path $FrontendDir ".env.production.local"

Write-Host "[*] U2U Frontend Production Deploy Guard"
Write-Host "    Checking production configuration..."

# 1. Verify and load frontend/.env.production.local
if (-not (Test-Path $EnvFile)) {
    Write-Host "`n[ERROR] Missing $EnvFile" -ForegroundColor Red
    Write-Host "Please copy frontend/.env.production.example to frontend/.env.production.local" -ForegroundColor Yellow
    Write-Host "and fill in your real Cloud Run backend URL and Firebase configuration.`n" -ForegroundColor Yellow
    exit 1
}

# Parse env file
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $key, $val = $line -split "=", 2
        if ($key -and $val) {
            $keyTrimmed = $key.Trim()
            $valTrimmed = $val.Trim()
            [System.Environment]::SetEnvironmentVariable($keyTrimmed, $valTrimmed, "Process")
        }
    }
}

# 2. Validate essential production variables
$ApiMode = [System.Environment]::GetEnvironmentVariable("VITE_API_MODE", "Process")
$ApiBaseUrl = [System.Environment]::GetEnvironmentVariable("VITE_API_BASE_URL", "Process")

if ($ApiMode -ne "http") {
    Write-Host "[ERROR] VITE_API_MODE is '$ApiMode'. It MUST be set to 'http' for production deployment." -ForegroundColor Red
    exit 1
}

if (-not $ApiBaseUrl -or $ApiBaseUrl.Trim() -eq "") {
    Write-Host "[ERROR] VITE_API_BASE_URL is empty. It MUST contain the Cloud Run backend URL." -ForegroundColor Red
    exit 1
}

Write-Host "    [OK] VITE_API_MODE: $ApiMode" -ForegroundColor Green
Write-Host "    [OK] VITE_API_BASE_URL: $ApiBaseUrl" -ForegroundColor Green

# 3. Clean install and production build
Write-Host "`n[*] Running npm ci in frontend/..."
Push-Location $FrontendDir
try {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm ci failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "`n[*] Running npm run build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm run build failed." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

# 4. Check built bundle in frontend/dist/assets
Write-Host "`n[*] Inspecting production bundle in frontend/dist/assets..."
$DistAssets = Join-Path $FrontendDir "dist/assets"
if (-not (Test-Path $DistAssets)) {
    Write-Host "[ERROR] dist/assets directory not found after build." -ForegroundColor Red
    exit 1
}

$JsFiles = Get-ChildItem -Path $DistAssets -Filter "*.js"
if (-not $JsFiles) {
    Write-Host "[ERROR] No JavaScript bundles found in $DistAssets." -ForegroundColor Red
    exit 1
}

# Check if VITE_API_BASE_URL is baked into at least one JS bundle
$UrlFound = $false
foreach ($file in $JsFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    if ($content.Contains($ApiBaseUrl)) {
        $UrlFound = $true
        Write-Host "    [OK] Confirmed VITE_API_BASE_URL in $($file.Name)" -ForegroundColor Green
        break
    }
}

if (-not $UrlFound) {
    Write-Host "[ERROR] Bundle validation failed: VITE_API_BASE_URL ('$ApiBaseUrl') was not found in any built JS asset." -ForegroundColor Red
    Write-Host "The application would not connect to the real Cloud Run backend." -ForegroundColor Red
    exit 1
}

Write-Host "`n==============================================================================" -ForegroundColor Cyan
Write-Host "[SUCCESS] Production bundle built and verified cleanly for HTTP mode." -ForegroundColor Green
Write-Host "To deploy to Firebase Hosting, run the following command:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    firebase deploy --only hosting" -ForegroundColor Yellow
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
exit 0
