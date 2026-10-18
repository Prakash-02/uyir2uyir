# U2U (Uyir2Uyir) Project Brief

> Source of truth for the coding agent. Every doc in this repo is derived from this file.
> If code and this brief disagree, stop and ask the human.

## 1. Product in one paragraph

U2U (Uyir2Uyir, "life to life" in Tamil) relays urgent blood requests from verified hospitals to nearby donors who have consented to be contacted, calling 5 donors at a time in Tamil or English until the request is covered. Blood centre staff, not the app, decide who can donate. A public Request Desk lets families paste a forwarded WhatsApp blood request and get one clear, verified answer, powered by one Gemini Flash call whose output is checked word for word by code.

**Ideology:** Life passes on. Freely. Safely. In time.

| Promise | Meaning | Feature that keeps it |
|---|---|---|
| Freely | Life is given, never sold | Every Request Desk answer ends with "Nobody may charge you for a donor." Payment wording blocks the hospital path |
| Safely | Only real requests, only staff decide | Verified hospital requests, centre approved rules, only staff accept, phone numbers hidden |
| In time | No family searching alone at 2 a.m. | Calls 5 donors at a time, pauses when covered, reopens if someone drops out |

**Hackathon:** Google Cloud AI Builder Cup 2026, theme Sustainability and Social Impact. Built with Google Antigravity. Deployed on Firebase Hosting (frontend) and Cloud Run (backend).

**Honesty rule:** all donors, hospitals and patients in the prototype are simulated and labelled. Never claim real users, real partners or measured impact that was not measured.

## 2. Users and screens

| Route | User | Primary action | Notes |
|---|---|---|---|
| `/` | Everyone | Choose a role | Pitch, three promises, role cards, "Run the story" (demo) |
| `/hospital` | Hospital staff | Raise request | Form: blood group, component, units, patient ref (never shown publicly). Then a live progress banner "1 on the way of 2" and a mini timeline |
| `/centre` | Blood centre staff | Accept or defer an arriving donor | Request list, call rows per donor, live event timeline, weather alert switch "IMD orange alert" |
| `/desk` | Public (families, volunteers) | Check message | Paste text, get one of three answers, Gemini trace panel, fixed footer "Nobody may charge you for a donor." |
| `/confirm/:token` | Hospital blood bank | Raise this request | Or "Not our patient". Single use link |
| `/join` | Donor | Join | English and Tamil, two unticked consents, 18+ attestation |
| `/sim` | Demo only | Press 1, 2 or 9 | Phone frame call simulator showing the call script |
| `/impact` | Staff, judges | none | 3 numbers: time to first donor on the way, time to covered, time to fulfilled, each vs a simulated "broadcast to everyone" baseline |
| `/eval` | Judges | none | Results of the labelled Request Desk test set |

Demo mode shows an orange "SIMULATED DATA" banner on every page. Banner text comes from the server config, never hardcoded to hide.

## 3. Core rules (the backend owns these; the frontend mock imitates them)

```
N        = units needed
covered  = ACCEPTED + ON_THE_WAY
pause    when covered >= N + 1      (one spare donor)
reopen   when covered <  N
fulfil   when ACCEPTED >= N         (everyone still on the way is thanked and stood down)
```

Request states: `AWAITING_HOSPITAL, OPEN, PAUSED, FULFILLED, EXPIRED, CANCELLED, REJECTED`.
Only a hospital can start calls. A public paste can at most send a one-tap "Raise this request?" alert to a registered hospital.

Call states: `QUEUED, DIALING, RINGING, ON_THE_WAY, ACCEPTED, DEFERRED, DECLINED, NO_ANSWER, UNKNOWN, OPTED_OUT, LATE_ACCEPT, CANCELLED`.
Press 1 = coming, press 2 = can't (including unsafe roads), press 9 = stop calling me. A press 1 after PAUSED or FULFILLED becomes LATE_ACCEPT ("thank you, we have enough").

Request Desk answers (exactly three):
1. `VERIFIED_MATCH`: matches a verified request (hospital ID + patient number + component).
2. `SENT_TO_HOSPITAL`: names a registered hospital, so a one-tap alert goes to its blood bank.
3. `NOT_VERIFIED`: "Couldn't verify. Please call the hospital."

## 4. Architecture summary

- **Modular monolith.** `backend/`: Python 3.12 FastAPI on Cloud Run, modules `auth, requests, rules, matching, outreach, screening, desk, ai, clock` plus `core/`.
- **Frontend.** `frontend/`: React + TypeScript + Vite on Firebase Hosting. Reads live data from Firestore (read only). All writes go through the API.
- **Data:** Firestore, two named databases: `u2u-demo` and `u2u-live`. `DATA_MODE=demo|live` chooses one per deployment. Simulated records carry `is_simulated: true`.
- **AI:** Gemini Flash on Vertex AI (asia-south1), temperature 0, JSON schema, hospital chosen from a fixed list or NONE, every field returned with its exact quote. Code drops any quote not found word for word. Gemini never decides status, match or validity.
- **Calls:** Real Twilio calls go to verified team phones only; judges use the browser call on `/sim`. Twilio is only the phone line; all understanding and speech is Google (Gemini Live and Cloud Text-to-Speech). In-country telephony via an Indian provider (e.g. Exotel) is roadmap.
- **Other Google services:** Firebase Authentication (custom claims `role`, `hospitalId` or `centreId`, `env`), Secret Manager, Cloud Scheduler (1 minute tick), Cloud Logging.
- **Privacy:** donors are shown as aliases ("Donor A7"). Staff see the last 4 digits at most. Pasted text is discarded after extraction. Consent is recorded per purpose.

## 5. API contract (frontend relies on exactly these shapes)

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

| Method and path | Who | Request body | Response |
|---|---|---|---|
| `GET /config` | Anyone | none | `AppConfig` |
| `POST /requests` | Hospital | `{bloodGroup, component, unitsNeeded, patientRef}` | `BloodRequest` |
| `POST /requests/{id}/cancel` | Hospital | none | `BloodRequest` |
| `GET /requests/{id}/status` | Public | none | `PublicStatus` |
| `POST /desk/check` | Public | `{text}` (max 2,000 chars) | `DeskResult` |
| `GET /confirm/{token}` | Hospital blood bank | none | `RequestPreview` |
| `POST /confirm` | Hospital blood bank | `{token, action: ConfirmAction}` | `BloodRequest` or `{status:'REJECTED'}` |
| `POST /sim/calls/{callId}/press` | Simulator (demo) | `{key: SimKey}` | `Call` |
| `POST /calls/{callId}/accept` | Staff | none | `Call` |
| `POST /calls/{callId}/defer` | Staff | `{returnDate?}` | `Call` |
| `POST /donors/signup` | Donor | `{name, phone, bloodGroup, area, lang, lastDonation?, consentUrgent, consentHistory, adult}` | `{donorAlias}` |
| `GET /metrics` | Staff | none | `Metrics` |
| `GET /eval/latest` | Anyone | none | `EvalResult` |
| `POST /admin/scenario/{id}/run` | Admin, demo | none | `{ok:true}` |
| `POST /admin/reset` | Admin, demo | none | `{ok:true}` |
| `POST /admin/settings/weather` | Staff | `{on:boolean}` | `AppConfig` |

Live data (Firestore listeners, read only):
- `requests` collection, filtered by `hospitalId` (hospital screen) or `centreId` (staff screen)
- `requests/{id}`, `requests/{id}/calls`, `requests/{id}/events`
- collection group `calls` where `state` is `RINGING` (simulator list, demo only)

## 6. Design system

**Direction:** warm paper and ink with one crimson thread. Calm neutrals carry the screens, and crimson is reserved for the logo, the single primary action and the hero numbers. Never a full red background, because it causes alarm fatigue.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FBF8F4` | `#141110` |
| `--surface` | `#FFFFFF` | `#1E1A18` |
| `--text` | `#1C1917` | `#F3EEE9` |
| `--muted` | `#5F5853` | `#A9A19A` |
| `--border` | `#E4DDD5` | `#3A332F` |
| `--primary` | `#B3122E` | `#FF6B7D` |
| `--primary-on` | `#FFFFFF` | `#1C1917` |
| `--success` / `--success-tint` | `#17663A` / `#E6F4EC` | `#5FD08E` / `#15281D` |
| `--warning` / `--warning-tint` | `#8A4B00` / `#FDF1DC` | `#F5B54A` / `#33240F` |
| `--danger` / `--danger-tint` | `#B42318` / `#FDECEA` | `#FF8A7A` / `#3A1A17` |
| `--info` / `--info-tint` | `#1D5FA8` / `#E8F0FA` | `#7FB4F0` / `#16233A` |
| `--demo` (banner bg, text `#1C1917`) | `#F97316` | `#FB923C` |

Danger colour only on desk answer 3 and terminal failure badges.

**Status mapping** (icon + word, never colour alone; lucide-react icons):
- OPEN = info + Radio, "Calling donors"
- PAUSED = warning + PauseCircle, "Enough on the way"
- FULFILLED = success + CheckCircle2, "Fulfilled"
- AWAITING_HOSPITAL = warning + Hourglass, "Waiting for hospital"
- EXPIRED, CANCELLED and REJECTED = muted + XCircle (Clock for EXPIRED)
- Calls: QUEUED/DIALING/RINGING = muted PhoneOutgoing (ringing pulses); ON_THE_WAY = success outline Navigation; ACCEPTED = success solid UserCheck; DEFERRED = warning CalendarClock; DECLINED/NO_ANSWER/UNKNOWN = muted PhoneMissed; OPTED_OUT = danger Ban; LATE_ACCEPT = info Heart "Thanked"
- Desk answers: VERIFIED_MATCH = ShieldCheck success; SENT_TO_HOSPITAL = Send warning; NOT_VERIFIED = ShieldAlert danger

**Type:**
- Fonts: headings and numbers in Anek Tamil 600/700; body in Noto Sans + Noto Sans Tamil 400/600 (Google Fonts).
- Sizes: body 16px (Tamil 17px, line height 1.6), small 14px (minimum), h3 20, h2 24, h1 30, impact numbers 44 with tabular numerals.
- Never all caps for Tamil.

**Components (14):** AppShell + DemoBanner, Button (primary, secondary, ghost), StatusBadge, Card, ProgressBanner, Timeline, CallRow, Field, ConsentCheckbox, LangToggle (EN / த), Keypad, TracePanel, StatTile, Toast.

**Layout:**
- Mobile first at 360px, one primary action per screen.
- Staff timeline: tab on mobile, right column from 1024px.

**Accessibility:**
- 48px tap targets with 8px gaps; 3px focus ring in `--info` with 2px offset.
- `aria-live="polite"` on banners, counters and the timeline; `assertive` only for the desk answer.
- `lang="ta"` on Tamil text; labels are never placeholders.
- Everything respects `prefers-reduced-motion`.

**Motion:** timeline entries fade in over 150ms, the progress bar fills over 300ms, and the ringing pulse is the only loop.

**Logo:** two drops leaning toward each other, the left one crimson and the right one an outline. Their overlap forms a small heart. The wordmark is "U2U" in Anek Tamil bold with the "2" in crimson, and "உயிர்" small beneath it.

**Library:** Tailwind CSS v4 mapped to the CSS variables above, lucide-react icons, Radix primitives for Switch, Tabs, Dialog and Toast. No MUI.

## 7. Demo story (2 units of O+ red cells)

N = 2, so pause at covered 3, reopen below 2, fulfil at accepted 2.

1. Hospital raises a request. Round 1 calls 5 donors (A to E). Status OPEN.
2. A, B and C press 1, so covered is 3 (N+1) and the request PAUSES. D and E then press 1 too late and become LATE_ACCEPT ("thank you, we have enough").
3. Staff accept A and defer B, so accepted is 1, on the way is 1 (C), covered is 2, and the request stays PAUSED.
4. C, while on the way, presses 2 on a reminder call and becomes CANCELLED, so covered is 1 (below N) and the request REOPENS. Round 2 calls the next 5 donors.
5. F presses 1, then staff accept F, so accepted is 2 and the request is FULFILLED. Calls still ringing in round 2 become CANCELLED and anyone on the way is thanked.
6. (Human action, not automated) The hospital sends the Uyir chain message from its own WhatsApp: "Someone gave life to your family today. When you're ready, you can do the same." plus the `/join` link.

The scenario runner plays steps 1 to 5.

## 8. Explicitly out of scope for the prototype

Real donors or patients, SMS or WhatsApp sending, live weather API, CSV donor import, automatic eligibility decisions, any medical advice, payments. Telephony to real donors through an Indian provider (such as Exotel) is roadmap.

## 9. Voice call scope and honesty

- **Real Twilio calls go to verified team phones only:** Outbound phone calls via Twilio Media Streams are restricted to numbers explicitly verified in `CALL_ALLOWLIST`. No unconsented or public cellular calls are placed.
- **Judges use the browser call:** External evaluators and judges experience the exact same Live voice call directly in the browser via `/sim`, using Web Audio (16 kHz capture, 24 kHz playback) and WebSocket `WS /sim/live/{callId}` to Gemini Live.
- **Twilio is only the phone line:** Twilio acts strictly as the cellular transport and carrier; all intelligence, natural language understanding, turn-taking, and speech synthesis are Google (Gemini Live and Cloud Text-to-Speech).
- **Calls to real donors through an Indian provider are roadmap:** In-country telephony via an Indian provider (e.g. Exotel) with virtual masked numbers and national DLT registration is explicitly deferred to post-pilot roadmap.
