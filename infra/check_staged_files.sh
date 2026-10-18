#!/usr/bin/env bash
# ==============================================================================
# Staged-Files Safety Check (U2U)
# Checks git staged files before commit for secrets, sensitive env files,
# and prohibited files containing personal data (e.g. sample_Photo.*).
# ==============================================================================
set -euo pipefail

echo "[*] Running U2U Staged-Files Safety Check..."

STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  echo "[OK] No files staged."
  exit 0
fi

FAILED=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Check 1: Sensitive .env files (except *.example)
  if [[ "$file" =~ \.env($|\.) ]] && [[ ! "$file" =~ \.example$ ]]; then
    echo "  [ERROR] Prohibited file staged: $file (never commit active .env files)"
    FAILED=1
  fi

  # Check 2: Service account and credential keys
  if [[ "$file" =~ (service-account.*\.json|-key\.json|\.pem|\.p12)$ ]]; then
    echo "  [ERROR] Prohibited credentials file staged: $file"
    FAILED=1
  fi

  # Check 3: Forbidden PII sample photo (sample_Photo.*)
  filename=$(basename "$file")
  if [[ "$filename" =~ ^[Ss]ample_[Pp]hoto\.[a-zA-Z0-9]+$ ]] || [[ "$filename" == sample_Photo.* ]]; then
    echo "  [ERROR] Prohibited file staged: $file (contains real personal data; forbidden from repository)"
    FAILED=1
  fi

done <<< "$STAGED_FILES"

if [ "$FAILED" -ne 0 ]; then
  echo "[!] Staged-files check FAILED. Please unstage prohibited files before committing."
  exit 1
fi

echo "[OK] Staged files passed safety checks cleanly."
exit 0
