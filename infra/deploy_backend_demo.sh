#!/usr/bin/env bash
# Deploy script for U2U backend in demo mode on Google Cloud Run.
# Usage: ./infra/deploy_backend_demo.sh <PROJECT_ID> [REGION]

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <PROJECT_ID> [REGION]"
  echo "Example: $0 uyir2uyir-53929 asia-south1"
  exit 1
fi

PROJECT_ID="$1"
REGION="${2:-asia-south1}"
SERVICE_NAME="u2u-api-demo"
SA_API="sa-api-demo@${PROJECT_ID}.iam.gserviceaccount.com"
SA_SCHEDULER="sa-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

echo "================================================================="
echo "==> Deploying U2U Backend Demo to Cloud Run"
echo "    Project:  ${PROJECT_ID}"
echo "    Region:   ${REGION}"
echo "    Service:  ${SERVICE_NAME}"
echo "================================================================="

# Pre-flight: verify infra/env.demo.yaml exists and GEMINI_MODEL is filled
if [ ! -f "infra/env.demo.yaml" ]; then
  echo "❌ ERROR: infra/env.demo.yaml not found. Please create it before deploying."
  exit 1
fi

if grep -q "YOUR_GEMINI_MODEL_HERE" infra/env.demo.yaml; then
  echo "❌ ERROR: Please edit infra/env.demo.yaml and set GEMINI_MODEL (e.g. gemini-2.0-flash) before deploying."
  exit 1
fi

# Step 1: Set GCP project
echo "==> [1/7] Setting gcloud active project to ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}"

# Step 2: Enable required GCP services
echo "==> [2/7] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com

# Step 3: Configure Cloud Build permissions for default compute service account
echo "==> [3/7] Configuring Cloud Build permissions on default compute service account..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "    Project Number: ${PROJECT_NUMBER}"
echo "    Granting roles/run.builder to ${COMPUTE_SA}..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/run.builder" \
  --condition=None

# Step 4: Create Cloud Run runtime service account sa-api-demo and bind roles
echo "==> [4/7] Configuring runtime service account sa-api-demo..."
if ! gcloud iam service-accounts describe "${SA_API}" >/dev/null 2>&1; then
  echo "    Creating service account ${SA_API}..."
  gcloud iam service-accounts create sa-api-demo \
    --display-name="U2U Cloud Run Demo API Service Account"
else
  echo "    Service account ${SA_API} already exists."
fi

echo "    Granting roles/aiplatform.user to sa-api-demo..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/aiplatform.user" \
  --condition=None

echo "    Granting roles/logging.logWriter to sa-api-demo..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/logging.logWriter" \
  --condition=None

echo "    Granting roles/firebaseauth.admin to sa-api-demo (for setting demo custom claims)..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/firebaseauth.admin" \
  --condition=None

echo "    Granting roles/datastore.user to sa-api-demo (targeting u2u-demo database)..."
if ! gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/datastore.user" \
  --condition='expression=resource.name.startsWith("projects/'"${PROJECT_ID}"'/databases/u2u-demo"),title=limit_to_u2u_demo' >/dev/null 2>&1; then
  echo "    Note: Conditional IAM binding not supported on this project tier; applying at project level."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_API}" \
    --role="roles/datastore.user" \
    --condition=None
fi

# Step 5: Manage Secret Manager secrets (LINK_SIGNING_KEY, PHONE_KEY, INTERNAL_TOKEN)
echo "==> [5/7] Managing secrets in Secret Manager..."
for SECRET_NAME in LINK_SIGNING_KEY PHONE_KEY INTERNAL_TOKEN; do
  if ! gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; then
    echo "    Creating secret ${SECRET_NAME}..."
    openssl rand -hex 32 | tr -d '\n' | gcloud secrets create "${SECRET_NAME}" \
      --data-file=- \
      --replication-policy=automatic
  else
    echo "    Secret ${SECRET_NAME} already exists."
  fi

  echo "    Granting secretAccessor on ${SECRET_NAME} to sa-api-demo..."
  gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
    --member="serviceAccount:${SA_API}" \
    --role="roles/secretmanager.secretAccessor"
done

# Step 6: Deploy Cloud Run service
echo "==> [6/7] Deploying Cloud Run service ${SERVICE_NAME}..."
gcloud run deploy "${SERVICE_NAME}" \
  --source backend \
  --region "${REGION}" \
  --service-account "${SA_API}" \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --max-instances 3 \
  --min-instances 0 \
  --env-vars-file infra/env.demo.yaml \
  --set-secrets LINK_SIGNING_KEY=LINK_SIGNING_KEY:latest,PHONE_KEY=PHONE_KEY:latest,INTERNAL_TOKEN=INTERNAL_TOKEN:latest

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "    Service URL: ${SERVICE_URL}"

# Step 7: Configure Cloud Scheduler for 1-minute ticker
echo "==> [7/7] Configuring Cloud Scheduler for 1-minute ticker..."
if ! gcloud iam service-accounts describe "${SA_SCHEDULER}" >/dev/null 2>&1; then
  echo "    Creating service account ${SA_SCHEDULER}..."
  gcloud iam service-accounts create sa-scheduler \
    --display-name="U2U Cloud Scheduler OIDC Service Account"
else
  echo "    Service account ${SA_SCHEDULER} already exists."
fi

# Grant sa-scheduler invoker role on Cloud Run service
echo "    Granting roles/run.invoker to sa-scheduler..."
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region "${REGION}" \
  --member="serviceAccount:${SA_SCHEDULER}" \
  --role="roles/run.invoker"

# Create or update Cloud Scheduler job
if gcloud scheduler jobs describe u2u-tick-demo --location "${REGION}" >/dev/null 2>&1; then
  echo "    Updating existing Cloud Scheduler job u2u-tick-demo..."
  gcloud scheduler jobs update http u2u-tick-demo \
    --location "${REGION}" \
    --schedule "* * * * *" \
    --uri "${SERVICE_URL}/internal/tick" \
    --http-method POST \
    --oidc-service-account-email="${SA_SCHEDULER}" \
    --oidc-token-audience="${SERVICE_URL}"
else
  echo "    Creating Cloud Scheduler job u2u-tick-demo..."
  gcloud scheduler jobs create http u2u-tick-demo \
    --location "${REGION}" \
    --schedule "* * * * *" \
    --uri "${SERVICE_URL}/internal/tick" \
    --http-method POST \
    --oidc-service-account-email="${SA_SCHEDULER}" \
    --oidc-token-audience="${SERVICE_URL}"
fi

echo "================================================================="
echo "🎉 Deployment step complete!"
echo "   Service URL: ${SERVICE_URL}"

# Check if PUBLIC_BASE_URL matches actual SERVICE_URL
if grep -q "REPLACE_WITH_SERVICE_URL_AFTER_DEPLOY" infra/env.demo.yaml || ! grep -q "${SERVICE_URL}" infra/env.demo.yaml; then
  echo ""
  echo "👉 REQUIRED NEXT STEP (First Deployment):"
  echo "   1. Open infra/env.demo.yaml"
  echo "   2. Set PUBLIC_BASE_URL: \"${SERVICE_URL}\""
  echo "   3. Redeploy once to apply the public service URL for OIDC audience verification:"
  echo "      ./infra/deploy_backend_demo.sh ${PROJECT_ID} ${REGION}"
else
  echo "   PUBLIC_BASE_URL: Configured and synchronized"
fi

echo ""
echo "⚠️  CRITICAL BUDGET SAFETY REMINDER:"
echo "   Please verify that a \$20 budget alert is configured in Google Cloud Billing:"
echo "   https://console.cloud.google.com/billing/budgets"
echo "================================================================="
