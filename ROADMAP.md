# Phase-Wise Development Roadmap
## JobMatch AI — From Local Scripts to Commercial SaaS Extension

---

## Roadmap Overview

```
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 1: Core Chrome Extension MVP (Naukri Precision Apply) │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ Phase 2: AI Copilot & Smart Resume Engine (Gemini 2.0 Flash)│
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ Phase 3: SaaS Monetization, Auth & Subscription Billing     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ Phase 4: Multi-Portal Expansion (LinkedIn & Indeed) + Alerts│
 └──────────────────────────────┬──────────────────────────────┘
                                │
 ┌──────────────────────────────▼──────────────────────────────┐
 │ Phase 5: Public Chrome Web Store Launch & Growth Marketing  │
 └─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Chrome Extension MVP [COMPLETED ✅]
**Goal**: Package the existing battle-tested scripts into a clean, zero-terminal Chrome Extension (Manifest V3).

* **Milestone 1.1: Extension Foundation [DONE ✅]**:
  - Setup Manifest V3 scaffolding (`extension/manifest.json`), `background/service-worker.js`, and permissions (`sidePanel`, `storage`, `tabs`, `activeTab`, `alarms`).
  - Created high-resolution icons (16, 48, 128 px).
  - Built sleek glassmorphic Side Panel UI (`sidepanel/sidepanel.html`, `sidepanel.css`, `sidepanel.js`) with modern typography (`Plus Jakarta Sans`) and real-time status badges.
* **Milestone 1.2: Naukri Content Script Migration [DONE ✅]**:
  - Ported `naukri-auto-apply.js` logic into `extension/content/naukri-content.js`.
  - Implemented bidirectional message passing (`chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`).
* **Milestone 1.3: Quality Filters Integration [DONE ✅]**:
  - Exposed UI settings in Side Panel:
    - Minimum Salary Package input ($\ge 18$ LPA default).
    - Toggle for "Strictly Require 100% Criteria Match".
    - Toggle for "Auto-Skip Undisclosed CTC".
    - Target Applications per run counter.
  - Implemented live scrolling activity feed and status badges.
* **Milestone 1.4: Local Storage & History [DONE ✅]**:
  - Persisted applied jobs, daily application counters, and logs in `chrome.storage.local`.
* **Deliverable**: Complete unpacked Chrome Extension in `extension/` ready to load into `chrome://extensions` with zero terminal commands needed.

---

## Phase 2: AI Copilot & Smart Resume Engine (Weeks 3–4)
**Goal**: Integrate Gemini 2.0 Flash to handle complex screening questions and automate hourly profile refresh.

* **Milestone 2.1: Cloud Backend Setup**:
  - Initialize FastAPI / Node.js backend.
  - Create endpoint `/api/v1/generate-answer` for structured candidate answers using Gemini 2.0 Flash with response caching.
* **Milestone 2.2: Automated Profile Refresh**:
  - Port `naukri-profile-refresh.js` into background service worker using `chrome.alarms`.
  - Runs silent headline toggle hourly to keep the user's Naukri profile at the top of recruiter searches.
* **Milestone 2.3: Dynamic Selector Registry**:
  - Backend API endpoint `/api/v1/selectors/naukri` to distribute selector hotfixes remotely without Chrome Web Store update latency.
* **Deliverable**: Intelligent chatbot handler with zero manual intervention required for complex company questionnaires.

---

## Phase 3: SaaS Monetization, Auth & Billing (Weeks 5–6)
**Goal**: Transform the extension into a recurring revenue product with user authentication and payment processing.

* **Milestone 3.1: User Authentication**:
  - Integrate Supabase / Firebase / Custom JWT Auth (Google One-Tap sign in).
  - Sync candidate profile (skills, resume, experience) between Web Dashboard and Extension.
* **Milestone 3.2: Payment Gateway Integration**:
  - Integrate **Razorpay** (for UPI / Cards in India) and **Stripe** (for international cards).
  - Webhook listener to grant/revoke active subscription entitlements:
    - Free Trial: 5 total applications.
    - Starter: 15 applications/day.
    - Pro: 40 applications/day + AI answering.
* **Milestone 3.3: Quota & Licensing Verification**:
  - Extension queries `/api/v1/user/entitlements` before each run.
  - Graceful upgrade prompt when quota is reached.
* **Deliverable**: Self-serve subscription workflow where users sign up, pay, and unlock auto-apply quotas.

---

## Phase 4: Multi-Portal Expansion & Notifications (Weeks 7–8)
**Goal**: Expand coverage beyond Naukri to LinkedIn and Indeed, and add real-time user notification channels.

* **Milestone 4.1: LinkedIn Easy Apply Support**:
  - Injected content script for `linkedin.com/jobs/search`.
  - Automates 1-click Easy Apply dialogs, multi-step pagination, and salary pre-check.
* **Milestone 4.2: Indeed Auto-Apply Support**:
  - Port existing `indeed-auto-apply.js` into extension content driver.
* **Milestone 4.3: Real-Time Alerts (WhatsApp / Telegram / Email)**:
  - User connects Telegram bot or WhatsApp Business number.
  - Instant alert on successful application with job link and match score summary.
* **Deliverable**: Multi-platform auto-apply ecosystem with automated mobile notifications.

---

## Phase 5: Chrome Web Store Launch & Growth (Weeks 9+)
**Goal**: Pass Google Chrome Web Store review, launch publicly, and drive user acquisition.

* **Milestone 5.1: Compliance & Privacy Audit**:
  - Draft Privacy Policy and Single Purpose justification for Chrome Web Store.
  - Minimal permission audit (avoid unnecessary broad host permissions).
* **Milestone 5.2: Chrome Web Store Submission**:
  - Prepare store assets (1280x800 screenshots, promo tiles, icon set: 16/48/128px).
  - Submit for review.
* **Milestone 5.3: Growth & Go-to-Market (GTM)**:
  - Launch on Product Hunt, LinkedIn, and Reddit tech communities (*r/developersIndia*, *r/cscareerquestions*).
  - Offer free 7-day trials to early beta testers for social proof and testimonials.
