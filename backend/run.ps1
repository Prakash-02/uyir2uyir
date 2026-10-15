# PowerShell task runner for backend (Windows equivalent of Makefile)
param (
    [Parameter(Position = 0)]
    [string]$Command = "test"
)

$ErrorActionPreference = "Stop"

$VenvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    $VenvPython = "python"
}

switch ($Command) {
    "lint" {
        Write-Host "==> Running ruff check..." -ForegroundColor Cyan
        & $VenvPython -m ruff check .
        Write-Host "==> Running ruff format --check..." -ForegroundColor Cyan
        & $VenvPython -m ruff format --check .
    }
    "test" {
        Write-Host "==> Running pytest..." -ForegroundColor Cyan
        & $VenvPython -m pytest
    }
    "dev" {
        Write-Host "==> Starting uvicorn dev server on port 8080..." -ForegroundColor Cyan
        & $VenvPython -m uvicorn app.main:app --reload --port 8080
    }
    "format" {
        Write-Host "==> Formatting code with ruff..." -ForegroundColor Cyan
        & $VenvPython -m ruff format .
        & $VenvPython -m ruff check --fix .
    }
    default {
        Write-Host "Unknown command '$Command'. Usage: .\run.ps1 [lint|test|dev|format]" -ForegroundColor Red
        exit 1
    }
}
