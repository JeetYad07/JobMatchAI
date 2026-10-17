# Bug Fixes & Optimization Notes

This document details all the issues identified, root causes, and fixes applied across the automation setup on **October 17, 2026**.

---

## 1. Chatbot Questionnaire Loop & Freeze

### Issue
When applying to jobs that trigger Naukri's application chatbot drawer (e.g. asking *"Do you have your laptop to work"*), the bot repeatedly selected `"Yes"` 15 times, never progressing the turn, and ultimately exited with:
```text
⚠ chatbot: too many turns — finish it manually.
```

### Root Cause
1. **Drawer History Leak**: `drawer.querySelectorAll(SELECTORS.chatOption)` collected option chips from the entire chat history rather than scoping to the latest active question container.
2. **Missing Input Event Dispatches**: Clicking on custom radio/chip `<label>` or `<div class="chip">` elements in modern React components often failed to update internal component state without also dispatching `input` and `change` events on the underlying `<input>` element.
3. **Missing "Next" / "Continue" Buttons**: After choosing an option, Naukri frequently presents buttons like **"Next"**, **"Continue"**, **"Proceed"**, or **"Save & Next"**. The selector only checked `/^send$|^save$|^submit$|^ok$|^done$/i`, completely missing these progression triggers.
4. **Option + Dependent Sub-field Conflict**: In questions like *"DO you have exp with Vue & React/Angular dev?"*, selecting "Yes" reveals a required sub-input (*"Years of experience"* or `<select>` dropdown). Because the code used an `if (options) ... else (input)` structure, choosing "Yes" completely skipped the required number/select field, leaving it blank and failing form validation on Save.

### What Was Fixed
* **Simultaneous Option + Sub-field Execution**: Removed the mutually exclusive `if / else`. Now handles both the option selection AND any adjacent/dependent text, number, or dropdown fields in the same turn.
* **Full Dropdown (`<select>`) Support**: Detects dropdowns and auto-selects your experience level (`CV.yearsNumber` / `CV.yearsInt` = 4) or matching positive option.
* **Expanded `chatInput`**: Now catches `<input type="number">`, generic `<input>`, textareas, and contenteditable elements without missing number inputs.
* **Expanded `chatSendText`**: Added support for `/^send$|^save$|^submit$|^ok$|^done$|^next$|^continue$|^proceed$|^save & next$|^confirm$/i` and fallback selectors for primary/submit buttons.
* **Scattered Option Scoping**: Scoped option picking to the bottom-most / latest options in the drawer (`allOptions.slice(-6)`).
* **Comprehensive Event Dispatching**: Ensured the underlying `<input>` radio/checkbox has its `.checked` attribute set and fires both `input` and `change` events.
* **Validation Error Detection**: Inspects the drawer for `.error` / `.errMsg` spans and logs specific validation errors if the question fails to advance.
* **Loop Detection & Recovery**: Added `repeatCount` tracking; if the question doesn't advance after 3 attempts, it actively searches for and triggers any primary drawer submit/continue button to break the deadlock.
* **Chatbot Completion Screen Detection**: Added recognition for completion messages (*"Thank you for your responses"*, *"responses recorded"*, *"all set"*, *"application submitted"*); it now recognizes that the questionnaire is finished, clicks the final close/done button, and returns a successful application.
* **Whole Integer for HTML5 Number Inputs**: Formats numeric experience fields as whole integers (`4` instead of `4.3`) to prevent browser HTML5 `:invalid` step-mismatch validation errors.
* **Expanded `QA_BANK`**: Added automated answers for common operational questions (`laptop/desktop/system`, `wifi/internet`, `shift/rotational`, `serving notice`, `immediate joiner`, `highest qualification`).

---

## 2. Session Desync Between Profile Refresh and Auto-Apply

### Issue
`node auto-apply-runner.js naukri login` successfully authenticated the apply profile (`.naukri-apply-profile`), but running `node naukri-profile-refresh.js` threw:
```text
Session gone — signing in with Google...
ERROR: page.waitForTimeout: Target page, context or browser has been closed
```

### Root Cause
The repository uses two separate profile directories (`.naukri-chrome-profile` and `.naukri-apply-profile`) so hourly background refreshes don't collide with long-running apply jobs. However, `.naukri-chrome-profile` had no session data. When it tried to sign in using Google credentials headlessly, Google blocked the automated bot login.

### What Was Fixed
* **Automated Profile Sync**: Synced the active session from `.naukri-apply-profile` directly into `.naukri-chrome-profile`.
* **Runner Auto-Sync**: Updated `auto-apply-runner.js` so whenever `node auto-apply-runner.js naukri login` is completed, it automatically copies the authenticated session into `.naukri-chrome-profile`. Both scripts now work seamlessly with a single login.
* **Verification**: `naukri-profile-refresh.js --show` now completes successfully and confirms:
  ```text
  OK: headline dot 1 added (verified), cv up-to-date → "Software Engineer | React.js | ..."
  ```

---

## 3. Hardcoded Fresher Experience Filter

### Issue
In `auto-apply-runner.js`, all Naukri search URLs were hardcoded to `experience=1`:
```javascript
'https://www.naukri.com/full-stack-developer-jobs?experience=1',
'https://www.naukri.com/software-developer-jobs?experience=1',
```
This matched entry-level/internship listings (often asking low-level screening questions like "Do you have your own laptop?") instead of experienced mid/senior roles.

### What Was Fixed
* Updated search URLs to dynamically pull the candidate's actual experience level from `.env` (`CV.yearsNumber` = 4):
  ```javascript
  `https://www.naukri.com/full-stack-developer-jobs?experience=${Math.min(Number(CV.yearsNumber) || 3, 4)}`
  ```
* Added searches for Frontend, React, Node.js, and Full Stack developer jobs tuned for 3–5 years of experience.

---

## 4. macOS Window Management Compatibility

### Issue
`window-utils.js` uses Windows-specific PowerShell and C# Win32 APIs (`user32.dll`, `ShowWindow`). On macOS, passing `--window-position=-32000,-32000` pushed the browser completely off-screen with no way to restore it, and running background hiding sweeps threw silent warnings.

### What Was Fixed
* Added platform checks (`process.platform !== 'win32'`) in both `auto-apply-runner.js` and `naukri-profile-refresh.js`.
* On macOS, Chrome launches cleanly with standard on-screen coordinates (`--window-position=0,0`), preventing window manager issues or Playwright context closures.
* Skipped Windows-only PowerShell hide sweeps on non-Windows platforms.

---

## 5. Dynamic Experience Calculation (Joined June 2022)

### Requirement
Calculate the candidate's professional experience dynamically from their career start date (**June 2022**) rather than using static hardcoded strings.

### What Was Implemented
* **`CAREER_START_DATE` in `.env`**: Added `CAREER_START_DATE=2022-06-01` (with fallback to June 2022 if omitted).
* **Real-time `calcExperience()` in `config.js`**:
  * Calculates the exact elapsed duration between `CAREER_START_DATE` and the current date:
    - Decimal representation (`num`): `4.3` (used for numeric forms & chatbot inputs).
    - Integer representation (`int`): `4` (used for discrete integer dropdowns & search URL bounds).
    - Detailed string (`detailed`): `4.3 years (4 yrs 4 mos)`.
    - Formatted string (`text`): `4.3 years professional experience`.
  * As time progresses, this automatically increments (e.g. 4.5 in early 2027, 5.0 in June 2027) without needing manual `.env` edits.
* **Auto-integrated**: Automatically feeds `CV.yearsOfExperience`, `CV.yearsNumber`, and search URL experience filters across Naukri, Wellfound, and external ATS forms.

---

## 6. Naukri Application Confirmation & External Apply Handover Fixes

### Issue 1: Direct Applications Flagged as "Could Not Confirm Success"
* **Symptom**: After filling chatbot questionnaires or clicking Apply, direct Naukri applications navigated to `https://www.naukri.com/myapply/saveApply?...` but the console reported `⚠ could not confirm success`.
* **Root Cause**: The confirmation function only checked for toast text or the original Apply button label. Because Naukri navigates the popup window upon submission, the original Document detached and the toast was not captured.
* **Fix in [naukri-auto-apply.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/naukri-auto-apply.js)**: Added navigation URL pattern matching `/saveApply|myapply/i.test(url)` to immediately mark the submission as verified and confirmed.

### Issue 2: External Apply Queue Handover Lag
* **Symptom**: When encountering "Apply on company site" jobs, the in-page script logged `↩ queued 1 external jobs — yielding so the runner can apply to them.` and `Finished. Applied to 0 jobs total.`, but the runner paused before launching external ATS applications.
* **Root Cause**: The runner supervisor loop used a monolithic `setTimeout(45000)` (45s). When the in-page script yielded quickly (5 seconds), the runner waited up to 40 seconds idle before checking `externalQueue`.
* **Fix in [auto-apply-runner.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/auto-apply-runner.js)**: Replaced the blind 45s sleep with a responsive polling loop that wakes immediately within 2 seconds as soon as an external job is queued and the in-page script has yielded.

---

## 7. Chatbot Save Button & Controlled Input Event Fixes

### Issue: "Save" Button Clicked in Log but Not Advancing in UI
* **Symptom**: In the chatbot questionnaire, the console logged `🔘 clicked: "Save"`, but visually the button did not respond or required multiple repeats before advancing.
* **Root Cause**:
  1. **Controlled React Input State**: Naukri's chatbot questionnaire uses controlled inputs with internal state (`_valueTracker`). Simply setting `proto.value` without updating `_valueTracker` or firing `blur` kept the React component from committing the state, leaving the "Save" button in a disabled or pristine state.
  2. **Synthetic vs. Real Mouse Event Sequence**: A plain `el.click()` does not fire `pointerdown`, `mousedown`, `pointerup`, or `mouseup` events, which modern UI frameworks and button wrappers listen to.
  3. **Button Hierarchy**: The Save control is often wrapped in a `<button>` or custom container where clicking the outer or inner text node alone fails to bubble properly.
* **Fix Applied**:
  - Implemented `triggerClick(el, doc)`: scrolls element into center view, dispatches `pointerdown` -> `mousedown` -> `focus` -> `pointerup` -> `mouseup` -> `.click()`, and delegates to `closest('button, [role="button"]')`.
  - Updated input committing: calls `input.focus()`, synchronizes React's `_valueTracker`, dispatches `InputEvent` (`insertText`), `change`, `keydown`, `keyup`, and `blur`.
  - Dual submission: dispatches both `triggerClick(send)` and native `Enter` keyboard events on the active input so the questionnaire advances instantaneously.

---

## 8. Minimum Package (18 LPA) & Job Match Criteria Enforcement

### Requirements
1. **Minimum Package 18 LPA**:
   - Strictly filter for jobs with a disclosed salary of at least 18 LPA (`MIN_SALARY_LPA=18`).
   - Automatically skip all jobs with "Not disclosed" salary or salary ranges below 18 LPA.
2. **Job Match Score Criteria**:
   - Verify that all criteria evaluated by Naukri (Keyskills, Experience, Location, Education) show as matched/fulfilled on the job page before applying.
   - If any criterion is unmet (e.g. "Not matched", "Unmatched", or less than 100% criteria ratio), skip the application.

### Implementation Details
* **Naukri Search URL Optimization**:
  - In [auto-apply-runner.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/auto-apply-runner.js), updated search URLs to append `&ctcFilter=15to25&ctcFilter=25to50&ctcFilter=50to75` so Naukri natively delivers higher-compensation developer listings.
* **Fast Card-Level Salary Filter**:
  - In [naukri-auto-apply.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/naukri-auto-apply.js), implemented `parseSalaryLPA(text)` and `getCardSalary(card)`:
    - Parses text patterns like `"18-25 Lacs PA"`, `"20-30 Lacs P.A."`, `"1.8-2.5 Cr"`.
    - Directly skips cards with "Not disclosed" or packages whose maximum is below 18 LPA without wasting time opening popup windows.
* **Popup Salary & Match Criteria Verification**:
  - Inside `applyInPopup`:
    1. Double-checks the displayed package on the full job listing page to ensure $\ge 18\text{ LPA}$.
    2. Runs `checkJobMatchCriteria(popupDoc)`:
       - Checks criteria ratio (e.g., $4\text{ of }4$, $5\text{ of }5$). If $\text{matched} < \text{total}$, skips the job.
       - Scans for negative badges/indicators (`not-matched`, `unmatched`, `mismatch`).
       - If any criterion is unfulfilled, logs the specific unmet criterion and cleanly aborts application for that job.
* **Configurable via `.env`**:
  - Added `MIN_SALARY_LPA=18` and `REQUIRE_ALL_CRITERIA_MATCHED=true` to [.env](file:///Users/jeetyadav/Workspace/Automation/naukri_update/.env) and [config.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/config.js).

---

---

## 9. Application Email Digest & Notification Service

### Feature Overview
Integrated an end-of-run email digest notification service that sends a rich, responsive HTML summary report of all submitted applications directly to your inbox via Gmail SMTP (or any custom SMTP server).

### Key Information Included in the Digest
1. **Job Details**:
   - Job Title / Role
   - Company Name (extracted from page DOM or parsed from Naukri URL slug)
   - Disclosed Package / CTC (e.g. `💰 ≥ 18 LPA` or `💰 18 - 25 Lacs PA`)
   - Direct clickable link (`View Job on Naukri →`)
2. **Requirements & Matching**:
   - Mandatory Requirements: Key Skills required (e.g. `React.js, Node.js, TypeScript, SQL`)
   - Job Match Score Status: `🎯 100% Criteria Fulfilled (Key Skills, Experience, Location, Education)`
   - Job Description snippet / role overview
3. **Application Status & Timestamps**:
   - Status badge (`Verified on Naukri` or `Submitted`)
   - Exact timestamp of application submission
4. **Session Metrics Banner**:
   - Total applications submitted in the session
   - Filter criteria enforced: Package $\ge 18$ LPA & 100% criteria fulfillment
   - Candidate profile details dispatched

### How to Configure Gmail SMTP
1. Enable 2-Step Verification on your Google Account:
   - Visit: [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Generate an **App Password**:
   - Visit: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select App Name: `"JobMatch AI"`
   - Google will display a 16-character password (e.g. `abcd efgh ijkl mnop`).
3. Update your [.env](file:///Users/jeetyadav/Workspace/Automation/naukri_update/.env) file:
   ```env
   EMAIL_NOTIFICATIONS=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=jeetb.yadav11@gmail.com
   SMTP_PASS=abcdefghijklmnop
   NOTIFICATION_EMAIL=jeetb.yadav11@gmail.com
   ```
4. Test sending locally anytime:
   ```bash
   # Test email configuration and generate a preview
   node email-notifier.js

   # Send digest of today's applied jobs from applications.csv
   node email-notifier.js --today
   ```

---

## 10. Summary of Modified Files

| File | Changes Made |
|---|---|
| [.env](file:///Users/jeetyadav/Workspace/Automation/naukri_update/.env) & [.env.example](file:///Users/jeetyadav/Workspace/Automation/naukri_update/.env.example) | Loaded resume details, skills, 5 highlights, links, career start date, `MIN_SALARY_LPA=18`, `REQUIRE_ALL_CRITERIA_MATCHED=true`, and SMTP email settings. |
| [config.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/config.js) | Implemented dynamic experience calculation from June 2022; exposed `minSalaryLPA`, `requireAllCriteria`, and `emailConfig`. |
| [email-notifier.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/email-notifier.js) | Created email service with rich responsive HTML digest, SMTP transporter, company slug parser, and CSV reader. |
| [preview-email.html](file:///Users/jeetyadav/Workspace/Automation/naukri_update/preview-email.html) | Local design preview generated with the 10 real applications submitted today. |
| [naukri-auto-apply.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/naukri-auto-apply.js) | Implemented card-level & popup salary filtering ($\ge 18\text{ LPA}$, skips undisclosed), 100% job match criteria check, company and skills extraction, and React synthetic event triggers. |
| [auto-apply-runner.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/auto-apply-runner.js) | Dynamic experience level matching (`exp=4`), CTC bracket search filters, structured logging parser, session application tracking, and end-of-run email digest dispatch. |
| [PRD.md](file:///Users/jeetyadav/Workspace/Automation/naukri_update/PRD.md) | Product Requirements Document for commercial Chrome Extension SaaS (JobMatch AI). |
| [ARCHITECTURE.md](file:///Users/jeetyadav/Workspace/Automation/naukri_update/ARCHITECTURE.md) | Technical architecture for Manifest V3 extension, Side Panel, Background Worker, and dynamic selectors. |
| [ROADMAP.md](file:///Users/jeetyadav/Workspace/Automation/naukri_update/ROADMAP.md) | 5-phase roadmap from extension MVP to Chrome Web Store launch and subscription billing. |
| [extension/manifest.json](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/manifest.json) | Manifest V3 specification with sidePanel, storage, alarms, and Naukri host permissions. |
| [extension/background/service-worker.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/background/service-worker.js) | Background service worker handling action click, side panel behavior, storage sync, and badge counting. |
| [extension/sidepanel/](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/sidepanel/) | Glassmorphic, modern Side Panel UI with real-time stats, quality filters, and live activity feed. |
| [extension/content/naukri-content.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/content/naukri-content.js) | In-page content script executing card scanning, CTC filters, 100% criteria verification, and chatbot answering. |
| [extension/icons/](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/icons/) | High-resolution crisp icons (16px, 48px, 128px) with modern blue gradient branding. |

---

## 11. Phase 1: Chrome Extension Setup & Testing Guide

### How to Load the Extension in Chrome (Developer Mode)
1. Open Google Chrome.
2. In the URL bar, go to: `chrome://extensions/`
3. In the top-right corner, turn on **Developer mode**.
4. In the top-left, click **Load unpacked**.
5. Select the directory:
   `/Users/jeetyadav/Workspace/Automation/naukri_update/extension`
6. Pin **JobMatch AI** to your Chrome toolbar.
---

## 12. Extension Live Feed, Field Clearing & Email Bridge Fixes

### Issues Reported
1. **Live Automation Feed not streaming**: Clicking Start didn't stream logs in real time, and logs appeared in reverse order.
2. **Field Not Clearing**: When the chatbot drawer asked numeric/text questions, the field was not properly cleared before typing, and the Clear button in the Side Panel didn't wipe the feed completely.
3. **Post-Apply Not Sending Email**: Because Chrome Extensions cannot open raw TCP SMTP sockets to Gmail directly from the browser, post-apply emails were not being dispatched.

### Root Causes & Fixes Applied

#### 1. Live Feed & Script Injection Fix
* **Tab Targeting & Scripting Injection**: When opening the Side Panel, active tabs opened *prior* to installing the extension didn't have `naukri-content.js` loaded. We added the `"scripting"` permission to [manifest.json](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/manifest.json) and programmatically injected `naukri-content.js` on `START_APPLY` via `chrome.scripting.executeScript`.
* **Zero-Latency Live Streaming**: In `naukri-content.js`, every `log()` call broadcasts a direct `LIVE_LOG` message to the runtime. `sidepanel.js` immediately appends the log entry to the DOM and autoscrolls to the bottom.
* **Chronological Ordering**: Logs are stored and rendered in chronological order so the newest logs always appear at the bottom.

#### 2. Robust React Input Field Clearing Fix
* **Controlled React Input Clearing**: Ported the full `fillInput(doc, input, answer)` engine from the Playwright runner into [naukri-content.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/content/naukri-content.js):
  - Focuses input and calls `input.select()`.
  - Clears `input._valueTracker.setValue('')` and resets `.value = ''`.
  - Invokes `HTMLInputElement.prototype` native setter with the desired answer.
  - Dispatches full event suite (`input`, `InputEvent`, `change`, `keydown`, `keyup`, and `blur`).
* **Side Panel Clear Button**: Updated `btnClearLogs` in [sidepanel.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/sidepanel/sidepanel.js) so clicking **Clear** completely wipes the feed immediately (`logStream.innerHTML = ''`).

#### 3. Post-Apply Email Bridge Service
* **Local HTTP Bridge Server (`port 3099`)**: Added `startEmailBridgeServer()` in [email-notifier.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/email-notifier.js) with CORS enabled.
* **Service Worker Forwarding**: On session finish, or whenever a job is submitted, the extension dispatches an HTTP request to `http://127.0.0.1:3099/api/send-digest`, which immediately compiles and delivers the Gmail digest to `imjeet227@gmail.com`.
* **Manual "✉ Send Digest to Email" Action**: Added a direct action button in the Side Panel allowing you to trigger a digest email anytime for today's applied jobs with 1 click.

---

## 13. Fix: "No more new eligible jobs found (0 applications in 0ms)" & Double Run

### Why It Happened:
1. **Missing `waitForCards()`**: Naukri is an SPA where job cards render asynchronously via React 1–3 seconds after page load. Without a polling wait, `document.querySelectorAll(SELECTORS.jobCards)` queried the DOM at millisecond 0, found 0 cards, concluded the search was empty, and exited instantly (0ms).
2. **Non-Search Tab**: If the active tab was on `naukri.com` (homepage) or `naukri.com/mnjuser/profile`, no job cards exist on the page.
3. **Double Execution**: Because the run completed in ~0ms, the button reset instantly, causing a double-fire if clicked rapidly. Additionally, injecting the content script unconditionally via `executeScript` when it was already running caused duplicate listener events.

### Fixes Applied:
1. **Dynamic `waitForCards(15000)` Polling**:
   - In [naukri-content.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/content/naukri-content.js), the extension now polls every 500ms for up to 15 seconds until job cards are rendered in the DOM.
2. **Search Page Detection & Auto-Navigation**:
   - If the active tab is on `naukri.com` homepage or profile instead of a search results page, the extension automatically logs a notice and navigates the tab to `https://www.naukri.com/full-stack-developer-jobs?experience=4&ctcFilter=15to25&ctcFilter=25to50&ctcFilter=50to75`.
3. **Resilient Card Selectors**:
   - Expanded card matching: `.srp-jobtuple-wrapper, article.jobTuple, [data-job-id], .cust-job-tuple, .jobTuple, [class*="jobtuple" i], [class*="srp-tuple" i], [class*="tuple-wrapper" i], div.styles_job-tuple-container__srp`, plus fallback to link wrappers.
4. **Diagnostic Scan Logs**:
   - Instead of exiting silently, the extension now reports exact card stats:
     `Page 1 summary (20 cards): 14 < 18 LPA, 4 undisclosed, 2 already seen.`
5. **Debounce & PING Handshake**:
   - [sidepanel.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/sidepanel/sidepanel.js): Added 1.5s debounce and button disable to prevent double clicks.
   - [service-worker.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/background/service-worker.js): Pings the tab first to verify if the content script is active before attempting fallback injection.

---

## 14. Smart Search & Targeting Hub (Resume-Driven Filters & Auto-Pilot)

### Capabilities Added:
1. **Targeting & Search Filters UI in Side Panel**:
   - **Target Role**: Dropdown (`Full Stack Developer`, `Software Engineer`, `React Developer`, `Node.js Developer`, `AI / GenAI Engineer`).
   - **Experience**: Configurable numeric input (default: 4 years).
   - **Locations**: Interactive multi-select chip pills (`Bengaluru`, `Remote`, `Pune`, `Hyderabad`, `Delhi / NCR`).
   - **Work Mode**: Select (`Hybrid + Remote`, `Remote Only`, `Hybrid Only`, `Work from Office`, `Any Work Mode`).
   - **Freshness**: Select (`Last 7 Days (Optimal)`, `Last 3 Days (High Callback)`, `Last 24 Hours`, `Last 15 Days`, `Any Time`).
   - **Posted By**: Select (`Direct Employer (No Agencies)` vs `All`).
   - **Department**: Select (`Engineering - Software & QA`, `Data Science`, `Product Management`).
   - **Company Type**: Select (`MNCs & Startups`, `Foreign MNC & Corporate`, `Startups & Unicorns`, `All`).
   - **Education**: Select (`B.Tech / B.E. (NIT Jalandhar)`, `Any Graduate`).
   - **Auto-Pilot Navigation**: Toggle to automatically navigate the tab to this parameterized search before starting.

2. **"✨ Fill from Resume" 1-Click Preset**:
   - Reads candidate's verified profile data:
     - 4 Yrs Exp, B.Tech NIT Jalandhar
     - $\ge 18$ LPA CTC
     - Locations: Bengaluru & Remote (Hybrid + Remote)
     - Department: Engineering - Software & QA
     - Posted by: Direct Employers Only
     - Freshness: Last 7 Days
     - Company Type: MNCs & Startups
   - Instantly updates all form inputs, toggles, and chips in one click.

3. **URL Parameter Generator & Preview**:
   - Builds exact Naukri search query URLs (e.g. `https://www.naukri.com/full-stack-developer-jobs?experience=4&ctcFilter=15to25&ctcFilter=25to50&ctcFilter=50to75&cityTypeGid=9508&wfhType=2&wfhType=3&jobAge=7&postedBy=1&ugTypeGid=12&glbl_qc_dept=engineering---software-qa_1`).
   - Added **"🔍 Preview Filtered Search in Tab →"** button so the user can inspect matching job listings on Naukri at any time.

4. **Auto-Pilot Navigation on "Start Auto-Apply"**:
   - If enabled, when the user clicks **"Start Auto-Apply"**, the extension checks if the active tab is already on that exact search URL. If not, it automatically updates the tab to the filtered search URL (or opens a new tab if none is open), waits for the page to load, and initiates the auto-apply loop.

---

## 15. Fix: Active On-Page Sidebar Facet Synchronization

### Why URL-Only Filters Did Not Check the Checkboxes:
Naukri's search page is a client-side Single Page Application (SPA). While URL parameters like `experience` and `ctcFilter` are read on load, most facet filters (**Posted by**, **Freshness**, **Work mode**, **Department**, **Company type**, and **Education**) are strictly managed through its left sidebar DOM checkboxes and custom dropdowns (`chk-*-*` and `#filter-freshness`). Passing arbitrary query parameters in the address bar was ignored by Naukri's React router, leaving the sidebar checkboxes unchecked.

### The Real-Time Solution: `syncSidebarFilters`:
We inspected the live DOM of modern Naukri and built an active synchronization engine in [naukri-content.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/content/naukri-content.js):
1. **Posted By: Company Jobs**: Clicks `label[for*="Company Jobs-jobPostType-"]` to exclude 3rd-party consultancies.
2. **Work Mode**: Clicks `chk-Hybrid-wfhType-` and `chk-Remote-wfhType-`.
3. **Locations**: Clicks `chk-Bengaluru-cityTypeGid-`, `chk-Pune-cityTypeGid-`, `chk-Remote-wfhType-`, etc.
4. **Freshness**: Clicks `#filter-freshness` dropdown button, then clicks the `<li>` option for `Last 7 days` (or `Last 3 days`, `Last 24 hours`).
5. **Department**: Clicks `chk-Engineering - Software & QA-functionAreaIdGid-`.
6. **Company Type**: Clicks `Foreign MNC`, `Corporate`, and `Startup` (`chk-*-qbusinessSize-`).
7. **Education**: Clicks `chk-B.Tech / B.E.-ugTypeGid-`.
8. **Salary (CTC)**: Clicks `chk-15-25 Lakhs-ctcFilter-` and `chk-25-50 Lakhs-ctcFilter-`.

### Side Panel Actions:
- **"⚡ Apply Filters to Page"**: Instantly clicks all the corresponding checkboxes on the open Naukri tab in front of your eyes.
- **"▶ Start Auto-Apply"**: Automatically executes `syncSidebarFilters()` before scanning cards, ensuring 100% adherence to all resume-targeted criteria.

---

## 16. Fix: Location Selection & Multi-City Routing Engine

### Issue
Selecting locations in the Side Panel (e.g. Pune, Hyderabad, Remote, or Multi-City) failed to update the search results or check the corresponding boxes on the Naukri search page.

### Root Cause Analysis (DOM & Network Reverse-Engineering)
1. **Canonical Slugs vs GIDs**:
   - Naukri supports canonical slugs for single-city searches:
     - Bengaluru: `/full-stack-developer-jobs-in-bengaluru` (GID `97`)
     - Pune: `/full-stack-developer-jobs-in-pune` (GID `139`)
     - Hyderabad: `/full-stack-developer-jobs-in-hyderabad-secunderabad` (GID `17`)
     - Delhi / NCR: `/full-stack-developer-jobs-in-delhi-ncr` (GID `9508`)
2. **Remote Is NOT a City**:
   - Previously, the URL generator produced `/full-stack-developer-jobs-in-remote`, returning a 404 / 0 jobs page. Remote is a Work Mode (`wfhType=3`), not a geographic city slug.
3. **Multi-Location Search Mechanics**:
   - Naukri expresses multi-city queries using repeated `cityTypeGid` parameters on the base search path:
     `https://www.naukri.com/full-stack-developer-jobs?cityTypeGid=97&cityTypeGid=139` (Bengaluru + Pune).
4. **Sidebar "View More" Drawer & Mandatory Apply Button**:
   - On modern Naukri, only top cities (Bengaluru, Delhi / NCR, Hyderabad) are directly visible in the unexpanded sidebar.
   - Cities like Pune are hidden inside `<a id="cityTypeGid">View More</a>`.
   - In this expanded swiper drawer, clicking a checkbox does **NOT** apply instantly; the user/script **must click** `.styles_filter-apply-btn__MDAUd` ("Apply") to commit the selection.
5. **Auto-Pilot Navigation Condition**:
   - `service-worker.js` checked `!currentUrl.includes(targetUrl.split('?')[0])`, which prevented navigation when changing locations or parameters that shared the same base path.

### What Was Fixed
* **Unified City GID & Slug Dictionary**:
  Added verified mappings for all target cities:
  - `bengaluru`: `in-bengaluru`, GID `97`
  - `pune`: `in-pune`, GID `139`
  - `hyderabad`: `in-hyderabad-secunderabad`, GID `17`
  - `delhi`: `in-delhi-ncr`, GID `9508`
  - `remote`: strictly mapped to `wfhType=3`
* **Intelligent Search URL Builder (`buildNaukriSearchUrl`)**:
  - If a single physical city is chosen: generates clean canonical path slug `/${roleSlug}-jobs-${CITY_SLUGS[city]}`.
  - If multiple physical cities are chosen: generates base URL with repeated `cityTypeGid` parameters (`?cityTypeGid=97&cityTypeGid=139`).
  - If only Remote is selected: generates base URL with `?wfhType=3` without broken `-in-remote` slugs.
* **On-Page Sidebar Expansion & Apply**:
  - In `naukri-content.js`, if a selected city (such as Pune) is not visible in the top sidebar, it clicks `#cityTypeGid` ("View More"), selects the checkbox, and clicks the `.styles_filter-apply-btn__MDAUd` button.
  - Added pacing (`sleep(350)`) between clicks to allow React state updates without race conditions.
* **Auto-Pilot Navigation Accuracy**:
  - Updated `service-worker.js` to compare query parameters (`urlsEqual`), ensuring that changing any filter or location in the Side Panel triggers navigation to the exact targeted search page.

---

## 17. Fix: "Apply Filters" One-Click Target Navigation & Substring False-Positive

### Issue
Clicking **"⚡ Apply Filters to Page"** in the Side Panel either logged a disconnected tab warning or failed to apply the selected filters to the open Naukri tab.

### Root Causes
1. **Sub-string False Positive in `isLabelChecked`**:
   - Naukri's unchecked checkbox icon has `class="ni-icon-unchecked"`.
   - The code previously checked `icon.className.includes('checked')`.
   - Because `"unchecked"` contains the substring `"checked"`, every single unchecked checkbox in the DOM evaluated to `true` (already checked). The script concluded all filters were already active and skipped clicking them.
2. **Page Navigation on Any Facet Click**:
   - Naukri's architecture reloads the search results upon clicking any facet checkbox. Attempting to click 8 different checkboxes sequentially in the DOM causes subsequent clicks to unmount or collide with React re-renders.
3. **"Apply Filters" Button Action**:
   - The button previously sent an in-page `SYNC_FILTERS` message without updating the tab's search URL. If the user was on the homepage or an unparameterized search, nothing happened.

### What Was Fixed
* **Fixed `isLabelChecked`**:
  Strictly checks for `icon.classList.contains('ni-icon-checked')` and explicitly returns `false` if `icon.classList.contains('ni-icon-unchecked')`.
* **Atomic Filter Navigation on "Apply Filters to Page"**:
  Updated [sidepanel.js](file:///Users/jeetyadav/Workspace/Automation/naukri_update/extension/sidepanel/sidepanel.js) so clicking **"⚡ Apply Filters to Page"** directly computes `buildNaukriSearchUrl(filters)` with all 10 criteria (Role, Single/Multi-City, Experience, Salary, Work Mode, Freshness, Direct Employer, Department, Company Type, Education) and updates the active tab (`chrome.tabs.update`).
  - This natively applies 100% of the targeting criteria in one atomic load without DOM race conditions.
  - Live feedback is streamed to the Side Panel log confirming the filters applied.

---

## 18. Fix: P0 Dynamic Candidate Profile Customizer & Anti-Detection Pacing

### Issues Identified
1. **Hardcoded Candidate Credentials**: Candidate profile details (Name, Email, Phone, Company, Experience, Education, CTC, LinkedIn, GitHub) were statically hardcoded in `naukri-content.js`. Modifying candidate information required manual source-code editing.
2. **Fixed Bot-Like Timing (3.5s)**: Applying to jobs with a constant 3.5s sleep delay creates a distinct synthetic fingerprint susceptible to anti-bot detection and rate-limiting on Naukri.

### What Was Fixed
1. **Dynamic Candidate Profile Editor Drawer**:
   - Added an expandable/collapsible drawer in the Side Panel under **Candidate Profile**.
   - Added individual input controls for Full Name, Email, Phone, Current Role, Company, Experience (Yrs), Education, Location, Notice Period, Current CTC, Expected CTC, LinkedIn, and GitHub.
   - Provides **"💾 Save Profile"** (persisted in `chrome.storage.local.candidateProfile`) and **"↺ Reset to Jeet's Verified CV"** for instant 1-click restoration.
   - Live summary card in the Side Panel updates reactively upon editing.
2. **Dynamic Content Script Profile Binding**:
   - `naukri-content.js` dynamically pulls candidate details from `config.candidateProfile` or `chrome.storage.local`.
   - `buildQABank()` compiles regular expressions and answer mappings dynamically, automatically parsing notice period days, expected CTC salary baselines, city names, and education credentials.
3. **Pacing Speed Selector & Human Jitter Delays**:
   - Added **Pacing & Human Delay** selector in the Side Panel:
     - **Stealth Safe (anti-bot)**: Random delay between 8,000ms and 18,000ms (Default).
     - **Balanced**: Random delay between 5,000ms and 10,000ms.
     - **Fast**: Random delay between 3,000ms and 6,000ms.
   - Logs real-time delay: `⏳ Human pacing delay: waiting Xs before next job...`.
4. **Typing Micro-Jitter in `fillInput`**:
   - Emulates natural human keystroke intervals with a 40–90ms random micro-sleep between clear and insert events, ensuring React forms recognize keystrokes without synthetic event flags.



