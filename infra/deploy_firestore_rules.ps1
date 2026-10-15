# Deploy Firestore security rules and composite indexes to u2u-demo database using Firebase CLI.
# Usage: .\infra\deploy_firestore_rules.ps1 [PROJECT_ID]

param (
    [Parameter(Position = 0)]
    [string]$ProjectId = "uyir2uyir-53929"
)

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "==> Deploying Firestore Rules & Indexes to u2u-demo" -ForegroundColor Cyan
Write-Host "    Project:  $ProjectId" -ForegroundColor Yellow
Write-Host "    Database: u2u-demo" -ForegroundColor Yellow
Write-Host "    Rules:    infra/firestore.demo.rules"
Write-Host "    Indexes:  infra/firestore.indexes.json"
Write-Host "=================================================================" -ForegroundColor Cyan

# Check if firebase CLI is installed
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Firebase CLI ('firebase') is not found in PATH. Install via: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

Write-Host "==> Deploying firestore:rules and firestore:indexes via Firebase CLI..." -ForegroundColor Cyan
& firebase deploy --only firestore:rules,firestore:indexes --project $ProjectId

if ($LASTEXITCODE -eq 0) {
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "✅ Firestore security rules and indexes successfully deployed to u2u-demo!" -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
} else {
    Write-Host "❌ Firebase deploy failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
