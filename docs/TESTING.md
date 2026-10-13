# U2U Verification & Test Plan

> **Status:** planned (Test execution framework established; benchmark results pending live test execution)

This document outlines the testing strategy, test suites, evaluation metrics, and safety checks for U2U (Uyir2Uyir).

---

## 1. Test Strategy Overview

Quality assurance for U2U is structured into six verification layers:

1. **Frontend Component & Unit Tests:** Vitest + React Testing Library + jsdom.
2. **Automated Accessibility Testing:** `axe-core` auditing against WCAG 2.1 Level AA compliance.
3. **Deterministic Rule Engine Tests:** Pytest unit tests verifying the $N+1$ counting rule and state machines.
4. **Backend API Integration Tests:** FastAPI TestClient validating endpoint schemas, error handling, and authorization.
5. **Request Desk AI Benchmark:** Labelled test set evaluating extraction accuracy, quote verification, and payment blocking.
6. **End-to-End Scenario Simulation:** Automated execution of the 6-step emergency donor dispatch story.

---

## 2. Test Suites

### 2.1 Frontend Tests (`frontend/tests/`)
- **Commands:**
  ```bash
  cd frontend
  npm run test
  npm run lint
  npm run build
  ```
- **Coverage Areas:**
  - Rendering of all 9 routes (`/`, `/hospital`, `/centre`, `/desk`, `/confirm/:token`, `/join`, `/sim`, `/impact`, `/eval`).
  - Strict display of the orange `"SIMULATED DATA"` banner in demo mode.
  - Form validation: required fields, blood group selection, unselected consent checkboxes.
  - Client-side mock layer fidelity (`mockClient.ts` mirrors $N+1$ rule).
  - Accessibility audit with `axe-core`: color contrast, 48px touch targets, ARIA live region declarations, absence of all-caps Tamil text.

### 2.2 Backend Tests (`backend/tests/`)
- **Commands:**
  ```bash
  cd backend
  pytest -v
  ```
- **Coverage Areas:**
  - **Rule Engine (`backend/app/rules/`):**
    - Pause calculation: Outreach pauses when $\text{accepted} + \text{onTheWay} \ge N + 1$.
    - Reopen calculation: Outreach reopens when covered drops below $N$.
    - Fulfillment trigger: Request transitions to `FULFILLED` when $\text{accepted} \ge N$.
    - Late accept handling: Press 1 received after `PAUSED` or `FULFILLED` transitions call to `LATE_ACCEPT`.
    - Stand down logic: Standing down remaining en route donors upon fulfillment.
  - **API Contract Adherence (`backend/app/`):**
    - Input validation (Pydantic models matching `API_CONTRACT.md`).
    - Character cap on Request Desk input (2,000 characters).
    - Status transitions and permission validation for hospital and staff endpoints.

### 2.3 AI Benchmark & Safety Evaluation (`backend/eval/`)
- **Commands:**
  ```bash
  cd backend
  python -m app.eval.runner
  ```
- **Coverage Areas:**
  - Precision and recall of Gemini Flash entity extraction across English, Tamil, and mixed scripts.
  - Strict verbatim quote verification (100% rejection of unquoted or hallucinated strings).
  - **Financial Safety Blocker:** Zero tolerance for commercial donor solicitation passing through to hospital blood banks (`paymentToHospital == 0`).
  - **Hospital Attribution Integrity:** Zero tolerance for hallucinated or mismatched hospital identifiers (`wrongHospitalIds == 0`).

---

## 3. Results & Metric Benchmarks

In accordance with repo honesty rules, all test results are marked **pending** until verified test suites are executed against the running codebase:

| Verification Suite | Target Benchmark | Actual Status / Result |
|---|---|---|
| Frontend Unit Tests | 100% pass rate | **Status: pending** |
| Accessibility (`axe-core`) | 0 critical / serious violations | **Status: pending** |
| Backend Rule Engine Tests | 100% pass rate | **Status: pending** |
| Backend API Integration | 100% pass rate | **Status: pending** |
| Request Desk Zero-Payment Rule | `paymentToHospital == 0` | **Status: pending** |
| Request Desk Hospital Enum Match | `wrongHospitalIds == 0` | **Status: pending** |
| Request Desk P95 Latency | < 2,500 ms | **Status: pending** |
| E2E 6-Step Scenario Runner | Successful pass through steps 1–5 | **Status: pending** |

---

## 4. Pre-Commit Safety Checklist

Before committing any code change or documentation update, developers and agents must execute the staged-files check specified in `AGENTS.md`:

1. Run `git status` to inspect all untracked and modified files.
2. Run `git diff --cached --name-only` to verify all staged changes.
3. **Safety Gate:** Abort the commit immediately if:
   - Any `.env` file other than `.env.example` is staged.
   - Any credential, private key, or service account file (`*.json`, `*-key.json`, `service-account*.json`) is staged.
4. Verify that lint, build, and test commands pass cleanly with zero errors.
