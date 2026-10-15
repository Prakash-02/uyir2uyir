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
| Cloud Text-to-Speech | Cached Tamil and English voice audio synthesis for calls | Status: planned (`backend/app/outreach`) |
| Cloud Scheduler | 1-minute ticker for expiration and donor outreach rounds | Built (`backend/app/clock/router.py`) |
| Secret Manager & Cloud Logging | Secure secret isolation and centralized audit logging | Built (`backend/app/core/logging.py`) |

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

*(Status: planned)*
- **Frontend:** Firebase Hosting via GitHub Actions.
- **Backend:** Google Cloud Run (asia-south1 region) connected to Secret Manager and Vertex AI.

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
