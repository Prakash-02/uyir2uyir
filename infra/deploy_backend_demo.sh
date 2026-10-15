#!/usr/bin/env bash
# Deploy script for U2U backend in demo mode on Google Cloud Run.
# Usage: ./infra/deploy_backend_demo.sh <PROJECT_ID> [REGION]

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <PROJECT_ID> [REGION]"
  echo "Example: $0 my-gcp-project-id asia-south1"
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

# Step 1: Set GCP project
echo "==> [1/8] Setting gcloud project..."
gcloud config set project "${PROJECT_ID}"

# Step 2: Enable required GCP services
echo "==> [2/8] Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  iam.googleapis.com

# Step 3: Create Cloud Run runtime service account sa-api-demo
echo "==> [3/8] Creating service account sa-api-demo if not existing..."
if ! gcloud iam service-accounts describe "${SA_API}" >/dev/null 2>&1; then
  gcloud iam service-accounts create sa-api-demo \
    --display-name="U2U Cloud Run Demo API Service Account"
fi

echo "==> Binding IAM roles to sa-api-demo..."
# Role: aiplatform.user (for Gemini Vertex AI calls)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/aiplatform.user" \
  --condition=None

# Role: logging.logWriter (for Cloud Run audit and structured logging)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/logging.logWriter" \
  --condition=None

# Role: datastore.user (Firestore database access)
# Note on roles/datastore.user condition:
# We attempt to bind with an IAM condition limiting access strictly to the u2u-demo database.
# If the IAM policy condition is not supported in the organization or project tier, we fallback
# to standard project-level binding where application configuration enforces isolation.
echo "==> Granting roles/datastore.user (attempting database-level condition for u2u-demo)..."
if ! gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_API}" \
  --role="roles/datastore.user" \
  --condition='expression=resource.name.startsWith("projects/'"${PROJECT_ID}"'/databases/u2u-demo"),title=limit_to_u2u_demo' >/dev/null 2>&1; then
  echo "    Note: Conditional IAM binding not permitted or unsupported on datastore.user. Binding at project level."
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_API}" \
    --role="roles/datastore.user" \
    --condition=None
fi

# Step 4: Create secrets in Secret Manager (random generation, piped directly, never printed)
echo "==> [4/8] Managing secrets in Secret Manager..."
if ! gcloud secrets describe LINK_SIGNING_KEY >/dev/null 2>&1; then
  echo "    Creating secret LINK_SIGNING_KEY..."
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create LINK_SIGNING_KEY \
    --data-file=- \
    --replication-policy=automatic
else
  echo "    Secret LINK_SIGNING_KEY already exists."
fi

if ! gcloud secrets describe PHONE_KEY >/dev/null 2>&1; then
  echo "    Creating secret PHONE_KEY..."
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets create PHONE_KEY \
    --data-file=- \
    --replication-policy=automatic
else
  echo "    Secret PHONE_KEY already exists."
fi

# Grant sa-api-demo secretAccessor on its own secrets only
echo "    Granting secretAccessor on LINK_SIGNING_KEY and PHONE_KEY to sa-api-demo..."
gcloud secrets add-iam-policy-binding LINK_SIGNING_KEY \
  --member="serviceAccount:${SA_API}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding PHONE_KEY \
  --member="serviceAccount:${SA_API}" \
  --role="roles/secretmanager.secretAccessor"

# Step 5: Generate/update infra/env.demo.yaml with project ID and hosting origins
echo "==> [5/8] Updating infra/env.demo.yaml with target project details..."
cat <<EOF > infra/env.demo.yaml
DATA_MODE: "demo"
FIRESTORE_DB: "u2u-demo"
STORE: "firestore"
GOOGLE_CLOUD_PROJECT: "${PROJECT_ID}"
VERTEX_LOCATION: "${REGION}"
GEMINI_MODEL: "gemini-2.0-flash"
ALLOWED_ORIGINS: "http://localhost:5173,https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com"
PUBLIC_BASE_URL: "https://${SERVICE_NAME}-${PROJECT_ID}.a.run.app"
SCHEDULER_SERVICE_ACCOUNT: "${SA_SCHEDULER}"
CALL_ALLOWLIST: "+919876543210,+919876543211"
DAILY_CALL_CAP: "30"
REQUEST_CALL_CAP: "15"
DAILY_GEMINI_CAP: "2000"
EOF

# Step 6: Deploy Cloud Run service
echo "==> [6/8] Deploying Cloud Run service ${SERVICE_NAME}..."
gcloud run deploy "${SERVICE_NAME}" \
  --source backend \
  --region "${REGION}" \
  --service-account "${SA_API}" \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --max-instances 3 \
  --min-instances 0 \
  --env-vars-file infra/env.demo.yaml \
  --set-secrets LINK_SIGNING_KEY=LINK_SIGNING_KEY:latest,PHONE_KEY=PHONE_KEY:latest

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "    Service deployed at: ${SERVICE_URL}"

# Update PUBLIC_BASE_URL to match the actual allocated Cloud Run URL
echo "    Synchronizing PUBLIC_BASE_URL with actual Cloud Run URL..."
gcloud run services update "${SERVICE_NAME}" \
  --region "${REGION}" \
  --update-env-vars "PUBLIC_BASE_URL=${SERVICE_URL}"

# Step 7: Create Cloud Scheduler service account and job
echo "==> [7/8] Configuring Cloud Scheduler for 1-minute ticker..."
if ! gcloud iam service-accounts describe "${SA_SCHEDULER}" >/dev/null 2>&1; then
  gcloud iam service-accounts create sa-scheduler \
    --display-name="U2U Cloud Scheduler OIDC Service Account"
fi

# Allow sa-scheduler to invoke the Cloud Run service
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region "${REGION}" \
  --member="serviceAccount:${SA_SCHEDULER}" \
  --role="roles/run.invoker"

# Create or update scheduler job
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
  echo "    Creating new Cloud Scheduler job u2u-tick-demo..."
  gcloud scheduler jobs create http u2u-tick-demo \
    --location "${REGION}" \
    --schedule "* * * * *" \
    --uri "${SERVICE_URL}/internal/tick" \
    --http-method POST \
    --oidc-service-account-email="${SA_SCHEDULER}" \
    --oidc-token-audience="${SERVICE_URL}"
fi

# Step 8: Safety & Budget alert notice
echo "==> [8/8] Deployment Complete!"
echo "================================================================="
echo "🎉 Backend deployed successfully to:"
echo "   ${SERVICE_URL}"
echo ""
echo "⚠️  CRITICAL BUDGET SAFETY REMINDER:"
echo "   Please verify that a \$20 budget alert is configured in Google Cloud Billing:"
echo "   https://console.cloud.google.com/billing/budgets"
echo "================================================================="
