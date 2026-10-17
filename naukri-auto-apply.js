/**
 * Naukri Auto-Apply — personal data loaded from .env
 * =================================
 * HOW TO USE:
 * 1. Log in to naukri.com and open a job search, e.g.
 *    https://www.naukri.com/full-stack-developer-jobs?experience=1
 *    (any search works — the script filters titles itself).
 * 2. ALLOW POPUPS for naukri.com (the script opens each job in a popup window
 *    it controls — same origin, so one paste drives many applications).
 *    Chrome: click the blocked-popup icon in the address bar → Always allow.
 * 3. Open DevTools console (F12 → Console), paste this WHOLE file, press Enter.
 *    Keep BOTH the search tab and the popup visible; don't close the popup.
 * 4. It starts in DRY_RUN mode: it opens each matching job and finds the Apply
 *    button but does NOT click it. Watch a couple, then set DRY_RUN = false
 *    and re-paste to apply for real.
 *
 * WHAT IT DOES PER JOB:
 * - Skips "Apply on company site" (external) and already-applied jobs.
 * - Clicks Apply (one-click — Naukri sends your profile + resume).
 * - If Naukri's chatbot questionnaire pops up, answers each question from the
 *   QA bank below (radio/chip options: picks the "yes/willing" style one;
 *   text questions: typed answer). Unmatched questions optionally go to Gemini.
 *
 * NOTES:
 * - When the current results page is exhausted it clicks Next — that reloads
 *   the page and KILLS the script; PASTE AGAIN there. Progress is kept in
 *   localStorage so it continues where it left off.
 * - Naukri changes its HTML often; lookups are text-based to survive that, but
 *   if it stops finding things, update the SELECTORS section.
 * - Auto-applying may violate Naukri's ToS. Delays are human-ish. Use at your own risk.
 */
(async function naukriAutoApply() {
  'use strict';

  // Personal data is injected by the runner from .env (window.__APPLY_CONFIG); nothing PII is hard-coded here.
  const __CFG = (typeof window !== 'undefined' && window.__APPLY_CONFIG) || {};

  // ======================= CONFIG =======================
  const CONFIG = {
    DRY_RUN: true,             // true = open jobs + locate Apply but never click it. Flip to false when ready.
    MAX_APPLICATIONS: 15,      // stop after this many applications this run (tracked across pastes)
    EXTERNAL_BATCH: 1,         // apply to external jobs immediately as soon as they are found
    // Wait between applications, randomised between min/max. Raised from 8-20s: an
    // hourly run only needs ~10 applications, so there is a whole hour to spread them
    // over, and a steady application every 10s is a far stronger automation signal
    // than anything the stealth plugin can hide. 10 jobs now take ~8-20 minutes.
    MIN_DELAY_MS: 45000,
    MAX_DELAY_MS: 120000,
    geminiKey: __CFG.geminiKey || '',   // optional: Gemini API key for unmatched chatbot questions

    // Job titles to apply to (case-insensitive substring match on the job title)
    TITLE_KEYWORDS: [
      'full stack', 'fullstack', 'full-stack', 'mern', 'backend', 'back end',
      'frontend', 'front end', 'software engineer', 'software developer',
      'web developer', 'ai engineer', 'ai developer', 'ai specialist',
      'ml engineer', 'artificial intelligence', 'machine learning',
      'generative ai', 'gen ai', 'genai', 'llm', 'agentic',
      'react', 'node', 'javascript', 'js developer', 'js engineer',
      'typescript', 'python', 'mobile',
      'react native', 'sde', 'member of technical staff',
    ],
    // Skip jobs whose title contains any of these
    TITLE_BLOCKLIST: [
      'senior staff', 'principal', 'director', 'manager', 'lead', 'devops',
      'data engineer', 'qa', 'test', 'intern', 'designer', 'sales', 'marketing',
      '.net', 'c#', 'php', 'ruby', 'golang', 'ios', 'android native', 'flutter',
    ],
    MIN_SALARY_LPA: Number(__CFG.CV?.minSalaryLPA) || 18,
    REQUIRE_ALL_CRITERIA_MATCHED: __CFG.CV?.requireAllCriteria !== false,
  };

  // ======================= CV DATA (from .env via the runner) =======================
  const CV = __CFG.CV || {
    name: '', email: '', phone: '', location: '', currentRole: '', company: '', education: '',
    yearsOfExperience: '', yearsNumber: '1', skills: '', highlights: ['', '', '', '', ''], noticePeriod: '',
    currentCTC: '', expectedCTC: '', currentSalary: '', expectedSalary: '', dob: '', gender: '',
    workAuth: '', github: '', linkedin: '', portfolio: '', links: '', remoteOk: '', relocate: '', startDate: '',
    minSalaryLPA: 18, requireAllCriteria: true,
  };

  // ============== QUESTION → ANSWER BANK ==============
  // First pattern that matches the question text wins. Naukri chatbot questions
  // are often numeric/short — keep those answers terse.
  const QA_BANK = [
    [/company name|current (company|employer)|organi[sz]ation/i, CV.company],
    [/notice period|when can you (start|join)|start date|joining|how soon/i, CV.noticePeriod],
    [/current .{0,15}(ctc|salary|compensation|annual)/i, CV.currentCTC],          // bare lakhs number
    [/(expected|desired) .{0,15}(ctc|salary|compensation|pay)|salary expectation/i, CV.expectedCTC], // bare lakhs
    [/years? of (work |professional |total |relevant )?experience|how (long|many years)|total experience|relevant experience/i, CV.yearsNumber || '4'],
    [/(react|node|javascript|frontend|backend) experience/i, CV.yearsNumber || '4'],
    [/laptop|desktop|computer|pc|system|wifi|internet|broadband/i, 'Yes'],
    [/shift|rotational|night shift|day shift/i, 'Yes'],
    [/serving notice|currently serving/i, 'No'],
    [/immediate joiner|can join immediately/i, 'Yes'],
    [/highest qualification|highest education|degree/i, 'B.Tech'],
    [/remote|work from home|wfh/i, CV.remoteOk],
    [/reloc|move to|shift to|based out of|work from (our )?office|commute|on-?site/i, CV.relocate],
    [/e-?mail/i, CV.email], // before location — "Email address" must not match /address/
    [/where are you .{0,15}(based|located)|current location|city|address/i, CV.location],
    [/visa|sponsorship|work authorization|legally authorized|right to work|citizen/i, CV.workAuth],
    [/\blinkedin\b/i, CV.linkedin],
    [/\bgithub\b/i, CV.github],
    [/portfolio|personal website/i, CV.portfolio],
    [/linkedin|github|portfolio|website|link/i, CV.links],
    [/why (do you want|are you interested|this role|this company|us|join)/i,
      `I ship production features end to end. ${CV.highlights[0] || ''}. This role matches my stack directly, and I want to keep building products with real ownership.`],
    [/tell (us|me) about yourself|introduce yourself|about you|summary/i,
      `I'm ${CV.name}, ${CV.currentRole}. ${CV.highlights[0] || ''}. Previously: ${CV.highlights[2] || ''}. ${CV.highlights[3] || ''}.`],
    [/react|frontend|front-end/i,
      `Strong frontend experience: React.js, Next.js, Redux, TypeScript and Tailwind CSS, plus React Native.`],
    [/node|backend|back-end|api/i,
      `I build production backends daily: Node.js/Express and Python/FastAPI, REST + GraphQL, WebSockets, MongoDB/PostgreSQL/Redis, on cloud with Docker and CI/CD.`],
    [/\b(ai|llm|ml|machine learning|genai|langchain)\b/i,
      `AI is a core focus: production GenAI agents, RAG pipelines, tool calling, MCP and multi-agent systems.`],
    [/education|degree|university|college|qualification/i, CV.education],
    [/phone|contact number|mobile/i, CV.phone],
    [/^name$|your name|full name|candidate name|first name/i, CV.name],
  ];

  const GENERIC_ANSWER =
    `I'm ${CV.name}, ${CV.currentRole}. ` + (CV.highlights[0] || '') + '.';

  // ======================= HELPERS =======================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const humanDelay = () => sleep(CONFIG.MIN_DELAY_MS + Math.random() * (CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS));
  // Instantly materialising a full sentence is the most obviously non-human thing
  // the script does. Insert it in 1-3 char bursts with jittered gaps instead.
  const typeLikeHuman = async (doc, text) => {
    for (let i = 0; i < text.length;) {
      const n = 1 + Math.floor(Math.random() * 3);
      doc.execCommand('insertText', false, text.slice(i, i + n));
      i += n;
      await sleep(45 + Math.random() * 95);
    }
  };
  const log = (...a) => console.log('%c[auto-apply]', 'color:#4a90d9;font-weight:bold', ...a);

  function visible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute && (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null)) return false;
    if (el.classList && (el.classList.contains('disabled') || el.classList.contains('btn-disabled'))) return false;
    return el.offsetParent !== null;
  }

  function findButtonByText(root, regex) {
    return [...root.querySelectorAll('button, a, [role="button"], [type="submit"], div[class*="btn" i], span[class*="btn" i], [class*="save" i], [class*="action" i], [class*="submit" i]')]
      .find((b) => visible(b) && regex.test(b.textContent.trim()) && b.textContent.trim().length < 40);
  }

  function triggerClick(el, doc) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (e) {}
    const view = (doc && doc.defaultView) || (el.ownerDocument && el.ownerDocument.defaultView) || window;
    const opts = { bubbles: true, cancelable: true, view };
    try { el.dispatchEvent(new PointerEvent('pointerdown', opts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
    try { el.focus?.(); } catch (e) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', opts)); } catch (e) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
    try { el.click(); } catch (e) {}
    const parentBtn = el.closest('button, [role="button"], a');
    if (parentBtn && parentBtn !== el) {
      try { parentBtn.click(); } catch (e) {}
    }
  }

  async function waitFor(fn, timeoutMs = 10000, pollMs = 300) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      let res = null;
      try { res = fn(); } catch (e) { /* popup mid-navigation */ }
      if (res) return res;
      await sleep(pollMs);
    }
    return null;
  }

  async function answerQuestion(questionText) {
    for (const [pattern, answer] of QA_BANK) {
      if (pattern.test(questionText)) return answer;
    }
    if (CONFIG.geminiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text:
                `You are answering a job application chatbot question on my behalf. Answer in first person, 1-3 sentences, professional, no markdown. If the question expects a number, answer with just the number.\n\nMy CV:\n${JSON.stringify(CV)}\n\nQuestion: ${questionText}` }] }],
            }),
          }
        );
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (e) {
        log('Gemini call failed, using generic answer:', e.message);
      }
    }
    return GENERIC_ANSWER;
  }

  // ======================= SELECTORS (edit here if Naukri changes) =======================
  const SELECTORS = {
    // job cards on the search results page
    jobCards: '.srp-jobtuple-wrapper, article.jobTuple',
    jobTitleLink: 'a.title',
    // job detail page (inside the popup)
    applyButtonText: /^apply$/i,
    externalApplyText: /company site/i,
    alreadyAppliedText: /^applied/i,
    // "you have already applied" deliberately NOT here — it's a duplicate-apply
    // rejection, not a new application; counting it inflated state.applied.
    appliedToast: /successfully applied|applied successfully|application sent|application submitted/i,
    alreadyAppliedToast: /you have already applied/i,
    // chatbot questionnaire drawer (appears after Apply on some jobs)
    chatbot: '[class*="chatbot" i], [class*="_drawer" i][class*="chat" i]',
    botMessage: '[class*="botMsg" i], [class*="bot-msg" i], [class*="message" i] span',
    chatInput: 'div[contenteditable="true"], [class*="chatbot" i] textarea, textarea, [class*="chatbot" i] input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), input[type="number"], input[type="text"]',
    cardSalary: '.sal-wrap, [class*="sal" i], .ni-job-tuple-icon-salary, span[class*="salary" i]',
    chatSendText: /^send$|^save$|^submit$|^ok$|^done$|^next$|^continue$|^proceed$|^save & next$|^confirm$/i,
    chatOption: '[class*="chatbot" i] label, [class*="chip" i], [class*="radio" i] label, [class*="checkbox" i] label, [class*="chatbot" i] [role="radio"], [class*="option" i]',
    nextPageText: /^next$/i,
  };

  // ======================= CROSS-PASTE STATE =======================
  const STORE_KEY = 'autoApplyNaukri';
  let state;
  try { state = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { state = {}; }
  // Dry and live keep SEPARATE seen-lists. seen is recorded before the apply is even
  // attempted, so with one shared list every job a dry run walked was permanently
  // skipped by later live runs — the first live run opened with "16 already seen"
  // and had to page past inventory it had never actually applied to.
  const SEEN_KEY = CONFIG.DRY_RUN ? 'seenDry' : 'seen';
  if (!Array.isArray(state[SEEN_KEY])) state[SEEN_KEY] = [];
  if (typeof state.applied !== 'number') state.applied = 0;
  const saveState = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));

  const titleOk = (t) => {
    const lower = t.toLowerCase();
    return CONFIG.TITLE_KEYWORDS.some((k) => lower.includes(k)) &&
           !CONFIG.TITLE_BLOCKLIST.some((k) => lower.includes(k));
  };

  const parseSalaryLPA = (text) => {
    if (!text) return null;
    if (/not disclosed/i.test(text)) return { disclosed: false, text: 'Not disclosed' };
    const crMatch = text.match(/([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*Cr/i) || text.match(/([\d.]+)\s*Cr/i);
    if (crMatch) {
      const min = parseFloat(crMatch[1]) * 100;
      const max = crMatch[2] ? parseFloat(crMatch[2]) * 100 : min;
      return { disclosed: true, min, max, text: text.trim() };
    }
    const lpaMatch = text.match(/([\d.]+)\s*(?:-|to)\s*([\d.]+)\s*(?:lacs|lakhs|lpa)/i) ||
                     text.match(/([\d.]+)\s*(?:lacs|lakhs|lpa)/i);
    if (lpaMatch) {
      const min = parseFloat(lpaMatch[1]);
      const max = lpaMatch[2] ? parseFloat(lpaMatch[2]) : min;
      return { disclosed: true, min, max, text: text.trim() };
    }
    return null;
  };

  const getCardSalary = (card) => {
    const el = card.querySelector(SELECTORS.cardSalary);
    const text = (el ? el.textContent : '') || card.innerText || '';
    const sal = parseSalaryLPA(text);
    return sal || (text.toLowerCase().includes('not disclosed') ? { disclosed: false, text: 'Not disclosed' } : null);
  };

  const checkJobMatchCriteria = (doc) => {
    if (!doc || !doc.body) return { ok: true, reason: 'no document available' };

    const containers = [
      ...doc.querySelectorAll(
        '[class*="matching" i], [class*="criteria" i], [class*="match-score" i], [class*="jpt-match" i], [data-testid*="match" i]'
      )
    ].filter(visible);

    const fullText = (containers.map((c) => c.innerText).join(' ') || doc.body.innerText).replace(/\s+/g, ' ');

    // 1. Ratio check: e.g. "4 of 5 matched" or "3/4 criteria"
    const ratioMatch = fullText.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:criteria|skills|matched|fulfilled)/i);
    if (ratioMatch) {
      const matched = parseInt(ratioMatch[1], 10);
      const total = parseInt(ratioMatch[2], 10);
      if (total > 0 && matched < total) {
        return { ok: false, reason: `only ${matched} of ${total} criteria matched` };
      }
    }

    // 2. Explicit unmet badges or elements
    const unmetBadges = [...doc.querySelectorAll(
      '[class*="not-matched" i], [class*="unmatched" i], [class*="mismatch" i], [class*="cross" i], [class*="notMatched" i]'
    )].filter(visible).map((el) => el.textContent.trim()).filter(Boolean);

    if (unmetBadges.length > 0) {
      return { ok: false, reason: `unmet criteria: ${unmetBadges.slice(0, 3).join(', ')}` };
    }

    // 3. Negative text within criteria section
    const criteriaSection = containers.find((c) => /criteria|keyskills|match/i.test(c.innerText));
    if (criteriaSection) {
      const sectionText = criteriaSection.innerText;
      if (/\b(?:not matched|does not match|doesn't match|unmatched|missing skill)\b/i.test(sectionText)) {
        const notMatchedItems = (sectionText.match(/.{0,25}(?:not matched|doesn't match|unmatched).{0,25}/gi) || [])
          .map((s) => s.trim()).slice(0, 2);
        return { ok: false, reason: `unfulfilled criteria: ${notMatchedItems.join('; ')}` };
      }
      return { ok: true, reason: 'all displayed criteria fulfilled' };
    }

    return { ok: true, reason: 'no unmet criteria detected' };
  };

  // ======================= CHATBOT QUESTIONNAIRE (inside popup) =======================
  async function handleChatbot(doc) {
    const YES = /yes|willing|open to|agree|relocat|remote|immediat|i am able|i can|bengaluru|bangalore/i;
    let lastQuestion = '';
    let repeatCount = 0;

    for (let turn = 0; turn < 15; turn++) {
      await sleep(2000);
      const drawer = doc.querySelector(SELECTORS.chatbot);
      if (!drawer || !visible(drawer)) return true;    // chatbot gone → done

      // Latest bot question = last non-empty bot message in the drawer
      const msgs = [...drawer.querySelectorAll(SELECTORS.botMessage)]
        .map((m) => m.textContent.trim()).filter(Boolean);
      const question = msgs[msgs.length - 1] || drawer.textContent.trim().slice(0, 200);
      log(`  🤖 Q: "${question.slice(0, 80)}"`);

      // If the bot says thank you or confirms submission, the questionnaire is complete!
      const isComplete = /thank you|response.*recorded|application.*submitted|successfully applied|all set|congratulations/i.test(question);
      if (isComplete) {
        log(`  🎉 Chatbot questionnaire completed: "${question.slice(0, 60)}"`);
        const closeBtn = findButtonByText(drawer, /close|done|finish|got it|apply/i) ||
          drawer.querySelector('[class*="close" i], button[aria-label*="close" i]');
        if (closeBtn && visible(closeBtn)) closeBtn.click();
        await sleep(1500);
        return true;
      }

      if (question === lastQuestion) {
        repeatCount++;
        const errorMsg = drawer.querySelector('.err, .error, [class*="error" i], [class*="validation" i], .errMsg')?.textContent?.trim();
        if (errorMsg) log(`  ⚠ validation error visible: "${errorMsg.slice(0, 60)}"`);

        if (repeatCount >= 3) {
          log('  ⚠ Question did not advance. Looking for submit/continue button...');
          const fallbackBtn = findButtonByText(drawer, /save|submit|next|continue|done|apply/i) ||
            drawer.querySelector('button[type="submit"], [class*="primary" i] button, button[class*="primary" i]');
          if (fallbackBtn && visible(fallbackBtn) && !fallbackBtn.disabled) {
            fallbackBtn.click();
            await sleep(2000);
          }
          if (!visible(drawer)) return true;
        }
      } else {
        repeatCount = 0;
        lastQuestion = question;
      }

      let didAct = false;

      // 1. Option chips / radios / checkboxes (pick YES or first relevant option)
      const allOptions = [...drawer.querySelectorAll(SELECTORS.chatOption)].filter(visible)
        .filter((o) => o.textContent.trim().length > 0 && o.textContent.trim().length < 60);
      const options = allOptions.slice(-6);

      if (options.length) {
        const pick = options.find((o) => YES.test(o.textContent)) || options[0];
        triggerClick(pick, doc);
        const inner = pick.querySelector('input') || (pick.tagName === 'INPUT' ? pick : null);
        if (inner && inner !== pick) {
          inner.checked = true;
          inner.dispatchEvent(new Event('input', { bubbles: true }));
          inner.dispatchEvent(new Event('change', { bubbles: true }));
        }
        pick.dispatchEvent(new Event('change', { bubbles: true }));
        log(`  ☑ picked option: "${pick.textContent.trim().slice(0, 50)}"`);
        didAct = true;
        await sleep(500); // let dependent sub-fields render if any
      }

      // 2. Dropdown / <select> elements (e.g. experience dropdowns)
      const selects = [...drawer.querySelectorAll('select, [class*="select" i]')].filter(visible);
      for (const sel of selects) {
        if (sel.tagName === 'SELECT' && sel.options.length > 1) {
          const targetExp = String(CV.yearsInt || Math.round(Number(CV.yearsNumber)) || '4');
          let chosenIdx = -1;
          for (let oi = 1; oi < sel.options.length; oi++) {
            const optText = sel.options[oi].text;
            if (new RegExp(`\\b${targetExp}\\b`, 'i').test(optText) || YES.test(optText)) {
              chosenIdx = oi;
              break;
            }
          }
          if (chosenIdx === -1) {
            chosenIdx = Math.min(sel.options.length - 1, 2);
          }
          sel.selectedIndex = chosenIdx;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          log(`  🔽 selected dropdown: "${sel.options[chosenIdx].text}"`);
          didAct = true;
        }
      }

      // 3. Text / Number inputs (e.g. experience in years, notice period, or free text)
      const inputs = [...drawer.querySelectorAll(SELECTORS.chatInput)].filter(visible);
      for (const input of inputs) {
        const isNum = input.type === 'number' || /experience|years|ctc|salary|notice|age|months/i.test(question);
        let answer = '';
        if (isNum) {
          if (/experience|years/i.test(question)) answer = String(CV.yearsInt || Math.round(Number(CV.yearsNumber)) || '4');
          else if (/notice/i.test(question)) answer = String(parseInt(CV.noticePeriod, 10) || '30');
          else if (/ctc|salary/i.test(question)) answer = String(parseInt(CV.expectedCTC, 10) || '0');
          else answer = String(CV.yearsInt || '4');
        } else {
          answer = await answerQuestion(question);
        }

        input.focus();
        if (input.isContentEditable) {
          doc.getSelection().selectAllChildren(input);
          await typeLikeHuman(doc, String(answer));
        } else {
          try { input.select(); } catch (e) {}
          const proto = input.tagName === 'TEXTAREA' ? doc.defaultView.HTMLTextAreaElement.prototype
                                                     : doc.defaultView.HTMLInputElement.prototype;
          try {
            if (input._valueTracker) input._valueTracker.setValue('');
          } catch (e) {}
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(answer));
          try {
            if (input._valueTracker) input._valueTracker.setValue(String(answer));
          } catch (e) {}

          const evtOpts = { bubbles: true, cancelable: true };
          input.dispatchEvent(new Event('input', evtOpts));
          try {
            input.dispatchEvent(new InputEvent('input', { ...evtOpts, inputType: 'insertText', data: String(answer) }));
          } catch (e) {}
          input.dispatchEvent(new Event('change', evtOpts));
          input.dispatchEvent(new KeyboardEvent('keydown', { ...evtOpts, key: String(answer).slice(-1), keyCode: 13, which: 13 }));
          input.dispatchEvent(new KeyboardEvent('keyup', { ...evtOpts, key: String(answer).slice(-1), keyCode: 13, which: 13 }));
          input.blur();
          input.dispatchEvent(new Event('blur', evtOpts));
        }
        log(`  ✍ A: "${String(answer).slice(0, 60)}"`);
        didAct = true;
      }

      if (!didAct) {
        log('  ⚠ no option or input field found to fill — looking for submit/continue.');
      }

      await sleep(600);
      const sendButtonRegexes = [
        SELECTORS.chatSendText,
        /^save$/i,
        /^next$/i,
        /^continue$/i,
        /^proceed$/i,
        /^save & next$/i,
        /^confirm$/i,
        /^submit$/i,
        /^send$/i,
      ];
      let send = null;
      for (const re of sendButtonRegexes) {
        send = findButtonByText(drawer, re);
        if (send) break;
      }
      if (!send) {
        send = drawer.querySelector('button[type="submit"], [class*="send" i], [class*="next" i], [class*="submit" i], button[class*="primary" i], [class*="btn-primary" i], [class*="save" i]');
      }
      if (send && visible(send) && !send.disabled) {
        triggerClick(send, doc);
        log(`  🔘 clicked: "${(send.textContent || 'Submit').trim().slice(0, 30)}"`);
      }
      // ALSO dispatch Enter key on any visible input, because many chat inputs submit on Enter
      const lastInput = [...drawer.querySelectorAll(SELECTORS.chatInput)].filter(visible).pop();
      if (lastInput) {
        lastInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, code: 'Enter', bubbles: true }));
        lastInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, which: 13, code: 'Enter', bubbles: true }));
        lastInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, code: 'Enter', bubbles: true }));
      }

      // Wait up to 5 seconds for the bot to advance or drawer to close, instead of rushing to re-read the same question
      for (let w = 0; w < 5; w++) {
        await sleep(1000);
        const curDrawer = doc.querySelector(SELECTORS.chatbot);
        if (!curDrawer || !visible(curDrawer)) break;
        const curMsgs = [...curDrawer.querySelectorAll(SELECTORS.botMessage)]
          .map((m) => m.textContent.trim()).filter(Boolean);
        const curQ = curMsgs[curMsgs.length - 1] || '';
        if (curQ && curQ !== question) break;
      }
    }
    log('  ⚠ chatbot: too many turns — finish it manually.');
    return false;
  }

  // ======================= APPLY TO ONE JOB (in popup) =======================
  async function applyInPopup(popup, job) {
    popup.location.href = job.href;
    const applyBtn = await waitFor(() => {
      const doc = popup.document;
      if (!doc || doc.readyState !== 'complete') return null;
      if (findButtonByText(doc, SELECTORS.externalApplyText)) return 'external';
      const btn = findButtonByText(doc, SELECTORS.applyButtonText) ||
                  doc.querySelector('#apply-button, button[id*="apply" i]');
      if (btn && SELECTORS.alreadyAppliedText.test(btn.textContent.trim())) return 'applied';
      return btn;
    }, 15000);

    if (!applyBtn) { log('  ⚠ no Apply button found — skipping.'); return false; }
    if (applyBtn === 'applied') { log('  already applied — skipping.'); return false; }

    // 1. Verify salary requirement (minimum 18 LPA, no undisclosed)
    const popupDoc = popup.document;
    const pageSalText = popupDoc?.querySelector('[class*="salary" i], [class*="sal-wrap" i], [class*="styles_jpt-salary" i]')?.textContent || '';
    const sal = parseSalaryLPA(pageSalText) || job.salary;
    if (!sal || !sal.disclosed || sal.max < CONFIG.MIN_SALARY_LPA) {
      log(`  ⏭ skipping: package "${(sal && sal.text) || pageSalText || 'Not disclosed'}" does not meet minimum ${CONFIG.MIN_SALARY_LPA} LPA.`);
      return false;
    }

    // 2. Verify all Job Match Score criteria are fulfilled
    if (CONFIG.REQUIRE_ALL_CRITERIA_MATCHED) {
      const matchStatus = checkJobMatchCriteria(popupDoc);
      if (!matchStatus.ok) {
        log(`  ⏭ skipping: job match criteria not fully fulfilled (${matchStatus.reason}).`);
        return false;
      }
      log(`  🎯 match score check passed: ${matchStatus.reason}`);
    }

    // In-page JS can't follow the handoff to the employer's domain (cross-origin),
    // so hand the job to the Node runner, which applies on the company site itself.
    if (applyBtn === 'external') {
      const compStr = job.company ? ` @ ${job.company}` : '';
      log(`  🔗 EXTERNAL | ${job.title}${compStr} | ${job.href}`);
      return 'external';
    }

    if (CONFIG.DRY_RUN) {
      log(`  🔍 DRY_RUN — would click: "${applyBtn.textContent.trim()}". Set DRY_RUN=false to apply for real.`);
      return true;
    }

    triggerClick(applyBtn, popup.document);

    // popup.document MUST be re-read on every check. Clicking Apply can navigate the
    // popup, and a navigation replaces the Document object — the old code captured it
    // once, so from then on every check ran against a detached document: textContent
    // never carried the toast and applyBtn.isConnected was false. A genuinely
    // successful apply therefore reported "could not confirm success", and the
    // calibration dump printed an empty button list (the tell-tale of a dead
    // document). Dry runs return before the click, so only live runs ever hit it.
    const doc = () => popup.document;

    // Only the button we actually clicked counts as a state change. Scanning every
    // button for /^applied/i matched unrelated chrome ("Applied filters", an
    // already-applied entry in a similar-jobs rail) and confirmed a success that
    // never happened. If Naukri swaps the node out instead of relabelling it,
    // isConnected goes false and we fall back to the toast text.
    const confirmed = () => {
      const d = doc();
      if (!d || !d.body) return false;
      const url = d.location ? d.location.href : '';
      return /saveApply|myapply/i.test(url) ||
        SELECTORS.appliedToast.test(d.body.textContent) ||
        (applyBtn.isConnected && SELECTORS.alreadyAppliedText.test(applyBtn.textContent.trim()));
    };

    // Race the questionnaire drawer against the applied confirmation, whichever
    // lands first. A fixed sleep raced the drawer's render and silently skipped
    // the questions; polling the drawer alone stalled the full timeout on every
    // direct apply, which is the common case.
    const outcome = await waitFor(() => {
      const d = doc();
      if (!d || !d.body) return null;
      if (SELECTORS.alreadyAppliedToast.test(d.body.textContent)) return 'duplicate';
      const drawer = d.querySelector(SELECTORS.chatbot);
      if (drawer && visible(drawer)) return 'chatbot';
      return confirmed() ? 'applied' : null;
    }, 10000);
    if (outcome === 'duplicate') { log('  ↩ already applied to this job — not counting it.'); return false; }
    if (outcome === 'chatbot') {
      const ok = await handleChatbot(doc());
      if (!ok) return false;
    }

    // Confirm success (toast or Apply button turned into "Applied")
    const success = outcome === 'applied' || await waitFor(confirmed, 10000);
    if (success) {
      log('  ✅ applied');
    } else {
      // The confirmation wording is the one thing we could not verify without a real
      // apply. Dump what the page actually said so the regex can be calibrated
      // instead of guessing again.
      const d = doc();
      // An external job can render a generic "Apply" before its real
      // "Apply on company site" control exists, so the pre-click external check
      // sometimes passes too early and we click the wrong button. Re-check now:
      // if the page is in fact external, hand it to the runner's external queue
      // (which applies on the employer's own site) instead of burning it as an
      // unexplained failure. Observed live on fafadia-tech, whose calibration dump
      // read: visible buttons ["2","Save","Apply on company site"].
      if (d && findButtonByText(d, SELECTORS.externalApplyText)) {
        log(`  🔗 EXTERNAL | ${job.title} | ${job.href}`);
        return 'external';
      }
      const btns = d && d.body ? [...d.querySelectorAll('button')].filter(visible)
        .map((b) => b.textContent.trim()).filter(Boolean).slice(0, 8) : [];
      log('  ⚠ could not confirm success — check the popup.');
      log(`  🔬 calibration — url: ${d ? d.location.href.slice(0, 120) : '(no document)'}`);
      log(`  🔬 calibration — visible buttons: ${JSON.stringify(btns)}`);
      log(`  🔬 calibration — page text: "${d && d.body ? d.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 300) : ''}"`);
    }
    return !!success;
  }

  // ======================= MAIN LOOP =======================
  log(`Starting. DRY_RUN=${CONFIG.DRY_RUN}, max=${CONFIG.MAX_APPLICATIONS}, applied so far: ${state.applied}`);
  if (!/naukri\./.test(location.hostname)) { log('⚠ Open a naukri.com job search first.'); return; }

  // Naukri renders the results list client-side, so the cards are not in the DOM
  // at injection time. Without this wait the first loop pass saw 0 cards, found no
  // "Next" button either, and exited with "No more pages" a second after starting.
  const waitForCards = async (timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ([...document.querySelectorAll(SELECTORS.jobCards)].filter(visible).length) return true;
      await sleep(500);
    }
    return false;
  };
  if (!(await waitForCards())) {
    log('No job cards rendered after 30s — search page may have changed or been blocked.');
    return;
  }

  const popup = window.open('about:blank', 'naukriApplyPopup', 'width=1250,height=900');
  if (!popup) {
    log('🚫 POPUP BLOCKED. Allow popups for naukri.com (address-bar icon → Always allow), then paste again.');
    return;
  }

  let extQueued = 0;
  while (state.applied < CONFIG.MAX_APPLICATIONS) {
    const cards = [...document.querySelectorAll(SELECTORS.jobCards)].filter(visible);
    let job = null;

    let nSeen = 0, nFiltered = 0;
    for (const card of cards) {
      const link = card.querySelector(SELECTORS.jobTitleLink);
      if (!link) continue;
      const title = link.textContent.replace(/\s+/g, ' ').trim();
      if (state[SEEN_KEY].includes(link.href)) { nSeen++; continue; }
      if (!titleOk(title)) { nFiltered++; continue; }

      // Card-level salary check: strictly require disclosed package >= MIN_SALARY_LPA
      const sal = getCardSalary(card);
      if (!sal || !sal.disclosed || sal.max < CONFIG.MIN_SALARY_LPA) {
        nFiltered++;
        continue;
      }

      const company = card.querySelector('a.comp-name, .comp-name, a[class*="comp-name" i], [class*="company" i]')?.textContent?.trim() || '';
      const skills = [...card.querySelectorAll('.tags-gt li, [class*="tag" i], [class*="chip" i]')].map((e) => e.textContent.trim()).filter(Boolean).join('; ');

      job = { href: link.href, title, card, salary: sal, company, skills };
      break;
    }

    if (!job) {
      const sample = cards.slice(0, 3).map((c) =>
        `"${(c.querySelector(SELECTORS.jobTitleLink)?.textContent || '?').trim().slice(0, 40)}"`).join(', ');
      // Split the two very different reasons for "nothing to do here": jobs already
      // visited on an earlier run vs jobs the title filter rejected. Reporting a
      // combined "0 match" made an exhausted page look like a broken filter.
      log(`(this page: ${cards.length} cards — ${nSeen} already seen, ${nFiltered} filtered out; sample: ${sample})`);
      const nextBtn = findButtonByText(document, SELECTORS.nextPageText);
      if (nextBtn) {
        log('🌐 Next results page — the page will reload. PASTE THE SCRIPT AGAIN when it loads.');
        popup.close();
        nextBtn.click();
        return;
      }
      log('No more pages. Change your search and paste again.');
      break;
    }

    state[SEEN_KEY].push(job.href);
    saveState();
    const compStr = job.company ? ` @ ${job.company}` : '';
    const salStr = (job.salary && job.salary.text) ? ` | ${job.salary.text}` : ' | ≥ 18 LPA';
    const skillsStr = job.skills ? ` | ${job.skills}` : '';
    log(`▶ Applying: ${job.title}${compStr} | ${job.href}${salStr}${skillsStr}`);
    job.card.scrollIntoView({ block: 'center' });

    const ok = await applyInPopup(popup, job);
    // Strictly true: 'external' is truthy and must not be counted as an application.
    if (ok === true && !CONFIG.DRY_RUN) {
      state.applied++;
      saveState();
      log(`  progress: ${state.applied}/${CONFIG.MAX_APPLICATIONS}`);
    }
    if (ok === 'external') {
      extQueued++;
      // The runner applies on the employer's own site, but it can only do that while
      // this script is idle: its queue drains under !anyBusy, and applyExternal waits
      // for the next context 'page' event, which would otherwise capture the job popup
      // this script drives. Most naukri developer listings are external, so a loop that
      // runs to MAX_APPLICATIONS keeps the script busy and the queue never drains at
      // all. Hand control back after a small batch instead.
      if (extQueued >= CONFIG.EXTERNAL_BATCH) {
        log(`↩ queued ${extQueued} external jobs — yielding so the runner can apply to them.`);
        break;
      }
    }
    await humanDelay();
  }

  popup.close();
  log(CONFIG.DRY_RUN
    ? 'DRY RUN finished — nothing was actually sent. Set CONFIG.DRY_RUN = false and re-paste to apply for real.'
    : `Finished. Applied to ${state.applied} jobs total. Clear localStorage["${STORE_KEY}"] to reset the counter.`);
})();
