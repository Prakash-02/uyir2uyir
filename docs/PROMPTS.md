# Prompts & Human Decisions Log

How this repo was built with Google Antigravity: milestone prompts, what the agent produced, and what the human decided.

---

## Milestone Entries

### Entry #0a
- **Date:** 2026-10-13
- **Goal:** Set up the U2U (Uyir2Uyir) monorepo with `backend/`, `docs/`, and `infra/` folders, the agent rules file, README skeleton, licensing, environment template, and initial git commit pushed to GitHub.
- **Prompt Summary:**
  Initialize `.gitignore` with ignore patterns. Scaffold `backend/` package directories (`core`, `auth`, `requests`, `rules`, `matching`, `outreach`, `screening`, `desk`, `ai`, `clock`), `backend/prompts/`, `backend/tests/`, `backend/eval/`, `docs/images/`, and `infra/`. Create root `AGENTS.md` and copy to `.agents/rules/u2u.md`. Draft `README.md` aligned with `U2U_BRIEF.md`. Create `docs/PROMPTS.md`, `LICENSE` (MIT, 2026 U2U team), and `.env.example`. Prepare and verify clean git staging before committing and pushing.
- **Files Changed:**
  - `.gitignore`
  - `LICENSE`
  - `.env.example`
  - `AGENTS.md`
  - `.agents/rules/u2u.md`
  - `README.md`
  - `backend/README.md`
  - `backend/app/__init__.py`
  - `backend/app/core/__init__.py`
  - `backend/app/auth/__init__.py`
  - `backend/app/requests/__init__.py`
  - `backend/app/rules/__init__.py`
  - `backend/app/matching/__init__.py`
  - `backend/app/outreach/__init__.py`
  - `backend/app/screening/__init__.py`
  - `backend/app/desk/__init__.py`
  - `backend/app/ai/__init__.py`
  - `backend/app/clock/__init__.py`
  - `backend/prompts/.gitkeep`
  - `backend/tests/.gitkeep`
  - `backend/eval/.gitkeep`
  - `docs/images/.gitkeep`
  - `docs/PROMPTS.md`
  - `infra/.gitkeep`
- **Commit Hash:** 17cf7de
- **Human Review:** Initial skeleton review passed.

### Entry #0b
- **Date:** 2026-10-13
- **Goal:** Write the documentation set from the brief so the repo explains itself to judges and to the coding agent.
- **Prompt Summary:**
  Authored the complete 9-document specification set derived directly from `U2U_BRIEF.md`:
  1. `docs/ARCHITECTURE.md`: modular monolith architecture, the 9 backend modules, data modes (`demo` vs `live`), Mermaid state machine diagrams for blood requests and call lifecycles, Firestore collections schema, and system reliability rules.
  2. `docs/API_CONTRACT.md`: Section 5 verbatim TypeScript interfaces and endpoint specification table.
  3. `docs/DESIGN_SYSTEM.md`: Section 6 warm-paper and crimson palette tokens, status mappings with icons and labels, typography scale with Tamil rules, 14 core components, layout breakpoints, and accessibility standards.
  4. `docs/FRONTEND.md`: route catalog across all 9 paths, directory layout, dual data flow (mock vs HTTP mode), and cumulative build log.
  5. `docs/AI_DESIGN.md`: Gemini Flash Vertex AI pipeline at temperature 0, character caps, JSON schema with hospital enum, Python verbatim quote verification, remuneration phrase detection, fallback handling, and `/eval` testing metrics.
  6. `docs/PRIVACY_SAFETY.md`: data kept vs purged, donor masking and aliases, explicit purpose-based consent checkboxes, press-9 instant opt-out, regulatory declaration ("Prototype, not a medical device"), and staff-only clinical authority.
  7. `docs/TESTING.md`: multi-tier test plan spanning frontend unit/a11y, backend state machine unit tests, API integration, AI safety evals, and pending metric benchmark table.
  8. `docs/DEMO.md`: 6-step emergency dispatch scenario ($N=2$ units O+ red cells) with Mermaid sequence diagram, 2-minute judge walkthrough script, and demo role switcher access.
  9. `docs/ROADMAP.md`: Section 8 out-of-scope boundaries, hackathon development milestones, and post-hackathon clinical pilot pathway.
  Updated `README.md` documentation index and roadmap milestone tracking.
- **Files Changed:**
  - `docs/ARCHITECTURE.md`
  - `docs/API_CONTRACT.md`
  - `docs/DESIGN_SYSTEM.md`
  - `docs/FRONTEND.md`
  - `docs/AI_DESIGN.md`
  - `docs/PRIVACY_SAFETY.md`
  - `docs/TESTING.md`
  - `docs/DEMO.md`
  - `docs/ROADMAP.md`
  - `README.md`
  - `docs/PROMPTS.md`
- **Commit Hash:** [Commit hash pending commit]
- **Human Review:** [Leave placeholder for human reviewer to fill in]

---

## Human Decisions

- **Hospital-first requests:** Only registered hospitals can initiate blood requests. Public message submissions at the Request Desk can at most send a one-tap "Raise this request?" alert to a registered hospital blood bank; public text never directly triggers donor calls.
- **The counting rule $N+1$:** Outreach pauses as soon as covered ($\text{accepted} + \text{onTheWay}$) reaches $N + 1$ (providing one spare donor). Outreach reopens if covered falls below $N$. The request is fulfilled when accepted reaches $N$, standing down any donors still en route.
- **Staff-only acceptance:** Blood centre staff make all medical eligibility, acceptance, and deferral decisions upon donor arrival. The application and AI models never make automated clinical clearance or acceptance decisions.
- **No fuzzy hospital matching:** Gemini extracts hospital names and fields with exact verbatim quotes from forwarded message text. Code matches strictly against a predetermined catalog or marks the message as `NOT_VERIFIED`. No fuzzy heuristics or hallucinated hospital matching are permitted.
- **Simulated data labelling:** In demo mode, all donors, hospitals, and patients are explicitly labelled as simulated. An orange `SIMULATED DATA` banner is prominently displayed across all application screens.
