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
- **Commit Hash:** 13d0acd
- **Human Review:** Documentation set review passed.

### Entry #1
- **Date:** 2026-10-14
- **Goal:** Scaffold the React + TypeScript + Vite app in frontend/ with routing, Tailwind v4, lint and tests.
- **Prompt Summary:**
  Initialized Vite React-TS project in `frontend/` with TypeScript strict mode enabled. Installed allowed packages: `react-router-dom`, `lucide-react`, `clsx`, Radix primitives (`@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-dialog`, `@radix-ui/react-toast`), `firebase`, `tailwindcss`, `@tailwindcss/vite`, plus dev dependencies `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `axe-core`. Configured Tailwind v4 via `@tailwindcss/vite` without config files, imported in `index.css` alongside `tokens.css`. Created clean folder structure with `api/`, `components/`, `features/` (placeholder pages for all 9 paths in `docs/FRONTEND.md` plus 404), `i18n/`, `styles/`, `lib/`, `App.tsx`, and `routes.tsx`. Configured scripts (`dev`, `build`, `lint`, `test`, `preview`). Added smoke test rendering `App` and finding landing heading. Configured `index.html` with title "U2U · Uyir2Uyir", meta description, lang="en", and theme-color #B3122E. Verified that build, lint, and tests pass cleanly. Updated `docs/FRONTEND.md`.
- **Files Changed:**
  - `frontend/package.json`
  - `frontend/tsconfig.json`
  - `frontend/tsconfig.app.json`
  - `frontend/tsconfig.node.json`
  - `frontend/vite.config.ts`
  - `frontend/index.html`
  - `frontend/src/index.css`
  - `frontend/src/main.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/routes.tsx`
  - `frontend/src/App.test.tsx`
  - `frontend/src/test/setup.ts`
  - `frontend/src/styles/tokens.css`
  - `frontend/src/components/AppShell.tsx`
  - `frontend/src/components/DemoBanner.tsx`
  - `frontend/src/api/types.ts`
  - `frontend/src/api/client.ts`
  - `frontend/src/api/mock/index.ts`
  - `frontend/src/api/http/index.ts`
  - `frontend/src/features/landing/LandingPage.tsx`
  - `frontend/src/features/hospital/HospitalPage.tsx`
  - `frontend/src/features/centre/CentrePage.tsx`
  - `frontend/src/features/desk/DeskPage.tsx`
  - `frontend/src/features/confirm/ConfirmPage.tsx`
  - `frontend/src/features/join/JoinPage.tsx`
  - `frontend/src/features/sim/SimPage.tsx`
  - `frontend/src/features/impact/ImpactPage.tsx`
  - `frontend/src/features/eval/EvalPage.tsx`
  - `frontend/src/features/NotFoundPage.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
  - `frontend/src/i18n/useT.ts`
  - `frontend/src/lib/format.ts`
  - `frontend/src/lib/time.ts`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
- **Commit Hash:** 60ada8f
- **Human Review:** Vite React scaffold, routing, and Tailwind v4 setup review passed.

### Entry #2a
- **Date:** 2026-10-14
- **Goal:** Build the U2U design foundation: tokens, fonts, light and dark themes, the logo, and the base components (`AppShell`, `DemoBanner`, `Button`, `Card`, `StatusBadge`, `LangToggle`, `ThemeToggle`, `Logo`). Leave the other components for Prompt 2b.
- **Prompt Summary:**
  1. Implemented complete token palette in `frontend/src/styles/tokens.css` with CSS variables on `:root`, dark theme under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and `:root[data-theme="dark"]`, explicit body styling, focus ring (3px in `--info` with 2px offset), reduced-motion overrides, and Tailwind v4 `@theme` mappings.
  2. Loaded Google Fonts (`Anek Tamil` 600/700, `Noto Sans` 400/600, `Noto Sans Tamil` 400/600) in `index.html`. Applied `Anek Tamil` with tabular numerals to headings and numbers, `Noto Sans` with `Noto Sans Tamil` fallback to body, and 17px / 1.6 line-height plus no text-transform to Tamil elements.
  3. Built typed, accessible base UI components in `frontend/src/components/`:
     - `Logo`: Inline SVG mark (two leaning drops forming a heart overlap, left drop filled with `--primary`, right drop outline) with wordmark "U2U" (2 in `--primary`) and "உயிர்". Exported `public/favicon.svg`.
     - `Button`: Primary, secondary, and ghost variants; 48px minimum touch target; loading state with spinner and `aria-busy`.
     - `Card` & `CardHeader`: Elevated container surface with border, shadow, title, subtitle, and action slots.
     - `StatusBadge`: Maps all 7 `RequestStatus`, 12 `CallState`, and 3 `DeskAnswer` values to exact icon + word labels from the design system, never color alone.
     - `DemoBanner`: Persistent orange simulated data banner with `role="status"` and `aria-live="polite"`.
     - `LangToggle`: English/Tamil switch (`EN / த`) with 48px target setting `document.documentElement.lang`.
     - `ThemeToggle`: Light/dark toggle with 48px target managing `data-theme`.
     - `AppShell`: Responsive navigation shell with Logo, nav links, LangToggle, ThemeToggle, DemoBanner slot, and footer.
  4. Created `/styleguide` route in `frontend/src/features/styleguide/StyleguidePage.tsx` showcasing all components, colors, typography, and states.
  5. Tested components with Vitest and React Testing Library: verified `StatusBadge` renders icon and word for all statuses; verified `Button` disabled state during loading.
- **Files Changed:**
  - `docs/DESIGN_SYSTEM.md`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `frontend/index.html`
  - `frontend/public/favicon.svg`
  - `frontend/src/styles/tokens.css`
  - `frontend/src/components/Logo.tsx`
  - `frontend/src/components/Button.tsx`
  - `frontend/src/components/Button.test.tsx`
  - `frontend/src/components/Card.tsx`
  - `frontend/src/components/StatusBadge.tsx`
  - `frontend/src/components/StatusBadge.test.tsx`
  - `frontend/src/components/DemoBanner.tsx`
  - `frontend/src/components/LangToggle.tsx`
  - `frontend/src/components/ThemeToggle.tsx`
  - `frontend/src/components/AppShell.tsx`
  - `frontend/src/routes.tsx`
  - `frontend/src/features/styleguide/StyleguidePage.tsx`
  - `frontend/src/test/setup.ts`
- **Commit Hash:** ceeeb7a
- **Human Review:** Design foundation, tokens, fonts, logo, and base components verified cleanly.

### Entry #2b
- **Date:** 2026-10-14
- **Goal:** Build the remaining components and the /styleguide page.
- **Prompt Summary:**
  1. Built remaining core design system components in `frontend/src/components/`:
     - `ProgressBanner`: Live summary banner (covered and accepted vs N); fills over 300ms smoothly; `role="status"`, `aria-live="polite"`.
     - `Timeline`: Live chronological stream of dispatch, IVR, and screening events; 150ms fade-in animation; timestamp chips; empty state handling.
     - `CallRow`: Donor row showing alias ("Donor A7"), blood group badge, call state icon, distance, ETA chip, and action trigger slot.
     - `Field`: Accessible form field wrapper with explicit `<label>`, hint, and validation error messages; exported pre-styled `Input`, `Select`, and `Textarea` primitives with 48px touch targets.
     - `ConsentCheckbox`: Unticked-by-default multi-line consent component with full keyboard focus support, 48px touch target, and full sentence labels.
     - `Keypad`: Accessible telephone keypad component for the `/sim` screen with large buttons for digits 1 (Coming), 2 (Can't), and 9 (Opt out), with English and Tamil labels.
     - `TracePanel`: Collapsible inspection drawer displaying Gemini extraction results, verbatim quote matches (kept highlighted, dropped struck through), code decisions, and payment phrases.
     - `StatTile`: Metric display card showing 44px tabular numerals with comparison baseline lines and trend coloring.
     - `Toast` & `ToastProvider`: Radix Toast notification system with info, success, warning, and danger variants.
  2. Updated `frontend/src/features/styleguide/StyleguidePage.tsx` to showcase every single component in every state, across light and dark modes and English and Tamil scripts.
  3. Conducted browser verification of `/styleguide` at 360px mobile viewport width and saved screenshot to `docs/images/styleguide.png`.
  4. Added comprehensive unit tests for `ProgressBanner`, `ConsentCheckbox`, and `Keypad` in addition to existing test suites (36 total tests passing).
  5. Completed the "Built components" table in `docs/DESIGN_SYSTEM.md`.
- **Files Changed:**
  - `docs/DESIGN_SYSTEM.md`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/styleguide.png`
  - `frontend/src/App.tsx`
  - `frontend/src/components/ProgressBanner.tsx`
  - `frontend/src/components/ProgressBanner.test.tsx`
  - `frontend/src/components/Timeline.tsx`
  - `frontend/src/components/CallRow.tsx`
  - `frontend/src/components/Field.tsx`
  - `frontend/src/components/ConsentCheckbox.tsx`
  - `frontend/src/components/ConsentCheckbox.test.tsx`
  - `frontend/src/components/Keypad.tsx`
  - `frontend/src/components/Keypad.test.tsx`
  - `frontend/src/components/TracePanel.tsx`
  - `frontend/src/components/StatTile.tsx`
  - `frontend/src/components/Toast.tsx`
  - `frontend/src/features/styleguide/StyleguidePage.tsx`
- **Commit Hash:** 161600c
- **Human Review:** All 14 components and /styleguide responsive mobile verification passed.

### Entry #3
- **Date:** 2026-10-14
- **Goal:** Create the typed API layer with two modes: mock (in-browser engine that imitates the backend, including live updates) and http (real backend, added later). The screens never know which mode is running.
- **Prompt Summary:**
  1. Maintained canonical contracts in `src/api/types.ts` mirroring `docs/API_CONTRACT.md` verbatim.
  2. Implemented `ApiClient` interface in `src/api/client.ts` with all endpoints from contract table, live reactive subscriptions (`subscribeRequest`, `subscribeCalls`, `subscribeEvents`, `subscribeRequests`, `subscribeSimCalls`), and `getApi()` selector switching on `VITE_API_MODE` (default mock).
  3. Created pure counting rule in `src/api/mock/countingRule.ts` implementing $N+1$ pause, reopen below $N$, fulfil at $N$, and late accept.
  4. Built in-memory reactive store in `src/api/mock/engine.ts` with event emitters, donor dispatch rounds of 5, DTMF simulator keys 1, 2, 9, clinical acceptance, temporary deferral, and stand-down actions.
  5. Built realistic fixtures in `src/api/mock/fixtures.ts` (3 fictional Chennai hospitals, 2 blood centres, 30 simulated donors `Donor A1`..`Donor C10`).
  6. Implemented rules-based Request Desk extractor in `src/api/mock/desk.ts` (VERIFIED_MATCH, SENT_TO_HOSPITAL with demo confirm token, NOT_VERIFIED with NBTC payment detection, 6 sample messages across EN/TA/Tanglish, 600ms latency, honesty tag `Mock extractor (not Gemini)`).
  7. Implemented demo story scenario runner `runStory()` and `resetStory()` in `src/api/mock/story.ts` executing steps 1–5 from `U2U_BRIEF.md` section 7.
  8. Created `HttpApiClient` stub in `src/api/http/index.ts` throwing "not implemented yet" for Prompt 12.
  9. Added Vitest unit test suites (`countingRule.test.ts`, `story.test.ts`) covering all counting transitions and the demo story lifecycle (52 total unit tests passing).
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `frontend/src/api/client.ts`
  - `frontend/src/api/types.ts`
  - `frontend/src/api/mock/countingRule.ts`
  - `frontend/src/api/mock/countingRule.test.ts`
  - `frontend/src/api/mock/engine.ts`
  - `frontend/src/api/mock/fixtures.ts`
  - `frontend/src/api/mock/desk.ts`
  - `frontend/src/api/mock/story.ts`
  - `frontend/src/api/mock/story.test.ts`
  - `frontend/src/api/mock/index.ts`
  - `frontend/src/api/http/index.ts`
- **Commit Hash:** 9b265fd
- **Human Review:** Typed API layer, mock engine, counting rule, fixtures, and story runner verified cleanly.

---

## Human Decisions

- **Hospital-first requests:** Only registered hospitals can initiate blood requests. Public message submissions at the Request Desk can at most send a one-tap "Raise this request?" alert to a registered hospital blood bank; public text never directly triggers donor calls.
- **The counting rule $N+1$:** Outreach pauses as soon as covered ($\text{accepted} + \text{onTheWay}$) reaches $N + 1$ (providing one spare donor). Outreach reopens if covered falls below $N$. The request is fulfilled when accepted reaches $N$, standing down any donors still en route.
- **Staff-only acceptance:** Blood centre staff make all medical eligibility, acceptance, and deferral decisions upon donor arrival. The application and AI models never make automated clinical clearance or acceptance decisions.
- **No fuzzy hospital matching:** Gemini extracts hospital names and fields with exact verbatim quotes from forwarded message text. Code matches strictly against a predetermined catalog or marks the message as `NOT_VERIFIED`. No fuzzy heuristics or hallucinated hospital matching are permitted.
- **Simulated data labelling:** In demo mode, all donors, hospitals, and patients are explicitly labelled as simulated. An orange `SIMULATED DATA` banner is prominently displayed across all application screens.
