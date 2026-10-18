# U2U Privacy, Safety & Clinical Guardrails

> **Status:** built (Enforced across backend, frontend, and data persistence models)

This document outlines the strict privacy boundaries, data minimization protocols, consent mechanisms, and clinical guardrails governing U2U (Uyir2Uyir).

---

## 1. Regulatory Boundary: Prototype, Not a Medical Device

> [!IMPORTANT]
> **Prototype Declaration:** U2U is an experimental research and coordination software prototype developed for the Google Cloud AI Builder Cup 2026. It is **not** a certified medical device, diagnostic apparatus, or clinical decision support software under the Central Drugs Standard Control Organisation (CDSCO Medical Device Rules 2017), US FDA (21 CFR Part 820), or EU MDR (2017/745) regulations.

- U2U does not diagnose medical conditions, evaluate blood compatibility, analyze clinical laboratory markers, or recommend medical treatments.
- All blood matching logic in the software operates purely as an administrative contact relay based on declared donor blood groups.
- All donor eligibility determinations, hemoglobin screenings, health questionnaires, and physical acceptance or deferral actions are conducted exclusively by licensed, authorized **blood centre staff** following national blood transfusion standards (Directorate General of Health Services / NBTC Standards for Blood Banks & Blood Transfusion Services).

---

## 2. Data Minimization: Data Kept vs Data Discarded

U2U adheres to rigorous data minimization principles:

| Category | Kept in Persistence | Discarded Immediately / Never Kept |
|---|---|---|
| **Public Desk Inputs (Text)** | Verification decision (`VERIFIED_MATCH`, `SENT_TO_HOSPITAL`, or `NOT_VERIFIED`), extracted entities if valid | **Raw forwarded message text is purged from memory immediately** after extraction. Sender phone numbers, chat logs, and forwarded metadata are never stored. |
| **Public Desk Inputs (Photos)** | Verification decision and extracted entities matching verified quotes | **Uploaded photo bytes are processed in memory only and immediately discarded.** Never written to Firestore, Cloud Storage, server disk, logs, or traces. All EXIF and GPS geolocation metadata are stripped via browser canvas and backend Pillow re-encoding. |
| **Patient Information** | Internal hospital reference (`patientRef`), units needed, requested blood component | Patient full legal names, diagnoses, ward/bed locations, medical history, and clinical records are **never collected or stored**. |
| **Donor Information** | System alias (e.g. `"Donor A7"`), declared blood group, area/pin, preferred language (`en`/`ta`), consent timestamps | Raw plaintext phone numbers are kept in encrypted outreach vaults only; never stored alongside names in plaintext. |
| **Voice Records** | Structured call states (`RINGING`, `ON_THE_WAY`, `ACCEPTED`, `DEFERRED`), round number, ETA | Voice audio recordings of donor calls are **never captured or recorded**. |

### 2.1 Photo Upload Privacy & Metadata Stripping
When users upload a photo or screenshot on the Request Desk (`POST /desk/check-image`):
1. **Client-Side Canvas Downscaling:** In the browser, the image is drawn onto an HTML5 canvas scaled to a maximum bounding box of 1600 px and exported as JPEG (quality 0.85). This canvas re-render completely strips camera, device, and GPS metadata before transmission.
2. **Server-Side Re-encoding:** In `backend/app/desk/image_input.py`, magic bytes are validated, decompression bombs ($> 40\text{ MP}$) are blocked, EXIF orientation is transposed into raw pixels, and the image is re-encoded to JPEG at quality 85. Any remaining EXIF or geolocation tags are eliminated.
3. **Zero Persistence Guarantee:** The image bytes exist purely in ephemeral memory while the Gemini Flash multimodal call executes. The file is never saved to local disk, never uploaded to Google Cloud Storage or Firestore, and omitted from the audit trace.
4. **Fictional Sample Photos:** All sample photos (`sample_photo_unknown_hospital.jpg` and `sample_photo_registered_hospital.jpg`) are synthetic mock screenshots created specifically for testing and demonstration. No real person's PII, photo, or medical record is ever permitted in the codebase (enforced by `infra/check_staged_files.ps1`).

---

## 3. Donor Anonymity & Masking

1. **Public Anonymity:** Donors are never exposed to families, the public, or other donors. Across all dashboards, event timelines, and APIs, donors are identified strictly by an immutable random alias (e.g., `"Donor A7"`).
2. **Staff Access Controls:** Blood bank and hospital staff dashboards view donors exclusively by alias, declared blood group, and estimated arrival time. Under authorized audit views, staff see at most the last 4 digits of a contact number (`+91 ••••• ••123`).
3. **Patient Reference Protection:** The internal hospital patient identifier (`patientRef`) exists strictly in authenticated hospital and blood centre views. It is omitted from all public endpoints (`GET /requests/{id}/status`), masked in hospital confirmation links (`patientRefMasked`), and excluded from public Firestore rules.

---

## 4. Purpose-Specific Consent & Consent Screen (`/join`)

### Consent Screen

![U2U Donor Consent Screen](images/join.png)

Voluntary blood donor registration requires explicit, granular, purpose-specific consent:

- **Bilingual Interface:** Full support for Tamil (`ta`) and English (`en`) via `LangToggle` at the top right, ensuring donors comprehend all terms in their preferred language.
- **Data Collection & Withdrawal Notice:** A clear, upfront summary informing donors what data is collected (name, phone, blood group, area), why (relaying urgent blood requests), how to withdraw at any time (press 9 on any automated call, or through the web page), and grievance officer contact (`grievance@uyir2uyir.org`).
- **Two Unticked Checkboxes:** On the donor onboarding screen (`/join`), consent checkboxes are strictly unselected by default. Pre-ticked consent boxes are prohibited under privacy regulations:
  1. *Urgent Contact Consent (Mandatory to join):* `"U2U may call me when someone near me needs my blood group."`
  2. *Donation History Consent (Optional):* `"U2U may keep my donation history so I'm not called too early."`
- **Adult Attestation (Mandatory to join):* Mandatory affirmation: `"I confirm that I am 18 years of age or older."`
- **Disabled Join Action:** The `"Join"` button remains completely disabled until both the urgent-contact consent and 18+ attestation checkboxes are explicitly ticked and required fields are valid.
- **Strict Phone Privacy on Confirmation:** Validated as an Indian mobile number, but upon successful submission the phone number is **never displayed back** on the screen. The user receives only their anonymous alias (e.g., `"Donor A7"`) and confirmation that they will only be contacted when matched and eligible.
- **Simulated Demo Notice:** In demo mode, clearly declares: `"Demo: nothing is sent and no call will be made."`

---

## 5. Voice Call Privacy & Safety Guardrails

- **The Call Privacy Line — Zero Audio Storage:** Nothing is recorded. Outbound telephony streams and in-browser Web Audio streams are processed purely in ephemeral volatile memory. Zero audio clips, voice recordings, or conversational transcripts are written to disk, Cloud Storage, or Firestore.
- **Minimal Structured State:** The database stores only the structured operational outcome necessary to coordinate the request:
  - `intent`: `COMING` (Press 1 equivalent), `CANT` (Press 2 equivalent), `STOP` (Press 9 consent withdrawal), or `UNCLEAR`.
  - `etaMinutes`: Arrival time estimate in minutes (integer, or `null`).
  - `quote`: Verbatim quote of the donor's words (e.g. `"I will come in 20 minutes"`, or Tamil `"varen 20 nimisham la"`).
  - `applied`: Boolean flag confirming deterministic state machine transition in Firestore.
- **Real-Time Guardrails:**
  - *Hard Duration Caps:* Calls are strictly bounded by a 45-second duration limit and a 3-turn donor conversation limit. If Gemini cannot determine clear intent within these bounds, the call safely terminates with state `UNCLEAR` and prompts the donor to use the keypad.
  - *DTMF Keypad Always Active:* Telephone keypad digits (`1`, `2`, `9`) override Gemini Live at any instant, immediately aborting the AI session and executing deterministic domain logic.
  - *No Medical Advice:* Gemini Live is governed by strict system instructions to never offer medical advice, evaluate donor eligibility, or discuss patient conditions.
  - *Allowlist Enforcement:* Real outbound Twilio calls dial verified team phones only in `CALL_ALLOWLIST`. Evaluators and judges test voice calls directly in the browser via `/sim`. Twilio is only the carrier transport; in-country telephony through an Indian provider (e.g. Exotel) is roadmap.

---

## 6. Instant Opt-Out: "Press 9 to Stop Calling"

Donor autonomy and protection from fatigue are core design requirements:

- **Explicit Voice Prompt:** Every automated phone call clearly recites:
  > *"Press 1 if you are on the way. Press 2 if you cannot make it. Press 9 to stop receiving calls from U2U."*
- **Immediate Execution:** Pressing 9 transitions the call state to `OPTED_OUT` and deactivates the donor record in Firestore.
- **Permanent Suppression:** Donors with `OPTED_OUT` status are permanently excluded from all future outreach matching rounds unless they explicitly re-register.

---

## 7. Retention, Vault & Data Lifecycles

- **Active Emergency Window:** Blood requests remain active for a maximum expiration window configured by the hospital (typically 2 to 6 hours). Once expired, no further outreach calls are placed.
- **Demo Mode Purge:** In `DATA_MODE=demo`, test databases are ephemeral and can be wiped and re-seeded at any time via `POST /admin/reset`.
- **Phone Vault:** Real phone numbers are encrypted with AES-256-GCM using `PHONE_KEY` (Secret Manager in cloud) and stored in `donorContacts/{id}` with an HMAC-SHA256 blind lookup hash and last 4 digits only. Handled strictly in `backend/app/core/phone_vault.py`. Full phone numbers are never returned in any API response or logged.
- **Consent Ledger:** Onboarding writes purpose-specific consent events (`urgent_contact`, `donation_history`, notice version `"v1"`, channel `"web"`, timestamp) to `consents/{donorId}/events`. Press 9 logs an immediate `WITHDRAW` event. Handled in `backend/app/donors/router.py` and `backend/app/outreach/router.py`.
- **System Audit Logs:** Append-only ledger in `audit/{id}` records sensitive operational actions (`create`, `cancel`, `accept`, `defer`, `confirm`, `opt-out`) with actor UID, role, data mode, action, target ID, and status diff. Handled in `backend/app/core/audit.py` and excluded from personal values / PII. Cloud Logging preserves pseudonymized transaction traces for system health monitoring.

---

## 8. Staff Authority Over Donor Acceptance

To maintain safety and quality standards in blood transfusion services:
- Neither the application nor the AI model can mark a donor as `ACCEPTED` or medically cleared.
- Donors arriving at the blood bank undergo standard physical screening (hemoglobin testing, blood pressure, copper sulfate/screening assay, donor deferral questionnaire) conducted by blood centre professionals.
- Centre staff log the physical decision (`POST /calls/{id}/accept` or `POST /calls/{id}/defer`) directly into the screening portal (`backend/app/screening/router.py`), guaranteeing that clinical authority remains 100% human-controlled.

