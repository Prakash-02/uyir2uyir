# U2U Design System

> **Status:** planned (Component implementation scheduled for Milestone 1)

This document specifies the visual language, design tokens, component specifications, typography, and accessibility guidelines for U2U (Uyir2Uyir), derived from Section 6 of `U2U_BRIEF.md`.

---

## 1. Visual Direction: Warm Paper & Crimson Thread

The emotional tone of emergency blood coordination must be calm, authoritative, and humane. 

- **Palette Philosophy:** "Warm paper and ink with one crimson thread."
- **Restraint:** Calm, warm neutrals carry the visual background and surface containers. Crimson is strictly reserved for the logo mark, the single primary action button, and hero outcome metrics.
- **Fatigue Prevention:** Never use a full crimson or red background; aggressive red interfaces induce alarm fatigue in hospital and blood centre staff working under high-stress emergency conditions.
- **Danger Color Guardrail:** The danger red color token is restricted to Request Desk Answer 3 (`NOT_VERIFIED`) and terminal failure/opt-out badges.

---

## 2. Color Tokens

Tailwind CSS v4 variables map directly to this token palette in both light and dark modes:

| Token | Light Theme | Dark Theme | Purpose / Usage |
|---|---|---|---|
| `--bg` | `#FBF8F4` | `#141110` | Base application canvas ("warm paper") |
| `--surface` | `#FFFFFF` | `#1E1A18` | Elevated card and container surfaces |
| `--text` | `#1C1917` | `#F3EEE9` | Primary typography ("warm ink") |
| `--muted` | `#5F5853` | `#A9A19A` | Secondary labels, captions, metadata |
| `--border` | `#E4DDD5` | `#3A332F` | Subtle borders, dividers, card outlines |
| `--primary` | `#B3122E` | `#FF6B7D` | Crimson thread: primary buttons, hero numbers, logo |
| `--primary-on` | `#FFFFFF` | `#1C1917` | High-contrast text on primary background |
| `--success` | `#17663A` | `#5FD08E` | Fulfilled states, accepted donors, verified match |
| `--success-tint` | `#E6F4EC` | `#15281D` | Success badge background, call arrival highlights |
| `--warning` | `#8A4B00` | `#F5B54A` | Paused states, awaiting hospital confirmation |
| `--warning-tint` | `#FDF1DC` | `#33240F` | Warning badge background, deferred notices |
| `--danger` | `#B42318` | `#FF8A7A` | Desk unverified notice, opt-out badge |
| `--danger-tint` | `#FDECEA` | `#3A1A17` | Danger badge background, scam warning container |
| `--info` | `#1D5FA8` | `#7FB4F0` | Active dialer round indicator, focus rings, links |
| `--info-tint` | `#E8F0FA` | `#16233A` | Active round background, thank-you notice |
| `--demo` | `#F97316` | `#FB923C` | Prominent simulated data banner (text `#1C1917`) |

---

## 3. Status Mapping (Icon + Word)

To guarantee accessibility for color-blind users and rapid comprehension under stress, status indicators **never rely on color alone**. Every badge pairs an explicit icon with descriptive text:

### 3.1 Request Statuses
| Status | Token & Tint | Icon (`lucide-react`) | Display Text | Meaning |
|---|---|---|---|---|
| `OPEN` | `--info` / `--info-tint` | `Radio` | Calling donors | Active outreach round in progress |
| `PAUSED` | `--warning` / `--warning-tint` | `PauseCircle` | Enough on the way | Covered reaches $N+1$; standby |
| `FULFILLED` | `--success` / `--success-tint` | `CheckCircle2` | Fulfilled | Target units ($N$) accepted by staff |
| `AWAITING_HOSPITAL` | `--warning` / `--warning-tint` | `Hourglass` | Waiting for hospital | Forwarded desk alert pending confirmation |
| `EXPIRED` | `--muted` / `--border` | `Clock` | Expired | Deadline elapsed without completion |
| `CANCELLED` | `--muted` / `--border` | `XCircle` | Cancelled | Withdrawn by hospital |
| `REJECTED` | `--muted` / `--border` | `XCircle` | Rejected | Hospital declined unverified alert |

### 3.2 Donor Call States
| State | Token | Icon (`lucide-react`) | Notes |
|---|---|---|---|
| `QUEUED` / `DIALING` | `--muted` | `PhoneOutgoing` | Static |
| `RINGING` | `--muted` | `PhoneOutgoing` | Subtle CSS pulse animation |
| `ON_THE_WAY` | `--success` | `Navigation` (outline) | Donor committed (pressed 1) |
| `ACCEPTED` | `--success` | `UserCheck` (solid) | Physically accepted by centre staff |
| `DEFERRED` | `--warning` | `CalendarClock` | Temporary deferral by centre staff |
| `DECLINED` / `NO_ANSWER` / `UNKNOWN` | `--muted` | `PhoneMissed` | Call failed or pressed 2 |
| `OPTED_OUT` | `--danger` | `Ban` | Pressed 9: removed from pool |
| `LATE_ACCEPT` | `--info` | `Heart` | Pressed 1 after pause: "Thanked" |
| `CANCELLED` | `--muted` | `PhoneOff` | Stood down / request completed |

### 3.3 Request Desk Answers
| Answer | Token & Tint | Icon (`lucide-react`) | Heading & Guidance |
|---|---|---|---|
| `VERIFIED_MATCH` | `--success` / `--success-tint` | `ShieldCheck` | **Verified hospital request.** Match confirmed with active hospital order. |
| `SENT_TO_HOSPITAL` | `--warning` / `--warning-tint` | `Send` | **Sent to hospital blood bank.** Pending hospital verification. |
| `NOT_VERIFIED` | `--danger` / `--danger-tint` | `ShieldAlert` | **Couldn't verify.** Please call the hospital directly. |

---

## 4. Typography

Typography is loaded via Google Fonts with complete glyph support for English and Tamil script.

- **Headings & Impact Numbers:** `Anek Tamil` (weights 600 SemiBold, 700 Bold).
- **Body & Controls:** `Noto Sans` (Latin) and `Noto Sans Tamil` (Tamil) (weights 400 Regular, 600 SemiBold).
- **Type Scale:**
  - **Impact Numbers:** 44px, tabular numerals (`font-feature-settings: "tnum"`), bold.
  - **H1 Page Title:** 30px / line-height 1.25.
  - **H2 Section Header:** 24px / line-height 1.3.
  - **H3 Subsection Header:** 20px / line-height 1.4.
  - **Body (English):** 16px / line-height 1.5.
  - **Body (Tamil):** 17px / line-height 1.6 (slightly increased font size and line height for Tamil vowel signs and conjuncts).
  - **Small / Meta:** 14px (minimum size; no text renders smaller than 14px).
- **Tamil Typographic Rule:** **Never apply `text-transform: uppercase` (all caps) to Tamil text.** Tamil has no case distinction; capitalizing causes layout distortions.

---

## 5. Component Catalog (14 Core Components)

The frontend library is composed exclusively of clean TypeScript components built on Radix primitives and Tailwind v4:

1. **`AppShell` + `DemoBanner`:** Responsive header, role switcher, theme toggle, and the top-level persistent orange `"SIMULATED DATA"` banner in demo mode.
2. **`Button`:** Three variants (`primary` in crimson, `secondary` outlined in neutral, `ghost` for icon actions). Minimum 48px height.
3. **`StatusBadge`:** Pill badge rendering paired icon and textual status with high contrast.
4. **`Card`:** Elevated container (`--surface`) with subtle border (`--border`) and gentle shadow.
5. **`ProgressBanner`:** Prominent live summary banner (e.g., *"1 on the way of 2"*), animating fill progress.
6. **`Timeline`:** Live chronological stream of dispatch, IVR, and screening events with timestamp chips.
7. **`CallRow`:** Donor row showing alias ("Donor A7"), blood group badge, call state icon, distance, and action triggers.
8. **`Field`:** Form field wrapper containing explicit `<label>`, helper text, and validation error messages. Never uses placeholder-only inputs.
9. **`ConsentCheckbox`:** Unchecked-by-default multi-line consent component with full keyboard focus support.
10. **`LangToggle`:** Language switch control (`EN` / `த`) with ARIA toggle state.
11. **`Keypad`:** Accessible telephone keypad component for the `/sim` screen (digits 1, 2, 9).
12. **`TracePanel`:** Collapsible inspection drawer displaying Gemini extraction results, verbatim quote matches, and code decision paths.
13. **`StatTile`:** Metric display card showing 44px tabular numerals with comparison baselines.
14. **`Toast`:** Notification system using Radix Toast primitive for non-disruptive feedback.

---

## 6. Layout & Responsive Breakpoints

- **Mobile First (360px minimum):** Every screen is fully functional on standard mobile devices.
- **One Primary Action Rule:** Each view highlights exactly one primary crimson action button above the fold.
- **Adaptive Staff Workspace (`/centre`):**
  - **Mobile (< 1024px):** Event timeline rendered inside a dedicated tab.
  - **Desktop (≥ 1024px):** Split layout with donor triage table on the left and sticky live event timeline on the right.

---

## 7. Accessibility & Motion

- **Touch Targets:** All interactive buttons, switches, and inputs have a minimum target size of 48px × 48px with at least 8px spacing.
- **Focus Rings:** High-visibility 3px focus outline using `--info` with a 2px offset.
- **Screen Reader Announcements:**
  - `aria-live="polite"` applied to status counters, progress banners, and live event timelines.
  - `aria-live="assertive"` reserved exclusively for Request Desk check results.
  - `lang="ta"` explicitly tagged on all Tamil language text nodes.
- **Motion Restraint:**
  - Progress bar transitions smoothly over 300ms.
  - Timeline entries fade in over 150ms.
  - The ringing pulse animation is the only continuous visual loop.
  - Respects `@media (prefers-reduced-motion: reduce)` by immediately disabling all pulses and transitions.

---

## 8. Brand & Logo Mark

- **Symbol:** Two blood drops leaning toward each other. The left drop is solid crimson (`--primary`), and the right drop is an elegant outline (`--border` / `--text`). Their intersection in the center forms a subtle heart shape, symbolizing "life to life".
- **Wordmark:** "U2U" set in Anek Tamil Bold, where the numeral "2" is rendered in crimson (`--primary`). Beneath the wordmark sits the Tamil script word "உயிர்" in small, crisp type.
