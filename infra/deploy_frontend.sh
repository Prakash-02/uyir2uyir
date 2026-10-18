#!/usr/bin/env bash
# ==============================================================================
# Deploy Frontend Guard & Builder (Bash)
# Enforces production HTTP mode and Cloud Run backend URL presence before deploy.
# Does NOT deploy directly (prints command for user execution).
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
ENV_FILE="$FRONTEND_DIR/.env.production.local"

echo "[*] U2U Frontend Production Deploy Guard"
echo "    Checking production configuration..."

# 1. Verify and load frontend/.env.production.local
if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo -e "\033[31m[ERROR] Missing $ENV_FILE\033[0m"
  echo -e "\033[33mPlease copy frontend/.env.production.example to frontend/.env.production.local\033[0m"
  echo -e "\033[33mand fill in your real Cloud Run backend URL and Firebase configuration.\033[0m"
  echo ""
  exit 1
fi

# Export all non-comment lines
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 2. Validate essential production variables
if [ "${VITE_API_MODE:-}" != "http" ]; then
  echo -e "\033[31m[ERROR] VITE_API_MODE is '${VITE_API_MODE:-}'. It MUST be set to 'http' for production deployment.\033[0m"
  exit 1
fi

if [ -z "${VITE_API_BASE_URL:-}" ]; then
  echo -e "\033[31m[ERROR] VITE_API_BASE_URL is empty. It MUST contain the Cloud Run backend URL.\033[0m"
  exit 1
fi

echo "    [OK] VITE_API_MODE: $VITE_API_MODE"
echo "    [OK] VITE_API_BASE_URL: $VITE_API_BASE_URL"

# 3. Clean install and production build
echo ""
echo "[*] Running npm ci in frontend/..."
cd "$FRONTEND_DIR"
npm ci

echo ""
echo "[*] Running npm run build..."
npm run build

# 4. Check built bundle in frontend/dist/assets
echo ""
echo "[*] Inspecting production bundle in frontend/dist/assets..."
DIST_ASSETS="$FRONTEND_DIR/dist/assets"

if [ ! -d "$DIST_ASSETS" ]; then
  echo -e "\033[31m[ERROR] dist/assets directory not found after build.\033[0m"
  exit 1
fi

URL_FOUND=0
for js in "$DIST_ASSETS"/*.js; do
  if [ -f "$js" ] && grep -Fq "$VITE_API_BASE_URL" "$js"; then
    URL_FOUND=1
    echo "    [OK] Confirmed VITE_API_BASE_URL in $(basename "$js")"
    break
  fi
done

if [ "$URL_FOUND" -ne 1 ]; then
  echo -e "\033[31m[ERROR] Bundle validation failed: VITE_API_BASE_URL ('$VITE_API_BASE_URL') was not found in any built JS asset.\033[0m"
  echo -e "\033[31mThe application would not connect to the real Cloud Run backend.\033[0m"
  exit 1
fi

echo ""
echo -e "\033[36m==============================================================================\033[0m"
echo -e "\033[32m[SUCCESS] Production bundle built and verified cleanly for HTTP mode.\033[0m"
echo -e "\033[36mTo deploy to Firebase Hosting, run the following command:\033[0m"
echo ""
echo -e "\033[33m    firebase deploy --only hosting\033[0m"
echo ""
echo -e "\033[36m==============================================================================\033[0m"
exit 0
