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
| Gemini Flash (Vertex AI) | Request Desk message extraction & quote checking | Status: planned (`backend/app/desk`, `backend/app/ai`) |
| Firebase Hosting | High-performance frontend web application delivery | Status: planned (`frontend/`) |
| Cloud Firestore | Multi-database persistence (`u2u-demo` / `u2u-live`) & live state | Status: planned (`backend/`, `frontend/`) |
| Cloud Run | Scalable FastAPI modular monolith backend container | Status: planned (`backend/`) |
| Firebase Authentication | Role-based hospital and blood centre identity & custom claims | Status: planned (`backend/app/auth`) |
| Cloud Text-to-Speech | Cached Tamil and English voice audio synthesis for calls | Status: planned (`backend/app/outreach`) |
| Cloud Scheduler | 1-minute ticker for expiration and donor outreach rounds | Status: planned (`backend/app/clock`) |
| Secret Manager & Cloud Logging | Secure secret isolation and centralized audit logging | Status: planned (`backend/app/core`) |

### Documentation Index
- [U2U_BRIEF.md](U2U_BRIEF.md) — Single source of truth specification
- [AGENTS.md](AGENTS.md) — Agent coding rules, stack constraints, and guardrails
- [docs/PROMPTS.md](docs/PROMPTS.md) — Milestone prompts log and human architecture decisions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture (Status: planned)
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — Shared API type schemas and endpoints (Status: planned)
- [docs/FRONTEND.md](docs/FRONTEND.md) — Design system and UI documentation (Status: planned)

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

*(Status: planned — repository skeleton phase)*

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
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
