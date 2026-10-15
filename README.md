# U2U (Uyir2Uyir)
> Urgent blood requests relayed from verified hospitals to nearby consented donors via automated calls, with a public WhatsApp message verification desk.

- **Live Demo:** [Pending deployment]
- **Video Walkthrough:** [Pending recording]
- **Status:** Prototype. All donors, hospitals and patients are simulated.

### Why
During medical emergencies, families frequently scramble at odd hours forwarding unverified blood requests across messaging groups [CITE SOURCE]. U2U eliminates this despair by coordinating verified hospital needs directly with consented nearby donors in minutes without spam or financial exploitation [CITE SOURCE].

### Google Services
| Service | Used for | Code path |
|---|---|---|
| Gemini on Vertex AI | reads pasted messages | `backend/app/ai/gemini.py` |
| Firebase Hosting | High-performance frontend web application delivery | Status: planned (`frontend/`) |
| Cloud Firestore | Multi-database persistence (`u2u-demo` / `u2u-live`) & live state | Built (`backend/app/core/store_firestore.py`) |
| Cloud Run | Scalable FastAPI modular monolith backend container | Built (`backend/Dockerfile`) |
| Firebase Authentication | Role-based hospital and blood centre identity & custom claims | Built (`backend/app/auth/`) |
| Cloud Text-to-Speech | Cached Tamil and English voice audio synthesis for calls | Built (`backend/app/ai/tts.py`) |
| Cloud Scheduler | 1-minute ticker for expiration and donor outreach rounds | Built (`backend/app/clock/router.py`) |
| Secret Manager & Cloud Logging | Secure secret isolation and centralized audit logging | Built (`backend/app/core/logging.py`) |

> [!NOTE]
> **Telephony Boundary:** Twilio is used only for the phone call; all AI runs on Gemini.

### Documentation Index
- [U2U_BRIEF.md](U2U_BRIEF.md) — Single source of truth specification
- [AGENTS.md](AGENTS.md) — Agent coding rules, stack constraints, and guardrails
- [docs/PROMPTS.md](docs/PROMPTS.md) — Milestone prompts log and human architecture decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture, modules, state machines, and reliability
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — Verbatim TypeScript types and REST endpoint contract
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — Visual tokens, status mappings, typography, and components
- [docs/FRONTEND.md](docs/FRONTEND.md) — Route catalog, directory structure, data flows, and build log
- [docs/AI_DESIGN.md](docs/AI_DESIGN.md) — Gemini Flash pipeline, verbatim quote checking, and safety guardrails
- [docs/PRIVACY_SAFETY.md](docs/PRIVACY_SAFETY.md) — Data minimization, consent, opt-out mechanisms, and clinical boundaries
- [docs/TESTING.md](docs/TESTING.md) — Multi-tier test strategy, benchmark metrics, and pre-commit checks
- [docs/DEMO.md](docs/DEMO.md) — 6-step emergency scenario, 2-minute judge walkthrough, and demo access
- [docs/ROADMAP.md](docs/ROADMAP.md) — Out-of-scope boundaries, development milestones, and clinical pilot pathway

---

## What It Does: The Three Promises

U2U is built on the philosophy: *Life passes on. Freely. Safely. In time.*

| Promise | Meaning | Feature That Keeps It |
|---|---|---|
| **Freely** | Life is given, never sold | Every Request Desk verification response ends with *"Nobody may charge you for a donor."* Any payment wording identified blocks automated hospital dispatch. |
| **Safely** | Only real requests, only staff decide | Requests originate solely from verified hospitals. Blood centre staff make final eligibility decisions upon arrival. Donor phone numbers and patient IDs remain strictly masked. |
| **In time** | No family searching alone at 2 a.m. | Rounds of 5 donors are dialed sequentially in Tamil or English until covered. Outreach automatically pauses when enough donors commit, and reopens if someone drops out. |

---

## How It Works

1. **Hospital Raises Request:** Hospital staff input blood group, component, units needed ($N$), and internal patient reference (`patientRef`).
2. **Automated Outreach Rounds:** The system calls 5 matching donors at a time in their preferred language (Tamil or English).
3. **Interactive IVR / Simulator:**
   - **Press 1:** On the way.
   - **Press 2:** Cannot donate (deferred / unsafe road conditions).
   - **Press 9:** Opt-out from future calls.
4. **N+1 Pause Rule:**
   - Outreach **pauses** as soon as $\text{accepted} + \text{onTheWay} \ge N + 1$ (providing one spare donor).
   - Outreach **reopens** if dropouts reduce covered below $N$.
   - Request is **fulfilled** once $\text{accepted} \ge N$, standing down any other donors still en route.
5. **Staff Acceptance:** Only registered blood centre staff decide whether an arriving donor is medically eligible to donate.
6. **Public Request Desk:** Families paste forwarded WhatsApp messages. Gemini extracts hospital, patient, and blood component with exact source text quotes. Code validates quotes word-for-word before checking for verified matches or notifying hospital blood banks.

---

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Status: planned) for full system diagrams and dataflow specifications.
- **Frontend:** React 19 + TypeScript strict + Vite + Tailwind CSS v4 on Firebase Hosting.
- **Backend:** Python 3.12 FastAPI modular monolith on Cloud Run.
- **Storage:** Firestore with strict separation between `u2u-demo` and `u2u-live`.

---

## Run Locally

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Run the backend locally
```bash
cd backend

# 1. Create and activate Python 3.12 virtual environment
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements-dev.txt

# 3. Configure local environment
cp .env.example .env

# 4. Run development server (on port 8080)
make dev                        # Runs uvicorn app.main:app --reload --port 8080

# 5. Run tests and linting
make test                       # Runs pytest
make lint                       # Runs ruff check . && ruff format --check .

# 6. Seed simulated database fixtures (hospitals, centres, donors, config)
DATA_MODE=demo STORE=firestore .venv/bin/python scripts/seed.py
# On Windows PowerShell:
# $env:DATA_MODE="demo"; $env:STORE="firestore"; .\.venv\Scripts\python.exe scripts/seed.py
```

---

## Deploy

### 1. Backend on Cloud Run (Demo Mode)

The U2U backend deploys to **Google Cloud Run** in `asia-south1` with continuous execution enabled (`--no-cpu-throttling` to sustain background simulation story runs), connected to **Secret Manager** for signing and phone encryption keys, and triggered by **Cloud Scheduler** for 1-minute expiration and round progression sweeps.

```bash
# 1. Login and select Firebase project (Git Bash / PowerShell)
firebase login
firebase use uyir2uyir-53929

# 2. Deploy Firestore security rules and composite indexes to u2u-demo (Git Bash)
./infra/deploy_firestore_rules.sh uyir2uyir-53929

# 3. Seed u2u-demo database from your laptop (PowerShell)
cd backend
$env:DATA_MODE="demo"; $env:STORE="firestore"; $env:GOOGLE_CLOUD_PROJECT="uyir2uyir-53929"; $env:FIRESTORE_DB="u2u-demo"; .\run.ps1 test
.\.venv\Scripts\python.exe scripts/seed.py
Remove-Item env:DATA_MODE, env:STORE, env:GOOGLE_CLOUD_PROJECT, env:FIRESTORE_DB
cd ..

# 4. Fill GEMINI_MODEL in infra/env.demo.yaml, then run first deploy (Git Bash)
./infra/deploy_backend_demo.sh uyir2uyir-53929 asia-south1

# 5. Set PUBLIC_BASE_URL in infra/env.demo.yaml to the deployed Cloud Run URL, then redeploy once (Git Bash)
./infra/deploy_backend_demo.sh uyir2uyir-53929 asia-south1

# 6. Run post-deploy smoke verification (Git Bash)
./infra/smoke_backend.sh <SERVICE_URL>
```

#### Google Services & Code Paths
| Component | Implementation File / Config | Description |
|---|---|---|
| **Cloud Run Service** | [`backend/Dockerfile`](backend/Dockerfile), [`infra/deploy_backend_demo.sh`](infra/deploy_backend_demo.sh) | Containerized FastAPI runtime on port 8080 |
| **Environment Configuration** | [`infra/env.demo.yaml`](infra/env.demo.yaml) | Safe multi-value env vars (CORS origins, allowlists) |
| **Secret Manager** | [`infra/deploy_backend_demo.sh`](infra/deploy_backend_demo.sh) | `LINK_SIGNING_KEY`, `PHONE_KEY`, and `INTERNAL_TOKEN` |
| **Cloud Scheduler OIDC Ticker** | [`backend/app/clock/router.py`](backend/app/clock/router.py) | 1-minute tick guarded by Google OIDC token verification |
| **Firestore Database (`u2u-demo`)** | [`infra/firestore.demo.rules`](infra/firestore.demo.rules), [`infra/firestore.indexes.json`](infra/firestore.indexes.json) | Read-only client demo rules and composite indexes |
| **Post-Deploy Smoke Test** | [`infra/smoke_backend.sh`](infra/smoke_backend.sh) | End-to-end verification of `/healthz`, `/config`, story run, and `/metrics` |
| **Backend CI** | [`.github/workflows/backend.yml`](.github/workflows/backend.yml) | Automated linting and pytest suite on PR and push to main |

> ⚠️ **CRITICAL BUDGET SAFETY:** Ensure a **$20 budget alert** is configured in [Google Cloud Billing](https://console.cloud.google.com/billing/budgets) before production deployment.

---

## Testing and Evaluation

*(Status: planned)*
- **Frontend:** Vitest, Testing Library, and jsdom unit/component tests. Automated accessibility tests via `axe-core`.
- **Backend:** Pytest integration tests across state-machine rules and API endpoints.
- **Request Desk Evaluation:** Labelled test set evaluated against precision, recall, and safety rules (zero tolerance for payment leaks or hallucinated hospital IDs).

---

## Safety and Privacy

- **Patient Privacy:** `patientRef` is never displayed in public routes or API outputs.
- **Donor Anonymity:** Donors are represented only by aliases (e.g., "Donor A7") throughout staff dashboards and public event timelines.
- **Quote Verification:** Code verifies every Gemini extraction against raw input character-by-character to prevent hallucination.
- **Staff-Only Decision Authority:** Neither Gemini nor automated algorithms ever make eligibility or match validity determinations.

---

## Data Honesty

- **Prototype Transparency:** All donors, hospitals, and patients in this prototype are entirely simulated.
- **Banner Requirement:** The orange `SIMULATED DATA` banner is globally displayed in demo mode and served directly from configuration.
- **Strict Claims:** No claims of real hospital partnerships, measured field metrics, or unverified statistical improvements are permitted.

---

## Roadmap

- [x] Milestone 0a: Repository structure, agent rules, and README skeleton.
- [x] Milestone 0b: Canonical documentation set and architecture specifications.
- [ ] Milestone 1: Frontend Vite scaffold, Tailwind v4 design system tokens, and core UI components.
- [ ] Milestone 2: Hospital, Blood Centre, and Request Desk interactive views with mock service worker.
- [ ] Milestone 3: Backend FastAPI modular monolith with core domain models and rule engine.
- [ ] Milestone 4: Gemini Flash extraction pipeline and Vertex AI integration.
- [ ] Milestone 5: Full integration, automated eval harness, and production deployment.

---

## Built with Google Antigravity

This repository is developed with Google Antigravity following strict agentic pair programming protocols.
- Development guidelines & guardrails: [AGENTS.md](AGENTS.md)
- Prompts trajectory & design decisions: [docs/PROMPTS.md](docs/PROMPTS.md)
