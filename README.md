# JobMatch AI — Personal Job Matching & Career Navigator 🚀

> Automated, high-precision job application copilot with smart salary targeting ($\ge 18\text{ LPA}$), 100% criteria fulfillment matching, interactive Chrome Extension (Side Panel), autonomous chatbot handling, and real-time email digest notifications.

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue)](https://github.com/JeetYad07/JobMatchAI)
[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success)](https://github.com/JeetYad07/JobMatchAI)
[![Playwright](https://img.shields.io/badge/Engine-Playwright%20Stealth-orange)](https://github.com/JeetYad07/JobMatchAI)
[![License](https://img.shields.io/badge/License-MIT-green)](https://github.com/JeetYad07/JobMatchAI)

---

## 🌟 Overview

**JobMatch AI** transforms the tedious, manual job search process into an automated, highly-targeted workflow. Operating across **Naukri**, **Wellfound**, and **Indeed**, it filters for premium packages, screens for 100% criteria alignment, completes recruiter screening questionnaires, and delivers instant email digests after every session.

### 🎯 Key Highlights
* **Chrome Extension (Manifest V3)**: Glassmorphic Side Panel UI featuring real-time application logs, active session metrics, daily application quotas, and targeting presets.
* **Smart Search Targeting Hub**: 1-Click **"✨ Fill from Resume"** auto-configures verified criteria (e.g., 4 yrs exp, B.Tech NIT Jalandhar, $\ge 18\text{ LPA}$, Direct Employer, Last 7 Days).
* **Multi-Location Search Engine**: Canonical routing and verified internal GIDs for single and multi-city queries (`Bengaluru`, `Pune`, `Hyderabad`, `Delhi / NCR`, `Remote`).
* **Autonomous Chatbot Solver**: Intelligently handles multi-turn screening drawers, radio chips, numeric experience inputs, and dropdowns.
* **Real-time Email Digests**: Dispatches detailed HTML summary reports with clickable job links, company names, verified salaries, and match badges via a background bridge daemon.
* **Hourly Profile Refresh**: Rotates resume headline updates and daily CV re-uploads to keep your candidate profile at the top of recruiter searches.

---

## 📐 Architecture & Components

```
JobMatchAI/
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest & permissions
│   ├── sidepanel/                 # Glassmorphic Side Panel UI
│   │   ├── sidepanel.html         # Controls, filters, logs & metrics
│   │   ├── sidepanel.css          # Modern dark-mode styling
│   │   └── sidepanel.js           # Filter state, targeting URL builder & event bus
│   ├── background/
│   │   └── service-worker.js      # Auto-pilot navigation & script injection
│   ├── content/
│   │   └── naukri-content.js      # Live card scanner, chatbot solver & apply runner
│   └── icons/                     # Extension branding icons
├── email-notifier.js              # HTML digest generator & local HTTP bridge server
├── auto-apply-runner.js           # Stealth Playwright runner (Naukri, Wellfound, Indeed)
├── naukri-profile-refresh.js      # Hourly recruiter search booster
├── config.js                      # Dynamic career duration calculator & .env parser
├── .env.example                   # Environment configuration template
├── ARCHITECTURE.md                # In-depth architectural blueprint
├── PRD.md                         # Product requirements & user journeys
├── ROADMAP.md                     # Feature roadmap & upcoming milestones
└── fixedNotes.md                  # Comprehensive technical bug fix log
```

---

## ⚡ Quickstart

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0 or newer)
* Google Chrome installed
* Git

### 1. Clone & Install

```bash
git clone https://github.com/JeetYad07/JobMatchAI.git
cd JobMatchAI
npm install
```

### 2. Configure Credentials (`.env`)

Copy the template and fill in your details:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Example |
|---|---|---|
| `CAREER_START_DATE` | Your career commencement date | `2022-06-01` |
| `MIN_SALARY_LPA` | Minimum compensation threshold | `18` |
| `GMAIL_USER` | Gmail address for sending digests | `your.email@gmail.com` |
| `GMAIL_APP_PASSWORD` | Google 16-character App Password | `xxxx xxxx xxxx xxxx` |
| `DIGEST_RECIPIENT` | Recipient email for session digests | `your.email@gmail.com` |
| `GOOGLE_EMAIL` | Account used for Naukri sign-in | `your.email@gmail.com` |
| `RESUME_FILE` | Path to your resume PDF | `resume.pdf` |

> 🔒 **Security Notice:** `.env` is strictly ignored by `.gitignore` and is never committed to GitHub.

---

## 🧩 Installing the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select the `extension/` folder inside the `JobMatchAI` workspace.
5. Click the extension puzzle icon in Chrome and pin **JobMatch AI — Personal Job Navigator**.
6. Click the extension icon to open the glassmorphic **Side Panel**.

---

## 🚀 Running the Automation

### Mode A: Chrome Extension (Interactive & Visual)

1. Start the Email Bridge Server daemon in terminal:
   ```bash
   node email-notifier.js --server
   ```
2. Open the JobMatch AI Side Panel in Chrome.
3. Click **"✨ Fill from Resume"** to populate pre-verified filters.
4. Click **"⚡ Apply Filters to Page"** to navigate the active tab to the targeted search.
5. Click **"▶ Start Auto-Apply"**. Sit back and watch the live feed stream actions in real-time.

### Mode B: Headless / Stealth Terminal Runner

Test applications in dry-run mode (fills forms, answers questionnaires, but does not submit):

```bash
# Initial one-time login
node auto-apply-runner.js naukri login

# Dry-run
node auto-apply-runner.js naukri

# Live application run
node auto-apply-runner.js naukri --live
```

---

## 🔄 Hourly Profile Refresher

Keep your candidate profile tagged as *"Recently Active"* on Naukri:

```bash
# Manual test run
node naukri-profile-refresh.js

# Schedule on Windows (Task Scheduler)
powershell -ExecutionPolicy Bypass -File setup-schedule.ps1
```

---

## 📊 Application Rules & Targeting Engine

| Filter | Settings Supported | Behavior |
|---|---|---|
| **Salary Package** | $\ge 18\text{ LPA}$ (Customizable) | Rejects undisclosed / low-bracket jobs; checks 15-25, 25-50, 50-75 LPA brackets |
| **Locations** | Bengaluru, Pune, Hyderabad, Delhi / NCR, Remote | Uses canonical URL slugs or multi-city `cityTypeGid` routing with expanded drawer support |
| **Work Mode** | Hybrid + Remote, Remote Only, Hybrid Only, Office | Maps to verified `wfhType` parameters (2 & 3) |
| **Freshness** | Last 7 Days, Last 3 Days, Last 24 Hours | Restricts searches to recent postings for higher recruiter callback rates |
| **Posted By** | Direct Employers Only | Filters out third-party placement agencies (`postedBy=1`) |
| **Education** | B.Tech / B.E. (NIT Jalandhar) | Restricts search to verified engineering qualifications (`ugTypeGid=12`) |
| **Department** | Engineering - Software & QA | Targets core software development and architecture openings |

---

## 📬 Automated Email Digests

At the conclusion of each application session, JobMatch AI compiles a responsive HTML digest and sends it via Gmail SMTP.

Each entry includes:
* Position Title & Company Name
* Offered Salary Bracket ($\ge 18\text{ LPA}$)
* Match Score Status & Required Skills Met
* Submission Timestamp
* Direct **"View Job on Naukri →"** verification link

Preview the template locally:
```bash
open preview-email.html
```

---

## 🛠 Documentation & Reference Guides

* **[ARCHITECTURE.md](ARCHITECTURE.md)**: Deep dive into the extension architecture, messaging buses, and state synchronization.
* **[PRD.md](PRD.md)**: Complete product requirements document and user personas.
* **[ROADMAP.md](ROADMAP.md)**: Upcoming milestones (AI interview copilot, cross-site synchronization).
* **[fixedNotes.md](fixedNotes.md)**: 17 detailed technical post-mortems documenting DOM investigations and fixes.

---

## ⚠️ Disclaimer

JobMatch AI is built for personal career navigation and job search assistance. Please review the terms of service of any job portal you automate. Delays and interaction cadences are engineered with respectful human-like pacing. Use responsibly.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
