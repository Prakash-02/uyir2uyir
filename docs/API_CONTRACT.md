# U2U API Contract

> **Status:** planned (Frontend and backend implementations mirror this contract)

This document contains the canonical API contract between the U2U frontend and backend services, transcribed verbatim from Section 5 of `U2U_BRIEF.md`.

All TypeScript types defined in `frontend/src/api/types.ts` and all Pydantic models defined in `backend/app/` must conform strictly to these definitions.

---

## 1. Verbatim TypeScript Types

```ts
type BloodGroup = 'A+'|'A-'|'B+'|'B-'|'AB+'|'AB-'|'O+'|'O-';
type Component = 'WHOLE_BLOOD'|'RED_CELLS'|'PLATELETS_SDP'|'PLATELETS_RDP'|'PLASMA'|'UNSPECIFIED';
type RequestStatus = 'AWAITING_HOSPITAL'|'OPEN'|'PAUSED'|'FULFILLED'|'EXPIRED'|'CANCELLED'|'REJECTED';
type CallState = 'QUEUED'|'DIALING'|'RINGING'|'ON_THE_WAY'|'ACCEPTED'|'DEFERRED'|'DECLINED'
  |'NO_ANSWER'|'UNKNOWN'|'OPTED_OUT'|'LATE_ACCEPT'|'CANCELLED';
type Lang = 'en'|'ta';

interface AppConfig { dataMode: 'demo'|'live'; bannerText: string|null; weatherAlert: boolean; }

interface BloodRequest {
  id: string; hospitalId: string; hospitalName: string; centreId: string; centreName: string;
  bloodGroup: BloodGroup; component: Component; unitsNeeded: number;
  status: RequestStatus; accepted: number; onTheWay: number; round: number;
  createdAt: string; updatedAt: string; expiresAt: string; isSimulated: boolean;
}  // patientRef exists only in the hospital and staff view: patientRef?: string

interface Call {
  id: string; requestId: string; donorAlias: string; bloodGroup: BloodGroup; lang: Lang;
  state: CallState; round: number; etaMinutes: number|null; distanceKm: number;
  updatedAt: string;
}

type PublicStatus = Pick<BloodRequest, 'id'|'hospitalName'|'bloodGroup'|'component'|'status'>;
type ConfirmAction = 'RAISE'|'NOT_OUR_PATIENT';
type SimKey = '1'|'2'|'9';

interface RequestPreview {
  hospitalName: string; bloodGroup: BloodGroup; component: Component;
  unitsNeeded: number; patientRefMasked: string; expiresAt: string;
}

interface TimelineEvent { id: string; requestId: string; at: string; kind: string; text: string; }

interface QuotedField<T> { value: T|null; quote: string|null; kept: boolean; }
interface DeskResult {
  answer: 'VERIFIED_MATCH'|'SENT_TO_HOSPITAL'|'NOT_VERIFIED';
  message: string; requestId?: string; hospitalName?: string;
  trace: {
    hospital: QuotedField<string>; patientNumber: QuotedField<string>;
    bloodGroup: QuotedField<BloodGroup>; component: QuotedField<Component>;
    units: QuotedField<number>; paymentPhrases: string[];
    geminiChoice: string; codeDecision: string;
  };
  footer: 'Nobody may charge you for a donor.';
  demoConfirmToken?: string;   // demo mode only, so judges can open the hospital confirm link
}

interface Metrics {
  requests: number;
  medianMinutesToFirstOnTheWay: number; medianMinutesToCovered: number; medianMinutesToFulfilled: number;
  baseline: { toFirstOnTheWay: number; toCovered: number; toFulfilled: number };
  callsPerAccepted: number; standDownReachPct: number; isSimulated: boolean;
}

interface EvalResult {
  promptVersion: string; runAt: string; total: number; correct: number;
  paymentToHospital: number; wrongHospitalIds: number; p95LatencyMs: number;
  rows: { id: string; expected: string; got: string; pass: boolean }[];
}
```

---

## 2. API Endpoints Table

| Method and path | Who | Request body | Response | Status & Implementation |
|---|---|---|---|---|
| `GET /healthz` | Anyone | none | `{"status": "ok"}` | Built (`backend/app/main.py`) |
| `GET /config` | Anyone | none | `AppConfig` | Built (`backend/app/main.py`) |
| `POST /requests` | Hospital | `{bloodGroup, component, unitsNeeded, patientRef}` | `BloodRequest` | Built (`backend/app/requests/router.py`) |
| `POST /requests/{id}/cancel` | Hospital | none | `BloodRequest` | Built (`backend/app/requests/router.py`) |
| `GET /requests/{id}/status` | Public | none | `PublicStatus` | Built (`backend/app/requests/router.py`) |
| `POST /desk/check` | Public | `{text}` (max 2,000 chars) | `DeskResult` | Planned |
| `GET /confirm/{token}` | Hospital blood bank | none | `RequestPreview` | Planned |
| `POST /confirm` | Hospital blood bank | `{token, action: ConfirmAction}` | `BloodRequest` or `{status:'REJECTED'}` | Planned |
| `POST /sim/calls/{callId}/press` | Simulator (demo) | `{key: SimKey}` | `Call` | Built (`backend/app/outreach/router.py`) |
| `POST /calls/{callId}/accept` | Staff | none | `Call` | Built (`backend/app/screening/router.py`) |
| `POST /calls/{callId}/defer` | Staff | `{returnDate?}` | `Call` | Built (`backend/app/screening/router.py`) |
| `POST /internal/tick` | Internal / Scheduler | none | `{"status": "ok"}` | Built (`backend/app/clock/router.py`) |
| `POST /donors/signup` | Donor | `{name, phone, bloodGroup, area, lang, lastDonation?, consentUrgent, consentHistory, adult}` | `{donorAlias}` | Planned |
| `GET /metrics` | Staff (demo: any demo user) | none | `Metrics` | Built (`backend/app/screening/metrics.py`) |
| `GET /eval/latest` | Anyone | none | `EvalResult` | Planned |
| `POST /admin/scenario/{id}/run` | Admin, demo | none | `{"ok": true, "scenario": id}` | Built (`backend/app/admin/router.py`) |
| `POST /admin/reset` | Admin, demo | none | `{"ok": true, "reset": true}` | Built (`backend/app/admin/router.py`) |
| `POST /admin/clock/advance` | Admin, demo | `{minutes: int}` | `{"ok": true, "advancedMinutes": minutes, "currentTime": str}` | Built (`backend/app/admin/router.py`) |
| `POST /admin/settings/weather` | Staff | `{on:boolean}` | `AppConfig` | Built (`backend/app/admin/router.py`) |

---

## 3. Realtime Firestore Listeners (Read Only)

The client subscribes directly to Firestore read-only snapshots to reflect real-time operational status without polling:

- **Hospital Screen (`/hospital`):**
  - Collection `requests` filtered by `hospitalId == currentUser.hospitalId`
- **Blood Centre Screen (`/centre`):**
  - Collection `requests` filtered by `centreId == currentUser.centreId`
  - Subcollections for active request: `requests/{id}/calls` and `requests/{id}/events`
- **Donor IVR Simulator (`/sim`, demo only):**
  - Collection group `calls` query: `where('state', '==', 'RINGING')`
