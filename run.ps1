# Root PowerShell task runner forwarding to backend\run.ps1
param (
    [Parameter(Position = 0)]
    [string]$Command = "test"
)

$ErrorActionPreference = "Stop"
& (Join-Path $PSScriptRoot "backend\run.ps1") $Command
