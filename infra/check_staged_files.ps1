# ==============================================================================
# Staged-Files Safety Check (U2U)
# Checks git staged files before commit for secrets, sensitive env files,
# and prohibited files containing personal data (e.g. sample_Photo.*).
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "[*] Running U2U Staged-Files Safety Check..."

$stagedFiles = git diff --cached --name-only
if (-not $stagedFiles) {
    Write-Host "[OK] No files staged."
    exit 0
}

$failed = $false
foreach ($file in ($stagedFiles -split "`r?`n")) {
    $trimmed = $file.Trim()
    if (-not $trimmed) { continue }

    # Check 1: Sensitive .env files (except .env.example)
    if (($trimmed -match '\.env($|\.)') -and ($trimmed -ne ".env.example")) {
        Write-Host "  [ERROR] Prohibited file staged: $trimmed (never commit active .env files)" -ForegroundColor Red
        $failed = $true
    }

    # Check 2: Service account and credential keys
    if ($trimmed -match '(service-account.*\.json|-key\.json|\.pem|\.p12)$') {
        Write-Host "  [ERROR] Prohibited credentials file staged: $trimmed" -ForegroundColor Red
        $failed = $true
    }

    # Check 3: Forbidden PII sample photo (sample_Photo.*)
    $fileName = [System.IO.Path]::GetFileName($trimmed)
    if (($fileName -match '^[Ss]ample_[Pp]hoto\.[a-zA-Z0-9]+$') -or ($fileName -like "sample_Photo.*")) {
        Write-Host "  [ERROR] Prohibited file staged: $trimmed (contains real personal data; forbidden from repository)" -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    Write-Host "[!] Staged-files check FAILED. Please unstage prohibited files before committing." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Staged files passed safety checks cleanly." -ForegroundColor Green
exit 0
