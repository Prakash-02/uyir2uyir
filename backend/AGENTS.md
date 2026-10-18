# AGENTS.md — Backend Guidelines for U2U (Uyir2Uyir)

## 1. Product Summary & Backend Scope

**Product Summary:** U2U relays urgent blood requests from verified hospitals to consented nearby donors via automated phone calls, with a public Request Desk to verify forwarded messages with Gemini Flash.
**Backend Scope:** Python 3.12 FastAPI modular monolith deployed on Google Cloud Run (`asia-south1`), persisting to Cloud Firestore (`u2u-demo` or `u2u-live`).

---

## 2. Architecture & Module Boundaries

The backend is organized into 9 isolated domain modules under `app/`:
- `core`: Shared configuration, Firestore client, structured logging, base models, mode guard.
- `auth`: Firebase Auth JWT verification and role-based access control.
- `requests`: Blood request lifecycle and cancellation.
- `rules`: Pure deterministic business logic and $N+1$ counting rule.
- `matching`: Donor filtering, blood group compatibility, and 5-donor batching.
- `outreach`: Twilio outbound calling, simulator bridge, IVR DTMF webhook handling.
- `screening`: Blood centre triage actions (donor accept / defer).
- `desk`: Public WhatsApp verification, quote matching, one-tap confirm tokens.
- `ai`: Vertex AI Gemini Flash client, JSON schemas, verbatim quote checking.
- `clock`: Cloud Scheduler 1-minute tick for timeouts and expiration sweeps.
- `admin`: Demo scenarios, resets, and weather simulation toggles.

---

## 3. Strict Development Rules

1. **Module Encapsulation:** Modules must communicate only through their public functions and service interfaces. Never import private internal helpers or perform cross-module database writes.
2. **Single Status Authority:** Only the `requests` module may mutate blood request statuses. All status transitions must pass through the deterministic rule engine in `app/rules/`.
3. **No Network Calls in Transactions:** Never make network calls (Twilio, Vertex AI, Cloud TTS, external HTTP) inside Cloud Firestore transactions. Compute and fetch externally; commit deterministically.
4. **camelCase JSON:** Every JSON response and Firestore document must inherit from `CamelModel` (`alias_generator=to_camel`, `populate_by_name=True`), matching `docs/API_CONTRACT.md` exactly.
5. **No Phone Numbers in Logs:** Never log raw phone numbers or PII. Use `setup_logging()` with the automated phone redaction filter (`redact_phone_numbers`). The 422 error handler must never echo input bodies.
6. **Gemini Isolation:** Calls to Vertex AI Gemini Flash are strictly confined to `app/ai/`. Other modules must consume the AI service via typed interfaces. Code must verify all returned quotes verbatim.
7. **Demo-Only Endpoint Protection:** Endpoints reserved for demonstration (`/sim/*`, `/admin/*`, `/auth/demo-role`) must verify `DATA_MODE == 'demo'` and return `403 Forbidden` in live mode.
8. **Mode Guard Enforcement:** The application must refuse startup if `DATA_MODE` and `FIRESTORE_DB` mismatch (`demo` $\to$ `u2u-demo`, `live` $\to$ `u2u-live`).
9. **Environment & Secrets:** Never modify `.env` files or commit credentials/keys. All configuration flows through `app/core/config.py`.
10. **Voice Call Scope & Honesty:** Real Twilio outbound calls go strictly to verified team phones in `CALL_ALLOWLIST`. Evaluators and judges test voice calls in the browser on `/sim`. Twilio is only the phone line; all understanding and speech is Google (Gemini Live and Cloud Text-to-Speech). Calls to real donors through an Indian provider (e.g. Exotel) are roadmap.

---

## 4. Commands

Run from `backend/`:
- `make dev` — Run development server with auto-reload on port 8080: `uvicorn app.main:app --reload --port 8080`
- `make test` — Run test suite with pytest: `pytest`
- `make lint` — Lint and format check with ruff: `ruff check . && ruff format --check .`

---

## 5. Definition of Done

A backend task is complete only when:
1. `make lint` passes cleanly with zero warnings or errors.
2. `make test` passes cleanly.
3. API contracts match `docs/API_CONTRACT.md` and `frontend/src/api/types.ts`.
4. Staged-files check passes: no `.env`, `.venv`, or `*.json` credentials staged.
