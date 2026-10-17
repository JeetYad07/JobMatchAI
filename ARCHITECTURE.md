# Technical Architecture Document
## JobMatch AI Chrome Extension (Manifest V3)

---

## 1. System Overview

JobMatch AI is built using **Chrome Extensions Manifest V3 (MV3)**, separating concerns across:
1. **Side Panel / Action UI**: The user interface for configuring criteria, initiating runs, viewing live logs, and checking application quotas.
2. **Background Service Worker**: Handles persistent state, scheduled alarms, tab orchestration, backend API authentication, and telemetry.
3. **Injected Content Scripts**: Sandboxed drivers on target job sites (Naukri, LinkedIn, ATS pages) executing search sweeps, questionnaire automation, and DOM interaction.
4. **Cloud Backend**: Python/FastAPI or Node/Express backend powering user authentication, subscription billing (Stripe/Razorpay), Gemini AI question answering, and remote selector configuration.

```
+------------------------------------------------------------------------+
|                          Google Chrome Browser                         |
|                                                                        |
|  +--------------------+         +-----------------------------------+  |
|  |   Side Panel UI    | <=====> |     Background Service Worker     |  |
|  | (React/Vite/Tailw) | Message |  - chrome.alarms (Hourly refresh) |  |
|  +--------------------+         |  - chrome.tabs (Tab supervisor)   |  |
|                                 |  - chrome.storage (User prefs)    |  |
|                                 +-----------------+-----------------+  |
|                                                   |                    |
|                                      chrome.tabs.sendMessage           |
|                                                   |                    |
|                                                   v                    |
|                                 +-----------------+-----------------+  |
|                                 |       Target Page Context         |  |
|                                 |   naukri.com / linkedin.com       |  |
|                                 |  +-----------------------------+  |  |
|                                 |  | Injected Content Script     |  |  |
|                                 |  |  - Salary & Criteria Filter |  |  |
|                                 |  |  - Form & Chatbot Filler    |  |  |
|                                 |  |  - triggerClick Engine      |  |  |
|                                 |  +-----------------------------+  |  |
|                                 +-----------------------------------+  |
+---------------------------------------------------|--------------------+
                                                    |
                                          HTTPS REST API / JWT
                                                    |
                                                    v
+------------------------------------------------------------------------+
|                         JobMatch AI Cloud API                          |
|  - Gemini 2.0 Flash AI Integration (Chatbot answer generation)         |
|  - Remote Dynamic Selectors (/api/v1/selectors/naukri)                 |
|  - User License & Stripe/Razorpay Webhooks                             |
+------------------------------------------------------------------------+
```

---

## 2. Chrome Extension Components (Manifest V3)

### 2.1. `manifest.json` Specifications
* **Manifest Version**: `3`
* **Permissions**:
  * `"storage"`: Store user preferences, seen job IDs, token, and daily counters.
  * `"alarms"`: Schedule periodic profile refresh and batch runs.
  * `"tabs"`: Read tab URLs and inspect opened application tabs.
  * `"scripting"`: Programmatically inject drivers on target pages.
  * `"sidePanel"`: Modern responsive side-panel UI that stays pinned alongside the browser.
* **Host Permissions**:
  * `*://*.naukri.com/*`
  * `*://*.linkedin.com/*`
  * `*://*.indeed.com/*`
  * `https://api.jobmatchai.com/*`

### 2.2. Background Service Worker (`background.js`)
* **Role**: Headless orchestrator. Because MV3 service workers can be terminated after 30 seconds of inactivity, state is strictly persisted to `chrome.storage.local`.
* **Heartbeat & Alarms**:
  * `chrome.alarms.create('profileRefresh', { periodInMinutes: 60 })` triggers the Naukri profile refresher.
  * `chrome.alarms.create('checkActiveRun', { periodInMinutes: 1 })` keeps long runs moving.
* **Tab Supervisor**:
  * Launches target search tab.
  * Manages popup lifecycle (closing finished tabs, preventing tab piling).

### 2.3. Injected Content Script (`content-naukri.js`)
* **DOM Interaction Engine**:
  * **Card Parsing**: Extracts title, company, experience, and salary (`parseSalaryLPA`).
  * **Criteria Validation**: Evaluates `checkJobMatchCriteria(doc)` to confirm 100% match score.
  * **Chatbot Automation**: Controlled React input commit (`_valueTracker` + synthetic event sequence), dual `triggerClick` and `Enter` key emission.
  * **Handoff Management**: Signals external ATS links to background worker.

---

## 3. Remote Dynamic Selector Management (Hotfixes)

To eliminate the risk of Chrome Web Store review delays whenever Naukri alters its DOM classes:
1. Extension fetches current selector registry from `https://api.jobmatchai.com/v1/config/selectors` on startup and caches locally for 6 hours.
2. If Naukri updates a class (e.g., from `.srp-jobtuple-wrapper` to `.job-tuple-card`), the backend updates the JSON endpoint.
3. Extensions adapt instantly without requiring a new extension version release.

```json
{
  "naukri": {
    "version": "2026.10.1",
    "selectors": {
      "jobCards": ".srp-jobtuple-wrapper, article.jobTuple, [class*='jobTuple']",
      "jobTitleLink": "a.title, a[class*='title']",
      "cardSalary": ".sal-wrap, [class*='sal'], span[class*='salary']",
      "applyBtn": "#apply-button, button[id*='apply' i], button.apply-button",
      "chatbot": "[class*='chatbot' i], [class*='_drawer' i][class*='chat' i]"
    }
  }
}
```

---

## 4. Anti-Bot & Detection Prevention

1. **Local Browser Fingerprint**: Running inside the user's logged-in Chrome browser inherits their natural residential IP, Canvas fingerprint, and existing session cookies.
2. **Human Micro-Jitters**:
   - Random delays between applications: $45\text{s} + \text{Math.random()} \times 45\text{s}$.
   - Realistic typing simulation (`typeLikeHuman`) with randomized $40\text{–}120\text{ms}$ keystroke bursts.
   - Smooth mouse event simulation (`PointerEvent` $\to$ `MouseEvent` $\to$ `click`).
3. **Hard Daily Throttles**:
   - Maximum 20 direct applications per day on Naukri.
   - Built-in cooldowns preventing high-frequency bursts that trigger platform abuse alerts.
