#!/usr/bin/env bash
# Deploy Firestore security rules and composite indexes to u2u-demo database using Firebase CLI.
# Usage: ./infra/deploy_firestore_rules.sh <PROJECT_ID>

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <PROJECT_ID>"
  echo "Example: $0 my-gcp-project-id"
  exit 1
fi

PROJECT_ID="$1"

echo "================================================================="
echo "==> Deploying Firestore Rules & Indexes to u2u-demo"
echo "    Project:  ${PROJECT_ID}"
echo "    Database: u2u-demo"
echo "    Rules:    infra/firestore.demo.rules"
echo "    Indexes:  infra/firestore.indexes.json"
echo "================================================================="

# Ensure firebase CLI is available
if ! command -v firebase >/dev/null 2>&1; then
  echo "Error: Firebase CLI ('firebase') is not installed. Run 'npm install -g firebase-tools'."
  exit 1
fi

echo "==> Deploying firestore:rules and firestore:indexes via Firebase CLI..."
firebase deploy \
  --only firestore:rules,firestore:indexes \
  --project "${PROJECT_ID}"

echo "================================================================="
echo "✅ Firestore security rules and indexes successfully deployed to u2u-demo!"
echo "================================================================="
