# Deploy script for U2U backend in demo mode on Google Cloud Run (PowerShell version)
# Usage: .\infra\deploy_backend_demo.ps1 [PROJECT_ID] [REGION]

param (
    [Parameter(Position = 0)]
    [string]$ProjectId = "uyir2uyir-53929",

    [Parameter(Position = 1)]
    [string]$Region = "asia-south1"
)

$ErrorActionPreference = "Stop"

$ServiceName = "u2u-api-demo"
$SaApi = "sa-api-demo@${ProjectId}.iam.gserviceaccount.com"
$SaScheduler = "sa-scheduler@${ProjectId}.iam.gserviceaccount.com"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "==> Deploying U2U Backend Demo to Cloud Run (PowerShell)" -ForegroundColor Cyan
Write-Host "    Project:  $ProjectId" -ForegroundColor Yellow
Write-Host "    Region:   $Region" -ForegroundColor Yellow
Write-Host "    Service:  $ServiceName" -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Cyan

# Pre-flight checks
if (-not (Test-Path "infra/env.demo.yaml")) {
    Write-Host "❌ ERROR: infra/env.demo.yaml not found. Please create it before deploying." -ForegroundColor Red
    exit 1
}

$envYaml = Get-Content "infra/env.demo.yaml" -Raw
if ($envYaml -match "YOUR_GEMINI_MODEL_HERE") {
    Write-Host "❌ ERROR: Please edit infra/env.demo.yaml and set GEMINI_MODEL (e.g. gemini-2.5-flash) before deploying." -ForegroundColor Red
    exit 1
}

# Step 1: Set GCP active project
Write-Host "==> [1/7] Setting gcloud active project to $ProjectId..." -ForegroundColor Cyan
& gcloud config set project $ProjectId

# Step 2: Enable required GCP services
Write-Host "==> [2/7] Enabling required GCP APIs..." -ForegroundColor Cyan
& gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    firestore.googleapis.com `
    aiplatform.googleapis.com `
    secretmanager.googleapis.com `
    cloudscheduler.googleapis.com `
    iam.googleapis.com

# Step 3: Configure Cloud Build permissions
Write-Host "==> [3/7] Configuring Cloud Build permissions on default compute service account..." -ForegroundColor Cyan
$ProjectNumber = (& gcloud projects describe $ProjectId --format='value(projectNumber)').Trim()
$ComputeSa = "${ProjectNumber}-compute@developer.gserviceaccount.com"
Write-Host "    Project Number: $ProjectNumber"
Write-Host "    Granting roles/run.builder to $ComputeSa..."
& gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ComputeSa" `
    --role="roles/run.builder" `
    --condition=None

# Step 4: Configure runtime service account sa-api-demo
Write-Host "==> [4/7] Configuring runtime service account sa-api-demo..." -ForegroundColor Cyan
$saExists = $false
try {
    $null = & gcloud iam service-accounts describe $SaApi 2>&1
    if ($LASTEXITCODE -eq 0) { $saExists = $true }
} catch {
    $saExists = $false
}

if (-not $saExists) {
    Write-Host "    Creating service account $SaApi..."
    & gcloud iam service-accounts create sa-api-demo `
        --display-name="U2U Cloud Run Demo API Service Account"
} else {
    Write-Host "    Service account $SaApi already exists."
}

Write-Host "    Granting roles/aiplatform.user..."
& gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$SaApi" `
    --role="roles/aiplatform.user" `
    --condition=None

Write-Host "    Granting roles/logging.logWriter..."
& gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$SaApi" `
    --role="roles/logging.logWriter" `
    --condition=None

Write-Host "    Granting roles/firebaseauth.admin..."
& gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$SaApi" `
    --role="roles/firebaseauth.admin" `
    --condition=None

Write-Host "    Granting roles/datastore.user..."
& gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$SaApi" `
    --role="roles/datastore.user" `
    --condition=None

# Step 5: Manage Secret Manager secrets
Write-Host "==> [5/7] Managing secrets in Secret Manager..." -ForegroundColor Cyan
$secretNames = @("LINK_SIGNING_KEY", "PHONE_KEY", "INTERNAL_TOKEN")
foreach ($sec in $secretNames) {
    $secExists = $false
    try {
        $null = & gcloud secrets describe $sec 2>&1
        if ($LASTEXITCODE -eq 0) { $secExists = $true }
    } catch {
        $secExists = $false
    }

    if (-not $secExists) {
        Write-Host "    Creating secret $sec with random key..."
        $bytes = New-Object byte[] 32
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $randHex = -join ($bytes | ForEach-Object { "{0:x2}" -f $_ })
        $randHex | & gcloud secrets create $sec --data-file=- --replication-policy=automatic
    } else {
        Write-Host "    Secret $sec already exists."
    }

    Write-Host "    Granting secretAccessor on $sec to $SaApi..."
    & gcloud secrets add-iam-policy-binding $sec `
        --member="serviceAccount:$SaApi" `
        --role="roles/secretmanager.secretAccessor"
}

# Step 6: Deploy Cloud Run service
Write-Host "==> [6/7] Deploying Cloud Run service $ServiceName..." -ForegroundColor Cyan

$secretsList = [System.Collections.Generic.List[string]]@("LINK_SIGNING_KEY=LINK_SIGNING_KEY:latest", "PHONE_KEY=PHONE_KEY:latest", "INTERNAL_TOKEN=INTERNAL_TOKEN:latest")
foreach ($optSec in @("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "CALL_ALLOWLIST")) {
    $secExists = $false
    try {
        $null = & gcloud secrets describe $optSec --project=$ProjectId 2>&1
        if ($LASTEXITCODE -eq 0) { $secExists = $true }
    } catch {
        $secExists = $false
    }
    if ($secExists) {
        $secretsList.Add("${optSec}=${optSec}:latest")
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & gcloud secrets add-iam-policy-binding $optSec `
            --project=$ProjectId `
            --member="serviceAccount:$SaApi" `
            --role="roles/secretmanager.secretAccessor" `
            --quiet
        $ErrorActionPreference = $prevEap
    }
}
$secretsArg = "--set-secrets=" + ($secretsList -join ",")

& gcloud run deploy $ServiceName `
    --source backend `
    --region $Region `
    --service-account $SaApi `
    --allow-unauthenticated `
    --no-cpu-throttling `
    --max-instances 3 `
    --min-instances 1 `
    --timeout 300 `
    --env-vars-file infra/env.demo.yaml `
    $secretsArg `
    --quiet

$ServiceUrl = (& gcloud run services describe $ServiceName --region $Region --format 'value(status.url)').Trim()
Write-Host "    Service URL: $ServiceUrl" -ForegroundColor Green

# Step 7: Configure Cloud Scheduler
Write-Host "==> [7/7] Configuring Cloud Scheduler for 1-minute ticker..." -ForegroundColor Cyan
$schedSaExists = $false
try {
    $null = & gcloud iam service-accounts describe $SaScheduler 2>&1
    if ($LASTEXITCODE -eq 0) { $schedSaExists = $true }
} catch {
    $schedSaExists = $false
}

if (-not $schedSaExists) {
    Write-Host "    Creating service account $SaScheduler..."
    & gcloud iam service-accounts create sa-scheduler `
        --display-name="U2U Cloud Scheduler OIDC Service Account"
}

Write-Host "    Granting roles/run.invoker to sa-scheduler..."
& gcloud run services add-iam-policy-binding $ServiceName `
    --region $Region `
    --member="serviceAccount:$SaScheduler" `
    --role="roles/run.invoker"

$jobExists = $false
try {
    $null = & gcloud scheduler jobs describe u2u-tick-demo --location $Region 2>&1
    if ($LASTEXITCODE -eq 0) { $jobExists = $true }
} catch {
    $jobExists = $false
}

if ($jobExists) {
    Write-Host "    Updating existing Cloud Scheduler job u2u-tick-demo..."
    & gcloud scheduler jobs update http u2u-tick-demo `
        --location $Region `
        --schedule "* * * * *" `
        --uri "${ServiceUrl}/internal/tick" `
        --http-method POST `
        --oidc-service-account-email=$SaScheduler `
        --oidc-token-audience=$ServiceUrl
} else {
    Write-Host "    Creating Cloud Scheduler job u2u-tick-demo..."
    & gcloud scheduler jobs create http u2u-tick-demo `
        --location $Region `
        --schedule "* * * * *" `
        --uri "${ServiceUrl}/internal/tick" `
        --http-method POST `
        --oidc-service-account-email=$SaScheduler `
        --oidc-token-audience=$ServiceUrl
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "🎉 Deployment step complete!" -ForegroundColor Green
Write-Host "   Service URL: $ServiceUrl" -ForegroundColor Green

if ($envYaml -match "REPLACE_WITH_SERVICE_URL_AFTER_DEPLOY" -or -not ($envYaml -match [regex]::Escape($ServiceUrl))) {
    Write-Host ""
    Write-Host "👉 REQUIRED NEXT STEP (First Deployment):" -ForegroundColor Yellow
    Write-Host "   1. Open infra/env.demo.yaml"
    Write-Host "   2. Set PUBLIC_BASE_URL: `"$ServiceUrl`""
    Write-Host "   3. Redeploy once to apply the public service URL for OIDC audience verification:"
    Write-Host "      .\infra\deploy_backend_demo.ps1 $ProjectId $Region"
} else {
    Write-Host "   PUBLIC_BASE_URL: Configured and synchronized" -ForegroundColor Green
}

Write-Host ""
Write-Host "⚠️  CRITICAL BUDGET SAFETY REMINDER:" -ForegroundColor Red
Write-Host "   Please verify that a `$20 budget alert is configured in Google Cloud Billing:" -ForegroundColor Red
Write-Host "   https://console.cloud.google.com/billing/budgets" -ForegroundColor Red
Write-Host "=================================================================" -ForegroundColor Cyan
