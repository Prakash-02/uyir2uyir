# infra/check_twilio_secrets.ps1
# Inspects Twilio secrets in Secret Manager and prints ONLY format checks.
# NEVER prints secret values or phone numbers.

$ErrorActionPreference = "Continue"

$secrets = @("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "CALL_ALLOWLIST")

Write-Host "`n=== Twilio Secret Manager Format Check ===" -ForegroundColor Cyan

foreach ($name in $secrets) {
    Write-Host "`nSecret: $name" -ForegroundColor Yellow

    # 1. Check if secret exists
    $describeOut = & gcloud secrets describe $name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Exists: False" -ForegroundColor Red
        continue
    }
    Write-Host "  Exists: True" -ForegroundColor Green

    # 2. Access latest version
    $output = & gcloud secrets versions access latest --secret=$name 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Accessible: False" -ForegroundColor Red
        continue
    }

    if ($output -is [array]) {
        $rawText = [string]::Join("`n", $output)
        $hasNewline = $true
    } else {
        $rawText = [string]$output
        $hasNewline = ($rawText.Contains("`n") -or $rawText.Contains("`r"))
    }

    $trimmed = $rawText.Trim()
    $len = $rawText.Length
    $hasSpace = ($rawText.Contains(" ") -or $rawText.Contains("`t"))

    # Byte-encoded check (e.g. lines with just 1-3 digits per line from byte arrays)
    $isByteEncoded = ($rawText -match "^\s*(\d{1,3}\s*)+$") -and $hasNewline

    Write-Host "  Length (chars): $len"
    Write-Host "  Has newline: $hasNewline"
    Write-Host "  Has whitespace: $hasSpace"
    Write-Host "  Looks byte-encoded: $isByteEncoded"

    if ($name -eq "TWILIO_ACCOUNT_SID") {
        $startsWithAC = $trimmed.StartsWith("AC")
        Write-Host "  Starts with 'AC': $startsWithAC"
        Write-Host "  Standard length (34): $(if ($trimmed.Length -eq 34) { 'True' } else { 'False' })"
    } elseif ($name -eq "TWILIO_AUTH_TOKEN") {
        Write-Host "  Standard length (32): $(if ($trimmed.Length -eq 32) { 'True' } else { 'False' })"
    } elseif ($name -eq "TWILIO_FROM_NUMBER") {
        $startsWithPlus = $trimmed.StartsWith("+")
        Write-Host "  Starts with '+': $startsWithPlus"
    } elseif ($name -eq "CALL_ALLOWLIST") {
        $parts = $trimmed.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_.Length -gt 0 }
        $count = $parts.Count
        $allStartWithPlus = ($count -gt 0)
        foreach ($p in $parts) {
            if (-not $p.StartsWith("+")) {
                $allStartWithPlus = $false
            }
        }
        Write-Host "  Allowlist count: $count"
        Write-Host "  All entries start with '+': $allStartWithPlus"
    }
}

Write-Host "`n=== Format Check Complete (Zero Secret Values Exposed) ===`n" -ForegroundColor Cyan
