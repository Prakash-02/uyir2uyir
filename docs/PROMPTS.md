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
- **Commit Hash:** 75304c8
- **Human Review:** Typed API client, pure counting rule, mock engine, and demo story runner verified.

### Entry #4
- **Date:** 2026-10-14
- **Goal:** Wire the AppShell, demo banner, English and Tamil text, and the landing page.
- **Prompt Summary:**
  1. Built comprehensive i18n dictionaries in `frontend/src/i18n/en.ts` and `frontend/src/i18n/ta.ts` with natural Tamil translations and `// REVIEW` review tags on all Tamil strings.
  2. Implemented `LangContext`, `LangProvider`, and `useT()` hook with `localStorage` persistence inside `try/catch` and automatic `document.documentElement.lang` synchronisation.
  3. Implemented `ThemeChoice` ('light' | 'dark' | 'system') with `ThemeProvider` and updated `ThemeToggle` supporting light, dark, and system modes with `localStorage` persistence and OS media query listeners.
  4. Updated `DemoBanner` with `getApi().getConfig()` dataMode check, orange styling, and an interactive "Run the story" button invoking the 5-step scenario runner and navigating to `/centre`.
  5. Updated `AppShell` with the 5 primary navigation links (Hospital, Blood centre, Request Desk, Join as donor, Impact), secondary demo inspection links, language/theme toggles, and prototype footer with `"Nobody may charge you for a donor."`.
  6. Implemented landing page (`/`) featuring Hero section with Logo, title "Uyir2Uyir", tagline "Life passes on. Freely. Safely. In time.", product summary, three promise cards (Freely, Safely, In time), role cards linking to `/hospital`, `/centre`, `/desk`, `/join`, and a 4-step "How It Works" workflow strip.
  7. Verified visual responsiveness in browser subagent at 1280px desktop and 360px mobile viewports, saving screenshot to `docs/images/landing.png`. All 56 unit tests pass, lint clean, production build clean.
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/landing.png`
  - `frontend/src/App.tsx`
  - `frontend/src/App.test.tsx`
  - `frontend/src/components/AppShell.tsx`
  - `frontend/src/components/DemoBanner.tsx`
  - `frontend/src/components/LangToggle.tsx`
  - `frontend/src/components/ThemeToggle.tsx`
  - `frontend/src/features/landing/LandingPage.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
  - `frontend/src/i18n/LangContext.ts`
  - `frontend/src/i18n/LangProvider.tsx`
  - `frontend/src/i18n/useT.ts`
  - `frontend/src/lib/themeContext.ts`
  - `frontend/src/lib/ThemeProvider.tsx`
  - `frontend/src/lib/theme.ts`
- **Commit Hash:** e8620a8
- **Human Review:** AppShell navigation, i18n English/Tamil providers, theme toggles, and landing page verified.

### Entry #5
- **Date:** 2026-10-14
- **Goal:** Build /hospital: raise a request and watch it get covered live.
- **Prompt Summary:**
  1. Built the Hospital screen in `frontend/src/features/hospital/HospitalPage.tsx` with top role banner: "Signed in as: Sample General Hospital (demo)".
  2. Implemented typed request creation form using `Field`, `Input`, and `Select`: blood group selector, plain-language components ("Red cells (PRBC)", "Platelets, single donor (SDP)", "Platelets, pooled (RDP)", "Whole blood", "Fresh frozen plasma (FFP)"), units (1 to 6), and patient reference with privacy hint ("Only your hospital and the blood centre see this").
  3. Integrated active request live tracking: `StatusBadge`, `ProgressBanner` displaying live coverage ("{onTheWay} on the way · {accepted} accepted · need {unitsNeeded}"), compact live `Timeline` (`subscribeEvents`), and ghost Cancel button with `@radix-ui/react-dialog` confirm modal.
  4. Built "My requests" list below, reactive via `subscribeRequests({ hospitalId })`, sorted newest first, with instant selection.
  5. Implemented fulfilled state success card: "Fulfilled by the blood centre." with "Send Uyir chain message" opening prefilled `wa.me` link without storing the family's phone number.
  6. Added comprehensive test suite in `frontend/src/features/hospital/HospitalPage.test.tsx` verifying validation, raising a 2-unit request with "need 2", cancellation modal, and fulfilled Uyir chain action. All 61 unit tests pass.
  7. Verified visual layout in browser subagent at 1280px desktop and 360px mobile viewports, saving screenshot to `docs/images/hospital.png`. All 61 unit tests pass, lint clean, production build clean.
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/hospital.png`
  - `frontend/src/features/hospital/HospitalPage.tsx`
  - `frontend/src/features/hospital/HospitalPage.test.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
- **Commit Hash:** 16de2a5
- **Human Review:** Hospital blood request desk, live coverage progress banner, cancellation dialog, and Uyir chain message verified cleanly.

### Entry #6
- **Date:** 2026-10-14
- **Goal:** Build /centre: staff see call rounds live, accept or defer donors, follow the timeline, and switch on the weather alert.
- **Prompt Summary:**
  1. Built the Blood Centre staff operations screen in `frontend/src/features/centre/CentrePage.tsx` with header: "Sample Blood Centre (demo)".
  2. Implemented the weather alert switch (`@radix-ui/react-switch`) labelled "IMD orange alert (rain)", calling `api.setWeatherAlert`. When toggled on, displays the safety note: "Calls now include: If roads near you are unsafe because of rain, please press 2."
  3. Integrated active blood requests list (`api.subscribeRequests({ centreId })`) with blood group, component, units needed, and `StatusBadge`. Clicking any card selects it for live monitoring.
  4. Selected request workspace displays:
     - `ProgressBanner` showing covered vs N+1 target and accepted vs N target.
     - Text "Round {round}" with status badge.
     - Warning note when `PAUSED`: "Enough donors on the way. Calling paused. U2U will call again if someone drops out."
     - Fulfilled state card when `FULFILLED`: "Target of {unitsNeeded} units clinically accepted. Request Fulfilled."
     - Live call rows (`api.subscribeCalls`) showing donor alias, distance in km, ETA chip, and state. Full phone numbers are never displayed.
     - Primary "Accept" button and secondary "Defer" button on `ON_THE_WAY` rows.
     - Deferral modal (`@radix-ui/react-dialog`) with optional return date input calling `api.deferCall`.
     - Mandatory screening note under actions: "Accept only after your own screening. U2U never decides eligibility."
  5. Built adaptive event timeline (`api.subscribeEvents`): rendered inside a dedicated tab on mobile viewports (< 1024px) via Radix Tabs, and as a sticky right column at 1024px and wider, with new events fading in smoothly.
  6. Applied `aria-live="polite"` across all live counters, status banners, and event logs.
  7. Built comprehensive test suite in `frontend/src/features/centre/CentrePage.test.tsx` verifying all interactions, including the mock engine test where three press 1s lead to PAUSED and accepting two donors leads to FULFILLED. All 70 unit tests pass.
  8. Verified browser flow: clicked "Run the story" in demo banner, confirmed automated 5-step scenario completed, and verified `/centre` ends with Fulfilled. Saved screenshot to `docs/images/centre.png`.
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/centre.png`
  - `frontend/src/features/centre/CentrePage.tsx`
  - `frontend/src/features/centre/CentrePage.test.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
  - `frontend/src/styles/tokens.css`
- **Commit Hash:** 916ea9e
- **Human Review:** Blood centre staff triage screen verified with live rounds, accept/defer actions, timeline, and weather alert.

### Entry #7
- **Date:** 2026-10-14
- **Goal:** Build /sim: a phone-style simulator so judges can act as a donor.
- **Prompt Summary:**
  1. Built the phone handset simulator screen in `frontend/src/features/sim/SimPage.tsx` with top note: "Demo simulator. In the live system this is a real phone call."
  2. Implemented live ringing calls list subscribed via `api.subscribeSimCalls`. Displays active ringing calls with donor alias, language chip ("EN" / "தமிழ்"), distance, and call state badge. When empty, displays hint: "Raise a request on the Hospital screen, or press Run the story." with quick navigation buttons.
  3. Built phone handset frame card featuring speaker notch, dispatch indicator, donor alias, and the IVR call script in a large font in the donor's language:
     "A patient at {hospitalName} needs {bloodGroup} {component}. Press 1 if you can come in the next few hours. Press 2 if you can't. Press 9 to stop these calls."
  4. Dynamically appends rain advisory line when `weatherAlert` is active: "If roads near you are unsafe because of rain, please press 2."
  5. Implemented interactive `Keypad` with 1 "I'm coming" (வருகிறேன்), 2 "I can't" (இயலாது), and 9 "Stop calling me" (விலகுகிறேன்), calling `api.simPressKey(callId, key)`.
  6. Implemented verbatim post-interaction response screen:
     - Press 1: "Thank you. Please go to {centreName}." and Google Maps directions link placeholder.
     - Press 2: "Thank you for telling us."
     - Press 9: "You won't be called again."
     - LATE_ACCEPT: "Thank you, we already have enough donors."
     - "Answer another ringing call" reset trigger.
  7. Authored comprehensive test suite in `frontend/src/features/sim/SimPage.test.tsx` verifying empty state, ringing calls list, script rendering in English & Tamil, rain line, keypress responses (1, 2, 9, LATE_ACCEPT), and reset. All 79 unit tests pass.
  8. Verified browser flow: visited `/sim`, pressed key 1, verified response screen and Google Maps link, and captured screenshot to `docs/images/sim.png`.
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/sim.png`
  - `frontend/src/features/sim/SimPage.tsx`
  - `frontend/src/features/sim/SimPage.test.tsx`
  - `frontend/src/components/Keypad.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
- **Commit Hash:** cdd689b
- **Human Review:** Donor call simulator verified with live ringing calls, phone handset card, dynamic IVR script, keypad actions, and response states.

### Entry #8
- **Date:** 2026-10-14
- **Goal:** Build /desk: paste a forwarded blood request, get one of three answers, and see exactly what Gemini read and what code decided.
- **Prompt Summary:**
  1. Built the Request Desk screen in `frontend/src/features/desk/DeskPage.tsx` with a big textarea labelled "Paste the message you received" and a live 2,000 character counter.
  2. Added privacy note right under the box: "We don't keep your message. Only the extracted details are checked."
  3. Integrated "Try a sample" chips loading all 6 mock sample messages across English, Tamil, and Tanglish.
  4. Primary button "Check message" dispatches `api.checkDesk(text)` with "Checking…" loading spinner state.
  5. Implemented assertive answer card (`aria-live="assertive"`) rendering one of three deterministic answers with big icons:
     - `VERIFIED_MATCH` (`ShieldCheck`): "This request is verified. Donors are already being called." with "Check live request status" link to `/hospital`.
     - `SENT_TO_HOSPITAL` (`Send`): "We've asked {hospitalName}'s blood bank to confirm. Please also call them." with demo review link to `/confirm/:token`.
     - `NOT_VERIFIED` (`ShieldAlert`): "Couldn't verify. Please call the hospital directly."
     - Remuneration alert when payment words are detected: "This message mentions payment. Blood donation in India is voluntary and unpaid."
  6. Pinned fixed footer stripe on every answer in both English and Tamil:
     "Nobody may charge you for a donor." / "இரத்த தானத்திற்கு யாரும் உங்களிடம் கட்டணம் வசூலிக்கக் கூடாது."
  7. Upgraded collapsible `TracePanel` titled "How U2U checked this":
     - Highlights kept quotes in green `<mark>` tags inside user's raw message.
     - Renders dropped quotes struck through with "not found in the message".
     - Extracted entity matrix with value, quote, and Kept/Dropped badges.
     - "Gemini chose: {geminiChoice}" and "Code decided: {codeDecision}" with high-contrast "Mock" badge when running mock extractor.
     - Explainer callout: "Gemini reads. Code checks every word. Only the hospital and blood centre decide."
  8. Authored unit test suite in `frontend/src/features/desk/DeskPage.test.tsx` testing all 3 sample types, payment warning, bilingual footer stripe, TracePanel, and loading/error states. All 84 unit tests pass.
  9. Verified browser flow: visited `/desk`, clicked "Verified Match (English)", pressed "Check message", confirmed answer card and trace panel, and saved screenshot to `docs/images/desk.png`.
- **Files Changed:**
  - `docs/AI_DESIGN.md`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/desk.png`
  - `frontend/src/features/desk/DeskPage.tsx`
  - `frontend/src/features/desk/DeskPage.test.tsx`
  - `frontend/src/components/TracePanel.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
- **Commit Hash:** 4c55760
- **Human Review:** Request Desk verified with three deterministic answers, payment protection warning, bilingual footer, and transparent Gemini trace panel.

### Entry #9
- **Date:** 2026-10-14
- **Goal:** Build /confirm/:token for hospital blood banks and /join for donor signup with consent.
- **Prompt Summary:**
  1. Built `/confirm/:token` in `frontend/src/features/confirm/ConfirmPage.tsx`:
     - Displays request preview: destination hospital name, blood group, component, units needed, masked patient reference (`patientRefMasked`), and token expiration status.
     - Actions: Primary button "Raise this request" (`api.confirmRequest(token, 'RAISE')`) and ghost button "Not our patient" (`api.confirmRequest(token, 'NOT_OUR_PATIENT')`).
     - Result states: `raised` (with a status link to `/hospital`), `rejected` ("Not our patient"), and `expired or used link` ("This confirmation link has expired, was already used, or is invalid.").
     - In `/desk`, updated `SENT_TO_HOSPITAL` demo review link to "Demo: open the hospital's confirm link" in demo mode.
  2. Built `/join` in `frontend/src/features/join/JoinPage.tsx`:
     - `LangToggle` at top right for seamless switching between English and Tamil.
     - Upfront data collection & privacy notice: what is collected, why, how to withdraw (press 9 on any automated call or visit `/join`), and grievance officer placeholder (`grievance@uyir2uyir.org`).
     - Form fields: Name, phone number, blood group select, area / PIN code, outreach language, and optional last donation date.
     - Two separate unticked `ConsentCheckbox`es:
       - Urgent contact consent: "U2U may call me when someone near me needs my blood group." (mandatory to join)
       - Donation history consent: "U2U may keep my donation history so I'm not called too early." (optional)
     - 18+ attestation checkbox: "I confirm that I am 18 years of age or older." (mandatory to join).
     - "Join" button strictly disabled until urgent-contact consent and 18+ attestation are checked and all required fields are valid.
     - Phone number validation strictly enforces 10-digit Indian mobile numbers.
     - Privacy guarantee: Phone number is **never displayed back** on the success screen or in any public/staff view.
     - Success screen: "You're in. Your donor name is {donorAlias}. You'll only be called when you match and it's safe for you to donate."
     - Demo mode disclaimer: "Demo: nothing is sent and no call will be made."
  3. Documentation & Verification:
     - Documented consent architecture and updated `docs/PRIVACY_SAFETY.md` with a "Consent screen" section and screenshot.
     - Captured browser screenshot of `/join` in Tamil and saved to `docs/images/join.png`.
     - Authored unit test suites in `ConfirmPage.test.tsx` (4 tests) and `JoinPage.test.tsx` (4 tests, verifying Join disabled without consent, phone validation, and phone number suppression).
     - All 92 unit tests pass across 14 test files, lint clean with 0 warnings, and production build clean.
- **Files Changed:**
  - `docs/PRIVACY_SAFETY.md`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/join.png`
  - `frontend/src/features/confirm/ConfirmPage.tsx`
  - `frontend/src/features/confirm/ConfirmPage.test.tsx`
  - `frontend/src/features/join/JoinPage.tsx`
  - `frontend/src/features/join/JoinPage.test.tsx`
  - `frontend/src/features/desk/DeskPage.tsx`
  - `frontend/src/features/desk/DeskPage.test.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
- **Commit Hash:** 9646a41
- **Human Review:** Hospital blood bank confirmation flow and voluntary donor signup with purpose-specific consent verified.

### Entry #10
- **Date:** 2026-10-14
- **Goal:** Build /impact and /eval, and make "Run the story" a smooth judge experience.
- **Prompt Summary:**
  1. Updated mock metrics computation in `src/api/mock/engine.ts`:
     - Defined `BROADCAST_BASELINE` assumption constant (`toFirstOnTheWay: 45`, `toCovered: 90`, `toFulfilled: 180`) with thorough clinical comments.
     - Enhanced `addEvent` to advance request-specific simulated minutes and space event timestamps accordingly.
     - Implemented `getMetrics()` computing real numbers from the mock engine's recorded timeline events (`this.events`) rather than static numbers.
  2. Built `/impact` screen in `frontend/src/features/impact/ImpactPage.tsx`:
     - Displayed prominent top label: "Simulated data from demo runs".
     - Built 3 core `StatTile`s: "Time to first donor on the way", "Time to covered", and "Time to fulfilled", with baseline comparison lines beneath and percentage faster calculations.
     - Added secondary operational metrics: "Calls per accepted donor" and "Stand-down reach".
     - Added empty state notice with run-story trigger and baseline methodology card.
  3. Built `/eval` screen in `frontend/src/features/eval/EvalPage.tsx`:
     - Displayed prominent label at top: "Sample: replaced by the real backend eval run".
     - Built summary tiles: total evaluated (50), accuracy (98%), payment to hospital (0, target 0), wrong hospital IDs (0, target 0), and p95 latency (840ms).
     - Documented clinical guardrails policy explaining NBTC zero-payment mandate and zero hallucinated hospital IDs.
     - Built responsive test case results table with test IDs, expected vs extracted decisions, and green PASS status badges.
  4. Story & DemoBanner Polish:
     - Added real-time animated step indicator in `DemoBanner` using `onStep` callback ("Step 1 of 5", ..., "Step 5 of 5").
     - Configured "Run the story" to navigate immediately to `/centre` so evaluators observe live round dialing, $N+1$ pause, staff screening, reopen, and fulfillment.
     - Added "Reset demo" button next to "Run the story" invoking `api.reset()`.
  5. Verification & Documentation:
     - Authored unit test suites in `ImpactPage.test.tsx` and `EvalPage.test.tsx`. 95 unit tests pass cleanly across 16 test files.
     - Verified browser walkthrough: Ran demo story, verified `/centre`, verified non-zero metrics on `/impact`, and verified `/eval`.
     - Saved screenshots to `docs/images/impact.png` and `docs/images/eval.png`.
     - Updated `docs/DEMO.md` with exact click script for evaluators.
- **Files Changed:**
  - `docs/DEMO.md`
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/images/impact.png`
  - `docs/images/eval.png`
  - `frontend/src/api/client.ts`
  - `frontend/src/api/mock/index.ts`
  - `frontend/src/api/mock/engine.ts`
  - `frontend/src/components/DemoBanner.tsx`
  - `frontend/src/features/impact/ImpactPage.tsx`
  - `frontend/src/features/impact/ImpactPage.test.tsx`
  - `frontend/src/features/eval/EvalPage.tsx`
  - `frontend/src/features/eval/EvalPage.test.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
- **Commit Hash:** eeb3db5
- **Human Review:** Impact dashboard, AI verification benchmarks, and guided story mode verified.

### Entry #11
- **Date:** 2026-10-14
- **Goal:** Make every screen solid on a cheap Android phone (360px viewport), in Tamil, in dark mode, and with a screen reader.
- **Prompt Summary:**
  1. Per-route accessibility & responsiveness audit:
     - 360px viewport responsiveness: Verified zero horizontal overflow (`scrollWidth <= window.innerWidth`).
     - 48px tap targets: Bumped `Toast` close button to `min-w-[48px] min-h-[48px]`, `HospitalPage` action buttons to `min-h-[48px]`, ensured buttons, inputs, switches, tabs, and keypad comply with mobile touch guidelines.
     - Visible focus rings: `3px solid var(--info)` with 2px offset on all focusable elements.
     - Form labels: Attached explicit `<label for="...">` or `<Field id="...">` to every input.
     - Heading hierarchy: Single semantic `<h1>` on every route with matching accessible names (`aria-label`) and strictly nested `<h2>`/`<h3>` tags.
     - Tamil font & language tagging: Tagged Tamil nodes with `lang="ta"`, prioritized Tamil typography (`Tiro Tamil`, `Noto Sans Tamil`, `Latha`).
     - Non-color signals: Paired status colors with distinct Lucide icons (`CheckCircle2`, `Clock`, `ShieldAlert`, `PhoneCall`, `XCircle`) and text labels.
  2. State management & offline resilience:
     - Implemented empty, loading (`RouteLoadingFallback`, `Skeleton`), and error state recovery handlers across routes.
     - Added global offline banner in `AppShell` driven by `navigator.onLine` and `window` event listeners (`online` / `offline`).
  3. Reduced motion:
     - Implemented `@media (prefers-reduced-motion: reduce)` in `index.css` to disable CSS animations and transitions for sensitive users.
  4. Automated `axe-core` accessibility testing:
     - Authored `frontend/src/accessibility.test.tsx` testing 11 routes (`/`, `/hospital`, `/centre`, `/desk`, `/confirm/:token`, `/join`, `/sim`, `/impact`, `/eval`, `/styleguide`, `404`).
     - Zero serious or critical violations across all 11 routes.
  5. Color contrast audit:
     - Validated all design system token pairs mathematically in light (6.0:1 to 17.2:1) and dark (6.39:1 to 18.2:1) themes against WCAG AA standards.
  6. Internationalization dictionary audit:
     - Externalized remaining hardcoded strings in `LandingPage` and `HospitalPage` into `en.ts` and `ta.ts` dictionaries.
  7. Route lazy loading & performance:
     - Configured `React.lazy()` and `<Suspense>` in `routes.tsx` for all routes.
     - Main bundle chunk: 311.27 kB (gzip: 98.71 kB); route chunks: 7–28 kB.
  8. Verification:
     - 106 passing tests across 17 test suites with Vitest.
     - Oxlint clean with 0 warnings, 0 errors.
     - Headless browser audit of `/centre` and `/desk` at 360px viewport in dark mode and Tamil (`lang="ta"`).
- **Files Changed:**
  - `docs/FRONTEND.md`
  - `docs/PROMPTS.md`
  - `docs/TESTING.md`
  - `frontend/src/App.test.tsx`
  - `frontend/src/accessibility.test.tsx`
  - `frontend/src/components/AppShell.tsx`
  - `frontend/src/components/DemoBanner.tsx`
  - `frontend/src/components/Toast.tsx`
  - `frontend/src/features/hospital/HospitalPage.tsx`
  - `frontend/src/features/impact/ImpactPage.tsx`
  - `frontend/src/features/eval/EvalPage.tsx`
  - `frontend/src/features/join/JoinPage.tsx`
  - `frontend/src/features/landing/LandingPage.tsx`
  - `frontend/src/features/styleguide/StyleguidePage.tsx`
  - `frontend/src/i18n/en.ts`
  - `frontend/src/i18n/ta.ts`
  - `frontend/src/routes.tsx`
- **Commit Hash:** 236ac34
- **Human Review:** Full accessibility, responsive design, contrast, and internationalization pass verified.

### Entry #B0
- **Date:** 2026-10-15
- **Goal:** Scaffold the FastAPI backend in `backend/` with settings, health and config endpoints, lint, tests and a Dockerfile. No business logic yet.
- **Prompt Summary:**
  1. Configured Python 3.12 dependency specifications in `backend/pyproject.toml`, `backend/requirements.txt`, and `backend/requirements-dev.txt` with pinned major versions of allowed libraries (`fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `google-cloud-firestore`, `google-genai`, `google-cloud-texttospeech`, `firebase-admin`, `httpx`, `pytest`, `pytest-asyncio`, `hypothesis`, `ruff`). Created `backend/.venv` and installed all dependencies.
  2. Built `backend/app/main.py` with application factory `create_app()`, CORS middleware allowing `http://localhost:5173` and `ALLOWED_ORIGINS` values, `GET /healthz` health endpoint returning `{"status": "ok"}`, and `GET /config` endpoint returning `AppConfig` (`dataMode`, `bannerText`, `weatherAlert`).
  3. Implemented `backend/app/core/config.py` using `pydantic-settings` `Settings`, parsing `CALL_ALLOWLIST` and `ALLOWED_ORIGINS` as plain strings with helper split properties, and reading `GEMINI_MODEL` without hardcoded default.
  4. Implemented `backend/app/core/mode_guard.py` verifying that `DATA_MODE=live` connects to `FIRESTORE_DB=u2u-live` and `DATA_MODE=demo` connects to `FIRESTORE_DB=u2u-demo`, raising `ModeGuardError` on any mismatch.
  5. Created `backend/app/core/models.py` with `CamelModel` base model configured with `alias_generator=to_camel` and `populate_by_name=True` to guarantee strict camelCase parity across all JSON outputs and Firestore records.
  6. Built `backend/app/core/logging.py` featuring structured JSON logging, an automated phone number redaction filter (`redact_phone_numbers`), and a custom 422 `RequestValidationError` handler that strips raw request body input to prevent PII/health leaks in error responses.
  7. Authored `backend/Dockerfile` based on `python:3.12-slim` with non-root user `appuser`, Cloud Run proxy headers, and created `backend/.dockerignore`.
  8. Created `backend/.env.example` with safe placeholder environment values.
  9. Authored `backend/AGENTS.md` (3.4k chars) codifying backend rules: public module encapsulation, requests module status authority, no network calls in Firestore transactions, camelCase JSON, phone redaction, Gemini isolation, and demo endpoint guards.
  10. Authored `backend/Makefile` with `dev`, `test`, and `lint` targets.
  11. Wrote 13 unit tests in `backend/tests/` verifying `/healthz`, `/config` in demo and live modes, `ModeGuardError` refusal on mismatches, phone redaction, and 422 input stripping. All 13 tests pass in 0.27s. Ruff lint and format checks pass with 0 errors.
  12. Documented backend layout in `docs/ARCHITECTURE.md` and added "Run the backend locally" in `README.md`.
- **Files Changed:**
  - `README.md`
  - `backend/.dockerignore`
  - `backend/.env.example`
  - `backend/AGENTS.md`
  - `backend/Dockerfile`
  - `backend/Makefile`
  - `backend/README.md`
  - `backend/app/core/config.py`
  - `backend/app/core/logging.py`
  - `backend/app/core/mode_guard.py`
  - `backend/app/core/models.py`
  - `backend/app/main.py`
  - `backend/pyproject.toml`
  - `backend/requirements.txt`
  - `backend/requirements-dev.txt`
  - `backend/tests/conftest.py`
  - `backend/tests/test_health_and_config.py`
  - `backend/tests/test_logging_and_models.py`
  - `backend/tests/test_mode_guard.py`
  - `docs/ARCHITECTURE.md`
  - `docs/BACKEND.md`
  - `docs/PROMPTS.md`
- **Commit Hash:** 0e902d6
- **Human Review:** Backend scaffold, settings, mode guard, logging, and test suite verified.

### Entry #B1
- **Date:** 2026-10-15
- **Goal:** Write the pure domain logic (no database, no network): the models, the counting rule, and the request and call state machines, proven with property-based tests.
- **Prompt Summary:**
  1. Built Pydantic models in `backend/app/requests/models.py` (`BloodRequest`, `Call`, `TimelineEvent`, and enums `BloodGroup`, `Component`, `RequestStatus`, `CallState`, `Lang`), matching `docs/API_CONTRACT.md` field for field with `CamelModel` alias generation.
  2. Implemented pure counting functions in `backend/app/requests/counting.py`: `covered(accepted, on_the_way)` and `next_status(status, units_needed, accepted, on_the_way)`, enforcing: pause when covered >= N + 1, reopen when covered < N, fulfil when accepted >= N, gap-zone stability, and immutable terminal states. Provided a worked example for N = 2 in the docstring.
  3. Implemented pure transition functions and side effect intents in `backend/app/requests/transitions.py`: `apply_press_1`, `apply_press_2`, `apply_press_9`, `apply_staff_accept`, `apply_staff_defer`, `apply_call_no_answer`, `apply_reminder_press_2`, `apply_hospital_cancel`, `apply_expire`. Handled LATE_ACCEPT on PAUSED/FULFILLED, WITHDRAW_CONSENT on Press 9, round-two reopening, and cancellation of ringing calls with donor thank-yous upon fulfillment. Raised `IllegalTransition` for invalid operations.
  4. Implemented clinical compatibility and contact rules in `backend/app/rules/`: `compatibility.py` (ABO/Rh matrix per component) and `contact.py` (90-day minimum donation interval and opt-out suppression), both marked `STATUS = "DEMO_UNAPPROVED"` with the replacement disclaimer comment.
  5. Implemented comprehensive test suites in `backend/tests/domain/`:
     - `test_models.py`: JSON field name and enum parity against API contract fixtures (4 tests).
     - `test_counting.py`: 40 table tests covering every counting transition and terminal state immutability.
     - `test_story.py`: Exact replay of U2U_BRIEF.md Section 7 demo story (OPEN -> PAUSED -> OPEN -> FULFILLED with D and E as LATE_ACCEPT).
     - `test_rules.py`: Universal donor/recipient and contact date tests (8 tests).
     - `test_property.py`: Hypothesis `RuleBasedStateMachine` running 200 stateful examples across 5 domain invariants plus illegal transition rejection tests (2 tests).
  6. Linked state machine diagrams in `docs/ARCHITECTURE.md` to `transitions.py` and updated `docs/TESTING.md` with benchmark pass counts.
- **Files Changed:**
  - `backend/app/requests/counting.py`
  - `backend/app/requests/models.py`
  - `backend/app/requests/transitions.py`
  - `backend/app/rules/compatibility.py`
  - `backend/app/rules/contact.py`
  - `backend/tests/domain/test_counting.py`
  - `backend/tests/domain/test_models.py`
  - `backend/tests/domain/test_property.py`
  - `backend/tests/domain/test_rules.py`
  - `backend/tests/domain/test_story.py`
  - `docs/ARCHITECTURE.md`
  - `docs/TESTING.md`
  - `docs/PROMPTS.md`
- **Commit Hash:** 979b8b3
- **Human Review:** [Pending line-by-line review of counting.py by human]

### Entry #B2
- **Date:** 2026-10-15
- **Goal:** Add a storage interface with two implementations, in-memory (tests and offline development) and Firestore (named database, async, transactional), plus a seed script with simulated data.
- **Prompt Summary:**
  1. Created `backend/app/core/entities.py` defining Pydantic models `Hospital`, `Centre`, and `Donor` matching `docs/ARCHITECTURE.md` and `frontend/src/api/mock/fixtures.ts`.
  2. Created `backend/app/core/store.py` with `Store` and `TransactionStore` protocols featuring async methods for hospital, centre, donor, request, call, event, and config persistence, plus transaction execution and store factory `get_store()`.
  3. Created `backend/app/core/store_memory.py` implementing thread-safe and coroutine-safe in-memory storage guarded by `asyncio.Lock`, with `MemoryTransactionStore` supporting staged writes and atomic rollback on exception.
  4. Created `backend/app/core/store_firestore.py` implementing `FirestoreStore` using `google.cloud.firestore.AsyncClient(project=..., database=settings.FIRESTORE_DB)` with `@firestore.async_transactional` transaction support. Enforces read-before-write safety and adds `dataMode` and `isSimulated` to all documents.
  5. Added `STORE` option to `backend/app/core/config.py` (`memory` or `firestore`, defaulting to `memory`).
  6. Implemented `backend/scripts/seed.py` mirroring frontend mock fixtures: 3 fictional Chennai hospitals, 2 blood centres, 30 donors (`Donor A1`..`Donor C10`), and `config/app`. Guarded by hard exit refusal when `DATA_MODE=live`.
  7. Authored `infra/firestore.demo.rules` enforcing read-only demo access with `request.auth.token.env == 'demo'`, hospital-scoped and centre-scoped request access, collection-group access for `RINGING` calls, and deny-all on PII/secrets.
  8. Authored `infra/firestore.indexes.json` configuring composite indexes for `requests` by `hospitalId+createdAt` and `centreId+createdAt`, and collection-group indexing on `calls.state`.
  9. Added comprehensive tests in `backend/tests/test_store.py`: CRUD, query filters, transaction rollback, full Section 7 story replay through `run_transaction`, and optional Firestore emulator concurrency test.
  10. Updated `docs/ARCHITECTURE.md`, `README.md`, `backend/README.md`, and `docs/TESTING.md`.
- **Files Changed:**
  - `backend/app/core/config.py`
  - `backend/app/core/entities.py`
  - `backend/app/core/store.py`
  - `backend/app/core/store_firestore.py`
  - `backend/app/core/store_memory.py`
  - `backend/pyproject.toml`
  - `backend/scripts/seed.py`
  - `backend/tests/test_store.py`
  - `infra/firestore.demo.rules`
  - `infra/firestore.indexes.json`
  - `README.md`
  - `backend/README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TESTING.md`
  - `docs/PROMPTS.md`
- **Commit Hash:** [pending]
- **Human Review:** Storage interface, memory/firestore stores, seed script, security rules, and tests verified.

---

## Human Decisions

- **Hospital-first requests:** Only registered hospitals can initiate blood requests. Public message submissions at the Request Desk can at most send a one-tap "Raise this request?" alert to a registered hospital blood bank; public text never directly triggers donor calls.
- **The counting rule $N+1$:** Outreach pauses as soon as covered ($\text{accepted} + \text{onTheWay}$) reaches $N + 1$ (providing one spare donor). Outreach reopens if covered falls below $N$. The request is fulfilled when accepted reaches $N$, standing down any donors still en route.
- **Staff-only acceptance:** Blood centre staff make all medical eligibility, acceptance, and deferral decisions upon donor arrival. The application and AI models never make automated clinical clearance or acceptance decisions.
- **No fuzzy hospital matching:** Gemini extracts hospital names and fields with exact verbatim quotes from forwarded message text. Code matches strictly against a predetermined catalog or marks the message as `NOT_VERIFIED`. No fuzzy heuristics or hallucinated hospital matching are permitted.
- **Simulated data labelling:** In demo mode, all donors, hospitals, and patients are explicitly labelled as simulated. An orange `SIMULATED DATA` banner is prominently displayed across all application screens.
