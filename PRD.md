# Product Requirements Document (PRD)
## JobMatch AI — Intelligent Career Navigator & Auto-Apply Extension

---

## 1. Executive Summary
**JobMatch AI Extension** is an AI-powered browser copilot designed to automate, optimize, and streamline the job application process on major Indian and global job portals (starting with **Naukri.com**, followed by **LinkedIn** and **Indeed**).

Unlike indiscriminate "spam-bot" auto-appliers that mass-submit to hundreds of irrelevant listings, JobMatch AI operates as a **precision application assistant**. It strictly filters for candidate criteria (e.g., minimum salary package $\ge 18$ LPA, 100% job criteria match score, specific notice period, and relevant tech stacks), dynamically tailors answers using Gemini AI, and executes applications natively within the user's browser at realistic, human-paced intervals.

---

## 2. Problem Statement
1. **Time-Consuming Manual Process**: Candidates spend 2–4 hours daily scrolling listings, answering repetitive screening questions (experience, CTC, notice period, tech skills), and uploading resumes.
2. **"Spray and Pray" Fatigue**: Traditional auto-apply bots blindly apply to low-paying or irrelevant jobs, burning recruiter trust and exhausting portal daily quotas.
3. **Bot Detection & Account Bans**: Cloud-based bot farms frequently trigger CAPTCHAs, Akamai/Cloudflare blocks, and account suspensions due to foreign IP addresses and automated fingerprints.
4. **Sub-optimal Naukri Algorithm Visibility**: Naukri prioritizes profiles updated frequently and applications submitted within hours of job posting with high match scores.

---

## 3. Product Vision & Goals
* **Vision**: Empower professionals to secure high-compensation job opportunities effortlessly while maintaining 100% control over where and how they apply.
* **Core North Star Metric**: *High-Match Applications Submitted per Active User per Week*.
* **Business Goal**: Build a recurring revenue SaaS product targeting tech professionals with tiered subscriptions ($9–$35/month or ₹799–₹2,499/month).

---

## 4. User Personas

### Persona A: The Active Job Seeker ("Jeet")
* **Profile**: Experienced Software Engineer (3–6 years exp) currently employed, looking for senior roles with $\ge 18$ LPA.
* **Pain Points**: Limited time after work hours to browse jobs; gets overwhelmed by 50+ irrelevant consultant postings; hates repetitive screening forms.
* **Desired Outcome**: One-click automation that only applies to verified direct roles matching their exact salary expectations and tech stack.

### Persona B: The Notice Period Candidate
* **Profile**: Candidate currently serving a 30–90 day notice period with immediate need to maximize interview calls before the last working day.
* **Pain Points**: Needs daily profile refreshes to rank high on recruiter search algorithms; needs rapid application throughput across Naukri and LinkedIn.

---

## 5. Feature Requirements

### 5.1. Precision Matching & Filtering Engine
* **FR-1.1 (Salary Package Filter)**:
  - Users can set a hard `MIN_SALARY_LPA` (e.g., 18 LPA).
  - Pre-filters search URLs via query parameters (`ctcFilter=15to25&ctcFilter=25to50`).
  - Card-level and popup-level parser: parses Lacs/Cr ranges and skips jobs where maximum compensation is below the threshold or "Not disclosed" (user configurable).
* **FR-1.2 (Job Match Score & Criteria Verification)**:
  - Validates that 100% of portal criteria (Keyskills, Experience, Location, Education) are marked as fulfilled/matched.
  - Automatically aborts apply if any required criterion is missing or flagged red.
* **FR-1.3 (Role & Title Filter)**:
  - Keyword inclusion (`Full Stack`, `Backend`, `React`, `Node.js`, `AI Engineer`).
  - Keyword blocklist (`QA`, `DevOps`, `Manager`, `.NET`, `PHP`, `Intern`).
* **FR-1.4 (Company Exclusion List)**:
  - Blacklist current employer, staffing agencies, or low-rated companies.

### 5.2. Automated Application & Questionnaire Answering
* **FR-2.1 (Naukri 1-Click Direct Apply)**:
  - Opens jobs in an active tab/popup, clicks Apply, and handles post-application verification (`/myapply/saveApply`).
* **FR-2.2 (AI-Powered Chatbot Questionnaire)**:
  - Multi-tier answering engine:
    1. *Exact Rule Bank*: Immediate fill for standard fields (years of experience, notice period, CTC, Bengaluru relocation, work authorization).
    2. *Controlled Input Synchronization*: Full React `_valueTracker` commit, keyboard simulation, and dual Enter/Save click.
    3. *Gemini 2.0 Flash Fallback*: Context-aware AI answers for open-ended questions (*"Describe your experience with microservices architectures"*).
* **FR-2.3 (External ATS Auto-Fill)**:
  - Detects "Apply on company site" handoffs (Greenhouse, Lever, SmartRecruiters, Keka, Zoho).
  - Auto-fills candidate fields and attaches PDF resume directly. Skips logins that require mandatory email verification portals (Workday, Taleo).

### 5.3. Profile Optimization & Algorithm Booster
* **FR-3.1 (Hourly Naukri Profile Refresher)**:
  - Toggles profile headline dot or uploads updated resume silently to reset the "Last Active" timestamp, placing the profile at the top of recruiter search results.

### 5.4. User Dashboard & Safety Controls
* **FR-4.1 (Human-Paced Execution)**:
  - Configurable random delays (30s – 90s) between actions to mimic human interaction and protect user accounts.
* **FR-4.2 (Daily Application Quota)**:
  - Configurable daily caps (e.g., 15–30 applications/day) with auto-stop.
* **FR-4.3 (Application History & Audit Log)**:
  - Real-time logging of applied jobs: Date, Role, Company, Salary, Match Status, and Verification Link.
  - Exportable as CSV or viewable in Web UI.

---

## 6. Architecture & Platform

```
┌────────────────────────────────────────────────────────┐
│           JobMatch AI Chrome Extension (MV3)           │
│                                                        │
│  ┌─────────────────────────┐  ┌──────────────────────┐ │
│  │     Side Panel UI       │  │    Service Worker    │ │
│  │ (Settings, Run, Status) │  │  (State & Scheduler) │ │
│  └────────────┬────────────┘  └───────────┬──────────┘ │
└───────────────┼───────────────────────────┼────────────┘
                │ chrome.runtime.sendMessage│
                ▼                           ▼
┌────────────────────────────────────────────────────────┐
│             Injected Content Scripts                   │
│  ┌──────────────────┐ ┌──────────────────────────────┐ │
│  │ Naukri Controller│ │ ATS / External Form Filler   │ │
│  └──────────────────┘ └──────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
                ▲
                │ REST API / Auth
                ▼
┌────────────────────────────────────────────────────────┐
│             JobMatch AI Backend (FastAPI/Node)         │
│  - User Auth & Subscription Management (Stripe/Razorpay)│
│  - Gemini AI Questionnaire Engine                      │
│  - Remote Dynamic Selector Hotfixes                    │
└────────────────────────────────────────────────────────┘
```

---

## 7. Subscription & Monetization Model

| Tier | Pricing | Limits & Features |
|---|---|---|
| **Free Trial** | ₹0 / 7 Days | 5 test applications total, basic title filter, Naukri support. |
| **Pro** | ₹999 / mo ($12) | 25 applies/day, $\ge 18$ LPA filter, 100% criteria match verification, rule-based chatbot. |
| **Max AI** | ₹2,499 / mo ($29) | Unlimited applies/day (up to portal safe limits), Gemini AI questionnaire answering, ATS autofill, daily profile refresher, WhatsApp / Telegram alerts. |

---

## 8. Success Metrics (KPIs)
1. **Application Success Rate**: $> 92\%$ of targeted jobs successfully submitted without manual intervention.
2. **Recruiter Callback Velocity**: $3\times$ increase in recruiter profile views and interview calls within 14 days of activation.
3. **Safety / Zero Ban Rate**: $0\%$ account suspensions due to human-jitter throttling and local browser execution.
