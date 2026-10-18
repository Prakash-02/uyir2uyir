# U2U Demonstration & Evaluation Guide

> **Status:** built (Demo runner, simulated IVR handset, and scenario execution implemented)

This guide documents the 6-step emergency dispatch scenario, the 2-minute judge walkthrough, and the demo environment access procedures for U2U (Uyir2Uyir).

---

## 1. The 6-Step Demo Scenario: 2 Units of O+ Red Cells

The core demonstration follows an urgent hospital request for **$N = 2$ units of O+ packed red blood cells**. 

Under the $N+1$ counting rule:
$$\text{covered} = \text{accepted} + \text{onTheWay}$$
- **Pause outreach** when $\text{covered} \ge N + 1$ ($2 + 1 = 3$ donors committed, providing one spare).
- **Reopen outreach** if $\text{covered} < N$ (falls below 2 due to dropouts or deferrals).
- **Fulfil request** when $\text{accepted} \ge N$ (2 units physically collected).

```mermaid
sequenceDiagram
    autonumber
    actor H as Hospital Staff
    participant S as U2U Engine
    actor D as Donors (A-J)
    actor C as Blood Centre Staff

    H->>S: 1. Raises request (N=2, O+ Red Cells)
    Note over S: Round 1: Calls Donors A, B, C, D, E (OPEN)
    D-->>S: 2. Donors A, B, C press 1 (On the way)
    Note over S: covered=3 (N+1) -> Request PAUSED
    D-->>S: Donors D & E press 1 late -> LATE_ACCEPT ("Thank you")
    C->>S: 3. Staff accept Donor A, defer Donor B
    Note over S: accepted=1, onTheWay=1 (C) -> covered=2 (Stays PAUSED)
    D-->>S: 4. Donor C encounters flood, presses 2 (CANCELLED)
    Note over S: covered=1 (< N) -> Request REOPENS!
    Note over S: Round 2: Calls Donors F, G, H, I, J
    D-->>S: 5. Donor F presses 1, arrives at centre
    C->>S: Staff accept Donor F -> accepted=2 (N)
    Note over S: Request FULFILLED! Dialers cancelled & donors thanked.
    H->>D: 6. (Human WhatsApp action) Hospital sends Uyir chain link (/join)
```

### Step-by-Step Walkthrough:
1. **Hospital Raises Request:** Hospital staff navigate to `/hospital` and submit a request for 2 units of O+ red blood cells with patient reference `PT-8941`. The system enters `OPEN` status and initiates Round 1, dispatching calls to Donors A through E.
2. **Donors Respond & N+1 Pause:** Donors A, B, and C answer their calls and press `1` ("On the way"). Covered reaches 3 ($\ge N+1$). The outreach engine automatically **pauses** additional dialing. When Donors D and E subsequently press `1`, the system records them as `LATE_ACCEPT`, politely thanking them and explaining that enough donors are already en route.
3. **Blood Centre Screening:** Donors arrive at the blood bank (`/centre`). Staff verify Donor A and click **Accept**. Staff evaluate Donor B, identify low hemoglobin (11.8 g/dL), and click **Defer** with a 30-day return reminder. Current state: 1 accepted, 1 on the way (Donor C), covered = 2. The request remains **paused**.
4. **En-Route Dropout & Automatic Reopening:** While en route, Donor C encounters heavy traffic/road flooding from an IMD weather alert and responds with `2` on a confirmation prompt. Donor C transitions to `CANCELLED`. Covered drops to 1 ($< N$). The engine immediately **reopens** the request, launching Round 2 outreach to Donors F through J.
5. **Fulfillment & Standing Down:** Donor F presses `1`, arrives at the blood centre, and is accepted by staff. Accepted reaches 2 ($= N$). The request transitions to **`FULFILLED`**. All remaining ringing calls in Round 2 are stood down (`CANCELLED`), and any remaining en route donors are sent a thank-you stand-down notification.
6. **The Uyir Chain (Human Action):** Blood bank staff, from their own official hospital WhatsApp account, send the gratitude message to the patient's family:
   > *"Someone gave life to your family today. When you're ready, you can do the same."*
   Accompanied by the public consent link: `https://u2u.org.in/join`.

*Note: Steps 1 through 5 are executed automatically by the backend scenario runner (`backend/app/clock/story.py` via `POST /admin/scenario/demo-o-plus/run`). Step 6 is an intentional human action.*

### Backend Scenario Architecture:
The backend demo runner (`run_story()`) plays steps 1 to 5 exclusively through production domain services without bypassing transactions or writing raw database documents:
1. **Step 1:** Dispatches `POST /requests` for 2 units of O+ red blood cells at Kauvery Hospital (`req_story_o_plus`). Automatically runs Round 1 matching and dispatches calls to Donors A–E.
2. **Step 2:** Dispatches simulated DTMF key `1` for Donors A, B, and C. The request pauses ($N+1=3$). Donors D and E respond late and are marked `LATE_ACCEPT`.
3. **Step 3:** Dispatches staff `POST /calls/{callId}/accept` for Donor A and `POST /calls/{callId}/defer` for Donor B (30 days). Request remains paused (covered = 2).
4. **Step 4:** Advances simulated clock and dispatches en-route cancellation (DTMF `2`) for Donor C due to flood warning. Covered drops to 1 ($< N$), reopening the request and triggering Round 2 outreach to Donors F–J.
5. **Step 5:** Donor F presses `1` and staff accepts Donor F. Accepted reaches 2 ($= N$), transitioning the request to `FULFILLED` and standing down all remaining dialers and en-route donors.
Between each step, `run_story()` appends a `TimelineEvent` with text `Story step N: ...` and advances the simulation clock so that `GET /metrics` produces realistic coordination timings.

---

## 2. 2-Minute Judge Walkthrough Script (Exact Clicks)

For evaluators reviewing the prototype live:

| Step | Screen | Exact Click & Expected Behavior |
|---|---|---|
| **1. Guided Story Mode** | `/` (Home) | **Click "Run the story"** in the top orange banner.<br>• The app **immediately navigates to `/centre`**.<br>• An animated live step badge appears in the banner: *"Step 1 of 5"*, *"Step 2 of 5"*, ..., *"Step 5 of 5"*.<br>• Watch the live round dials, the $N+1$ transition to `PAUSED`, staff screening, dropout reopening, and fulfillment in real time. |
| **2. Coordination Impact** | `/impact` | **Click "Impact"** in the top nav.<br>• Inspect the 3 StatTiles: **"Time to first donor on the way"** (3m vs 45m baseline, 93% faster), **"Time to covered"** (8m vs 90m baseline, 91% faster), and **"Time to fulfilled"** (48m vs 180m baseline, 73% faster).<br>• Verify **Calls per accepted donor** (~5 calls vs ~30+ broadcast blasts) and **Stand-down reach** (100% of excess donors thanked/stood down with zero unnotified arrivals).<br>• Notice the prominent label: *"Simulated data from demo runs"*. |
| **3. AI Safety Benchmarks** | `/eval` | **Click "AI Eval"** in the top nav.<br>• Observe the badge: *"Sample: replaced by the real backend eval run"*.<br>• Verify **0 Payment messages sent to hospital** (mandatory NBTC compliance) and **0 Wrong hospital IDs** (strict entity catalog matching).<br>• Inspect the benchmark table showing test samples and green **PASS** badges. |
| **4. Public Request Desk** | `/desk` | **Click "Request Desk"** in the top nav.<br>• Click the sample chip **"Verified Match (English)"** and press **"Check message"**.<br>• Expand **"How U2U checked this"** to verify transparent Gemini quote extraction validated word-for-word by deterministic code rules.<br>• Observe the mandatory footer stripe: *"Nobody may charge you for a donor."* |
| **5. Donor Join with Consent** | `/join` | **Click "Join as donor"** in the top nav.<br>• Verify the bilingual toggle (`EN / த`), the data collection & withdrawal notice, and the two unticked consent checkboxes.<br>• Notice the **Join** button remains disabled until urgent consent and the 18+ attestation are checked.<br>• Enter phone number, submit, and confirm that the raw phone number is strictly **never displayed back**. |
| **6. Reset Demo** | Any screen | **Click "Reset demo"** in the top banner.<br>• Wipes demo state, clears timeline metrics, and re-seeds pristine initial fixtures. |

---

### Impact & Evaluation Dashboards

![Coordination Impact Dashboard](images/impact.png)
*Coordination Impact: StatTiles contrasting U2U targeted round dispatch against the uncoordinated broadcast baseline.*

![AI Verification Benchmarks](images/eval.png)
*AI Verification Benchmarks: Safety metrics and test cases verifying zero payment routing and zero wrong hospital IDs.*

---

## 3. How to Log In to the Demo

Because emergency blood coordination spans multiple roles, U2U includes a zero-friction **Role Switcher** in the navigation header:

1. **Open the Demo App:** Visit `http://localhost:5173/` (or deployed Firebase URL).
2. **Global Indicator:** Confirm the top banner displays:
   `🟧 SIMULATED DATA — All hospitals, donors and patients shown are simulated.`
3. **One-Tap Role Switching:** Use the top bar switcher to toggle between:
   - **Hospital Staff:** Pre-authenticated to *Kauvery Hospital, Chennai* (access to `/hospital`).
   - **Blood Centre Staff:** Pre-authenticated to *Rotary Central Blood Bank* (access to `/centre`).
   - **Public Request Desk:** No login required (access to `/desk`).
   - **Donor Simulator:** Access to `/sim` to test interactive DTMF responses.
   - **Impact Dashboard:** Access to `/impact` to review computed timeline metrics.
   - **AI Evaluation:** Access to `/eval` to inspect Gemini extraction accuracy and safety benchmarks.
4. **Resetting Demo State:** At any point, clicking **"Reset demo"** in the top banner issues a `POST /admin/reset` call, wiping in-memory states and restoring pristine scenario fixtures.

---

## 4. Browser Live Call with Gemini (Judge Hands-On Experience)

Because external judges cannot receive cellular Twilio calls during evaluation, U2U allows anyone on the demo site to act as a donor and take an urgent ringing call directly in the browser over a two-way Web Audio + WebSocket bridge (`WS /sim/live/{callId}`), reusing the exact same Live bridge architecture, limits, and guardrails as live telephony:

> [!NOTE]
> **Voice Call Scope & Honesty:**
> - **Real Twilio calls go to verified team phones only:** Outbound phone calls via Twilio Media Streams dial numbers explicitly verified in `CALL_ALLOWLIST`.
> - **Judges use the browser call:** Evaluators and judges test voice calls directly in the browser via `/sim`.
> - **Twilio is only the phone line:** Twilio acts strictly as the cellular transport; all understanding and speech is Google (Gemini Live and Cloud Text-to-Speech).
> - **Calls to real donors through an Indian provider are roadmap:** In-country telephony via an Indian provider (e.g. Exotel) with virtual masked numbers and national DLT registration is roadmap.

```mermaid
sequenceDiagram
    autonumber
    actor J as Judge (as Donor)
    participant B as Browser (Web Audio)
    participant S as U2U Backend (WS /sim/live/{callId})
    participant G as Gemini Live (2.5 Native Audio)

    J->>B: 1. Click "Answer with your voice (Gemini Live)"
    B->>S: 2. WS connect & {"type":"auth", "idToken":...}
    S->>B: 3. {"type":"audio", "pcm24k":...} (Cloud TTS 24kHz opening)
    B-->>J: 4. Speaker plays bilingual urgent opening
    J->>B: 5. Speak reply into microphone (English or Tamil)
    B->>S: 6. 16kHz linear PCM audio chunks (40ms)
    S->>G: 7. Real-time audio stream
    G->>S: 8. Gemini Live calls record_reply(intent, quote, etaMinutes)
    S->>S: 9. Code verifies quote, validates transition in transaction
    S->>B: 10. {"type":"result", "intent":..., "etaMinutes":..., "quote":...}
    S->>B: 11. Closing audio + {"type":"ended"}
    B-->>J: 12. Result card: "Gemini understood: I'm coming · about 20 min"
```

### Exact Steps for Judges:

1. **Open the Simulator:**
   - Click **"Donor Simulator"** (`/sim`) in the navigation bar.
   - Verify the top card displays the prominent reassurance label:
     `"Demo: the same call that rings on a donor's phone."`
2. **Select an Active Ringing Call:**
   - If no calls are ringing, click **"Run the story"** or visit `/hospital` to raise a blood request.
   - Select an incoming ringing call from the left list (e.g., `Donor A1` for O+ Red Cells).
3. **Answering with Voice:**
   - Click the primary crimson button: **"Answer with your voice (Gemini Live)"**.
   - If prompted by your browser, grant microphone access. (A clear privacy note explains that audio is processed live and never stored).
   - If mic access is denied, a helpful message explains: *"Microphone blocked, please use the keypad"*.
4. **Listening & Speaking:**
   - Hear the crisp 24 kHz Cloud TTS opening: *"A patient at Kauvery Hospital needs O+ Red cells..."*
   - Once the opening completes, the **"Listening..."** indicator with a pulsating icon appears.
   - Speak your response naturally in English or Tamil:
     - **English:** *"I'm coming, I can be there in about 20 minutes."*
     - **Tamil:** *"நான் வரேன், ஒரு 20 நிமிஷத்துல வந்துடுவேன்"* (*"Naan varen, oru 20 nimishathula vandhuduven"*).
5. **Real-Time Live Captions:**
   - Watch live captions appear in the captions log labelled **You** and **Gemini** (`aria-live="polite"`).
   - Notice that conversational speech is never stored, maintaining strict donor privacy.
6. **Barge-in & Interruption:**
   - Interrupt Gemini at any point by speaking into the microphone. Audio playback stops instantly via Web Audio queue clearing.
7. **Keypad DTMF Fallback / Override:**
   - The telephone keypad (1 "I'm coming", 2 "I can't", 9 "Stop calling me") remains visible at all times.
   - Pressing any key immediately overrides the AI session, applies the deterministic transition, and terminates the call.
8. **Result Card Verification:**
   - Upon completion, an assertive result card announces:
     `"Gemini understood: I'm coming · about 20 min · 'varen 20 nimisham la'"`
   - If unclear: *"Not clear, please use the keypad."*
   - If Gemini is unreachable: *"Gemini isn't available right now, please use the keypad."*
9. **Verify Blood Centre Live Triage:**
   - Switch to **"Blood Centre"** (`/centre`) in the navigation bar.
   - In the active request view, locate the on-the-way donor.
   - Verify that the donor row displays the new **ETA chip** (`20m away`) and the verbatim **quote** beneath the donor alias, sorted automatically by ETA.

![Browser Live Call with Gemini](images/live-call.png)
*Browser Live Call with Gemini on `/sim`: Judges can answer directly through their microphone, speaking in Tamil or English, and inspect real-time transcription, result card, and keypad override.*

---

## 5. Recording the Demo Video (Playwright Silent Recorder)

U2U includes an automated silent video recorder (`video/record_silent.ts`) using Playwright Chromium in headed mode (1920x1080 viewport, visible cursor pointer, and click ripple highlights).

### Commands
- **Record all 8 scenes:**
  ```bash
  npm run video:silent
  ```
- **Re-record a single scene:**
  ```bash
  npm run video:silent -- --scene S6
  ```

### Output Files & Location
Videos are written strictly outside the repository to protect Git history:
- Output folder: `C:\Users\Prakash\Videos\U2U_demo\`
- Individual scenes:
  - `S1_landing.webm` (15s): Landing hero & Three Promises smooth scroll.
  - `S2_desk_text.webm` (25s): Reset demo, verified match sample check, quote validation matrix.
  - `S3_desk_photo.webm` (20s): Photo upload tab, unregistered facility check, Gemini OCR transcript & disclaimer.
  - `S4_scam.webm` (12s): Commercial remuneration scam check, payment warning, and mandatory footer.
  - `S5_hospital_to_centre.webm` (25s): Sign in as Hospital demo, raise O+ Red Cells 2 units request, live timeline triage on `/centre`.
  - `S6_voice_call.webm` (25s): Virtual audio mic (`tamil_reply.wav`), Gemini Live turn-taking response recognition, keypad fallback.
  - `S7_run_story.webm` (25s): 5-step counting rule dispatch to FULFILLED on `/centre`.
  - `S8_close.webm` (18s): Impact metrics dashboard, simulation disclaimer, and hero finish.
- Combined timing manifest: `timing.txt` (total duration 02:45, strictly under 3:00).
- If FFmpeg is installed (`winget install Gyan.FFmpeg`), concatenates scenes into silent `U2U_demo_silent.mp4`.


