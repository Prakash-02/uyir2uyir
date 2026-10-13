# AGENTS.md — Agent Guidelines for U2U (Uyir2Uyir)

## 1. Product Summary & Folder Map

**Product Summary:** U2U (Uyir2Uyir, "life to life" in Tamil) relays urgent blood requests from verified hospitals to nearby consented donors via automated phone calls, with a public Request Desk to verify forwarded messages with Gemini Flash.

**Folder Map:**
- `frontend/` — Client app (React 19 + TypeScript strict + Vite, deployed on Firebase Hosting).
- `backend/` — Server app (Python 3.12 FastAPI modular monolith, deployed on Cloud Run).
- `docs/` — Specifications, architecture, prompts log, and documentation.
- `infra/` — Deployment and infrastructure configuration files.

---

## 2. Stack & Versions

- **Frontend:**
  - React 19 (scaffolded from Vite template)
  - TypeScript (strict mode enabled)
  - Vite (build tool and dev server)
  - Tailwind CSS v4 via `@tailwindcss/vite`
  - `react-router-dom` (routing)
  - `lucide-react` (icons)
  - `clsx` (conditional class names)
  - Radix Primitives (`@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`)
  - Firebase JS SDK (`firebase`)
  - Vitest + Testing Library (`@testing-library/react`, `@testing-library/jest-dom`) + `jsdom`
  - `axe-core` (dev dependency, for automated accessibility checks)
- **Backend:**
  - Python 3.12
  - FastAPI

---

## 3. Allowed Dependencies

- **Frontend:** Allowed frontend dependencies are strictly limited to the packages listed above.
- **Rule:** Ask the human before adding any other package, and always verify that it exists first with `npm view <pkg>`.

---

## 4. Commands

- **Frontend:**
  - `npm run dev` — Run development server
  - `npm run build` — Typecheck and build production bundle
  - `npm run lint` — Lint source files
  - `npm run test` — Run test suite with Vitest

---

## 5. Development & Coding Rules

- **Edit files, don't replace:** Make targeted, incremental edits. Never replace entire files when modifying existing code.
- **Preserve exports:** Never delete or break existing exports or signatures without instruction.
- **Environment files:** Never modify, overwrite, or touch `.env` files.
- **Secrets:** Never commit credentials, API keys, service accounts, or secrets.
- **Monorepo boundaries:** Never edit `backend/` files during frontend prompts.
- **TypeScript strictness:** Strict typing required. Never use `any`; use proper generics, unions, or `unknown` with type guards.
- **Contract parity:** All API shapes must originate from `frontend/src/api/types.ts`, which mirrors `docs/API_CONTRACT.md` exactly.

---

## 6. Product & Domain Rules

- **Patient privacy:** Never display `patientRef` publicly. Patient references exist only in hospital and staff views.
- **Donor anonymity:** Donors appear only as aliases (e.g., "Donor A7"). Never expose full phone numbers or real identities.
- **AI authority limits:** Gemini extracts and quotes fields, but code validates every quote word for word. Gemini never decides request status, match validity, or donor eligibility.
- **Financial protection:** Every Request Desk answer must end with the mandatory phrase:
  `"Nobody may charge you for a donor."`
- **Simulated data label:** Demo mode must always display the prominent orange "SIMULATED DATA" banner on every screen.
- **Truthfulness:** Never invent real people, hospitals, partner institutions, or fictitious impact numbers. All mock and prototype data must be clearly designated as simulated.

---

## 7. Mock Honesty

- Mock mode must never label or attribute its output as coming from Gemini, Twilio, or Cloud Text-to-Speech when running simulated handlers.

---

## 8. Shell & Paths

- Shell standard: macOS zsh compatible commands.
- Paths: Always use forward slashes (`/`) for paths.

---

## 9. Stop Rule

- If verification (build, lint, or test) fails twice in succession, stop and report the error along with the suspected root cause. Do not enter an automated loop trying random fixes.

---

## 10. Staged-Files Safety Check

- Before every commit, inspect staged files:
  1. Run `git status`
  2. Run `git diff --cached --name-only`
  3. Abort the commit immediately if any `.env` file other than `.env.example`, or any credential/key file (`*.json`, `*-key.json`, `service-account*.json`), is staged.

---

## 11. Definition of Done

A task or prompt is complete only when:
1. Build, lint, and test suites pass cleanly.
2. `docs/FRONTEND.md` is updated (for frontend work).
3. A milestone entry is appended to `docs/PROMPTS.md`.
4. Changes are verified, staged safely, committed, and pushed to origin.
