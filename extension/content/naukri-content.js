/**
 * JobMatch AI — Content Script (Injected into Naukri.com)
 * Executes live job discovery, salary filtering (>= 18 LPA),
 * 100% match score verification, robust React input clearing, and chatbot handling.
 */

(() => {
  if (window.__jobMatchAiLoaded) {
    console.log('[JobMatch AI] Content script already loaded.');
    return;
  }
  window.__jobMatchAiLoaded = true;

  let isRunning = false;
  let abortRequested = false;

  // Dynamic Candidate Profile (Initialized to Jeet's verified profile, customizable from Side Panel)
  let CV = {
    name: 'Jeet Bahadur',
    email: 'jeetb.yadav11@gmail.com',
    phone: '+91 9478632012',
    location: 'Bengaluru, India',
    currentRole: 'Software Engineer',
    company: 'MSG Global Solutions',
    education: 'B.Tech in Chemical Engineering, NIT Jalandhar (2018-2022)',
    yearsOfExperience: '4.3 years professional experience',
    yearsNumber: '4.3',
    yearsInt: '4',
    noticePeriod: '30 days',
    currentCTC: '0',
    expectedCTC: '18-25',
    minSalaryLPA: 18,
    workAuth: 'Authorized to work in my country of residence.',
    github: 'https://github.com/JeetYad07',
    linkedin: 'https://www.linkedin.com/in/jeet-y-41a073175/',
    remoteOk: 'Yes, I am fully set up for remote work and also open to hybrid/onsite.',
    relocate: 'Yes, I am open to relocation. I am currently based in Bengaluru.',
  };

  let QA_BANK = [];

  function buildQABank() {
    QA_BANK = [
      [/company name|current (company|employer)|organi[sz]ation/i, CV.company],
      [/notice period|when can you (start|join)|start date|joining|how soon/i, (CV.noticePeriod || '30').replace(/\D/g, '') || '30'],
      [/current .{0,15}(ctc|salary|compensation|annual)/i, String(CV.currentCTC || '0')],
      [/(expected|desired) .{0,15}(ctc|salary|compensation|pay)|salary expectation/i, String(CV.expectedCTC || '18').split('-')[0] || '18'],
      [/years? of (work |professional |total |relevant )?experience|how (long|many years)|total experience|relevant experience/i, String(CV.yearsInt || '4')],
      [/(react|node|javascript|frontend|backend) experience/i, String(CV.yearsInt || '4')],
      [/laptop|desktop|computer|pc|system|wifi|internet|broadband/i, 'Yes'],
      [/shift|rotational|night shift|day shift/i, 'Yes'],
      [/serving notice|currently serving/i, 'No'],
      [/immediate joiner|can join immediately/i, 'Yes'],
      [/highest qualification|highest education|degree/i, (CV.education && CV.education.includes('B.Tech')) ? 'B.Tech' : 'Graduate'],
      [/remote|work from home|wfh/i, 'Yes'],
      [/reloc|move to|shift to|based out of|work from (our )?office|commute|on-?site/i, 'Yes'],
      [/e-?mail/i, CV.email],
      [/where are you .{0,15}(based|located)|current location|city|address/i, CV.location.split(',')[0].trim() || 'Bengaluru'],
      [/visa|sponsorship|work authorization|legally authorized|right to work|citizen/i, 'Yes'],
      [/\blinkedin\b/i, CV.linkedin],
      [/\bgithub\b/i, CV.github],
      [/phone|contact number|mobile/i, CV.phone],
      [/^name$|your name|full name|candidate name|first name/i, CV.name],
    ];
  }
  buildQABank();

  function updateCandidateProfile(profile) {
    if (!profile) return;
    if (profile.name) CV.name = profile.name;
    if (profile.email) CV.email = profile.email;
    if (profile.phone) CV.phone = profile.phone;
    if (profile.location) CV.location = profile.location;
    if (profile.currentRole) CV.currentRole = profile.currentRole;
    if (profile.company) CV.company = profile.company;
    if (profile.education) CV.education = profile.education;
    if (profile.yearsNumber) {
      CV.yearsNumber = String(profile.yearsNumber);
      CV.yearsInt = String(Math.floor(parseFloat(profile.yearsNumber) || 4));
      CV.yearsOfExperience = `${CV.yearsNumber} years professional experience`;
    }
    if (profile.noticePeriod) CV.noticePeriod = profile.noticePeriod;
    if (profile.currentCTC !== undefined) CV.currentCTC = String(profile.currentCTC);
    if (profile.expectedCTC !== undefined) CV.expectedCTC = String(profile.expectedCTC);
    if (profile.github) CV.github = profile.github;
    if (profile.linkedin) CV.linkedin = profile.linkedin;
    buildQABank();
  }

  const SELECTORS = {
    jobCards: '.srp-jobtuple-wrapper, article.jobTuple, [data-job-id], .cust-job-tuple, .jobTuple, [class*="jobtuple" i], [class*="srp-tuple" i], [class*="tuple-wrapper" i], div.styles_job-tuple-container__srp',
    jobTitleLink: 'a.title, [class*="title" i] a, a[class*="title" i], [data-job-id] a[href*="job-listings"], a[href*="/job-listings-"]',
    applyButtonText: /^apply$/i,
    externalApplyText: /company site/i,
    alreadyAppliedText: /^applied/i,
    chatbot: '[class*="chatbot" i], [class*="_drawer" i][class*="chat" i]',
    botMessage: '[class*="botMsg" i], [class*="bot-msg" i], [class*="message" i] span',
    chatInput: 'div[contenteditable="true"], [class*="chatbot" i] textarea, textarea, [class*="chatbot" i] input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]), input[type="number"], input[type="text"]',
    cardSalary: '.sal-wrap, [class*="sal-wrap" i], [class*="salary" i], span[class*="salary" i], .ni-job-tuple-icon-salary, [data-testid*="salary" i], li[class*="salary" i], span[title*="Lacs" i], span[title*="PA" i]',
    cardCompany: 'a.comp-name, .comp-name, [class*="company" i], [class*="comp-name" i], [class*="compName" i]',
    chatSendText: /^send$|^save$|^submit$|^ok$|^done$|^next$|^continue$|^proceed$|^save & next$|^confirm$/i,
    chatOption: '[class*="chatbot" i] label, [class*="chip" i], [class*="radio" i] label, [class*="checkbox" i] label, [class*="chatbot" i] [role="radio"], [class*="option" i]',
    nextPageText: /^next$/i,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Anti-bot detection: randomized human delay between applications
  function getHumanDelay(pacingSpeed = 'stealth') {
    let min = 8000;
    let max = 18000;
    if (pacingSpeed === 'balanced') {
      min = 5000;
      max = 10000;
    } else if (pacingSpeed === 'fast') {
      min = 3000;
      max = 6000;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function log(text, type = 'info') {
    const time = new Date().toLocaleTimeString();
    console.log(`[JobMatch AI] ${text}`);
    chrome.runtime.sendMessage({
      type: 'APPEND_LOG',
      log: { time, text, type }
    }).catch(() => {});
  }

  function visible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute && (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('disabled') !== null)) return false;
    if (el.classList && (el.classList.contains('disabled') || el.classList.contains('btn-disabled'))) return false;
    return el.offsetParent !== null;
  }

  // Robust card retrieval with fallback to listing link wrappers
  function getJobCards() {
    const cards = [...document.querySelectorAll(SELECTORS.jobCards)].filter(visible);
    if (cards.length > 0) return cards;

    // Fallback: If containers didn't match, find links that point to job-listings
    const links = [...document.querySelectorAll('a[href*="/job-listings-"]')].filter(visible);
    const cardSet = new Set();
    for (const link of links) {
      const parent = link.closest('[class*="tuple" i], article, [data-job-id], div[class*="wrapper" i], li');
      if (parent && visible(parent)) {
        cardSet.add(parent);
      }
    }
    return [...cardSet];
  }

  // Poll for dynamically rendered cards on search page
  async function waitForCards(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !abortRequested) {
      const cards = getJobCards();
      if (cards.length > 0) return cards;
      await sleep(500);
    }
    return [];
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

  function parseSalaryLPA(text) {
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
  }

  function checkJobMatchCriteria(doc) {
    if (!doc || !doc.body) return { ok: true, reason: 'no document' };

    const containers = [
      ...doc.querySelectorAll(
        '[class*="matching" i], [class*="criteria" i], [class*="match-score" i], [class*="jpt-match" i], [data-testid*="match" i]'
      )
    ].filter(visible);

    const fullText = (containers.map((c) => c.innerText).join(' ') || doc.body.innerText).replace(/\s+/g, ' ');

    const ratioMatch = fullText.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:criteria|skills|matched|fulfilled)/i);
    if (ratioMatch) {
      const matched = parseInt(ratioMatch[1], 10);
      const total = parseInt(ratioMatch[2], 10);
      if (total > 0 && matched < total) {
        return { ok: false, reason: `Only ${matched} of ${total} criteria matched` };
      }
    }

    const unmetBadges = [...doc.querySelectorAll(
      '[class*="not-matched" i], [class*="unmatched" i], [class*="mismatch" i], [class*="cross" i], [class*="notMatched" i]'
    )].filter(visible).map((el) => el.textContent.trim()).filter(Boolean);

    if (unmetBadges.length > 0) {
      return { ok: false, reason: `Unmet criteria: ${unmetBadges.slice(0, 2).join(', ')}` };
    }

    return { ok: true, reason: 'All criteria 100% fulfilled' };
  }

  function answerQuestion(questionText) {
    for (const [pattern, answer] of QA_BANK) {
      if (pattern.test(questionText)) return answer;
    }
    return CV.yearsInt || '4';
  }

  /**
   * Properly clears existing input field text and sets new value using React prototype setter
   */
  async function fillInput(doc, input, answer) {
    if (!input) return;
    input.focus();

    if (input.isContentEditable) {
      try {
        doc.getSelection().selectAllChildren(input);
        doc.execCommand('delete', false, null);
        await sleep(35 + Math.floor(Math.random() * 45));
        doc.execCommand('insertText', false, String(answer));
      } catch (e) {
        input.innerText = String(answer);
      }
      return;
    }

    const proto = input.tagName === 'TEXTAREA'
      ? (doc.defaultView?.HTMLTextAreaElement?.prototype || HTMLTextAreaElement.prototype)
      : (doc.defaultView?.HTMLInputElement?.prototype || HTMLInputElement.prototype);

    // 1. Clear field completely first
    try { input.select?.(); } catch (e) {}
    try {
      if (input._valueTracker) input._valueTracker.setValue('');
    } catch (e) {}
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, '');
    input.value = '';

    // Human typing micro-jitter between clear and type (40-90ms)
    await sleep(40 + Math.floor(Math.random() * 50));

    // 2. Set new value via React native setter
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(answer));
    try {
      if (input._valueTracker) input._valueTracker.setValue(String(answer));
    } catch (e) {}

    // 3. Dispatch full event suite so React components update internal state
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

  // Answer questionnaire in chatbot
  async function handleChatbot(doc) {
    const YES = /yes|willing|open to|agree|relocat|remote|immediat|bengaluru|bangalore/i;
    let repeatCount = 0;
    let lastQ = '';

    for (let turn = 0; turn < 12; turn++) {
      await sleep(1500);
      const drawer = doc.querySelector(SELECTORS.chatbot);
      if (!drawer || !visible(drawer)) return true;

      const msgs = [...drawer.querySelectorAll(SELECTORS.botMessage)]
        .map((m) => m.textContent.trim()).filter(Boolean);
      const question = msgs[msgs.length - 1] || drawer.textContent.trim().slice(0, 150);

      if (/thank you|response.*recorded|application.*submitted|successfully applied|all set/i.test(question)) {
        log('🎉 Chatbot questionnaire completed successfully.', 'info');
        const closeBtn = findButtonByText(drawer, /close|done|finish|got it|apply/i);
        if (closeBtn) closeBtn.click();
        return true;
      }

      log(`  🤖 Q: "${question.slice(0, 60)}"`, 'info');

      // Pick radio option
      const options = [...drawer.querySelectorAll(SELECTORS.chatOption)].filter(visible);
      if (options.length > 0) {
        const yesOpt = options.find((o) => YES.test(o.textContent.trim())) || options[0];
        triggerClick(yesOpt, doc);
        log(`  ☑ Selected: "${yesOpt.textContent.trim().slice(0, 30)}"`, 'info');
      }

      // Handle text or numeric input (clears old value first)
      const input = drawer.querySelector(SELECTORS.chatInput);
      if (input && visible(input)) {
        const answer = answerQuestion(question);
        await fillInput(doc, input, answer);
        log(`  ✍ Cleared & Answered: "${answer}"`, 'info');
      }

      await sleep(600);

      // Click save/continue
      const sendButtons = [
        SELECTORS.chatSendText,
        /^save$/i,
        /^next$/i,
        /^continue$/i,
        /^proceed$/i,
        /^save & next$/i,
        /^confirm$/i,
        /^submit$/i,
      ];
      let sendBtn = null;
      for (const re of sendButtons) {
        sendBtn = findButtonByText(drawer, re);
        if (sendBtn) break;
      }
      if (!sendBtn) {
        sendBtn = drawer.querySelector('button[type="submit"], [class*="send" i], [class*="next" i], [class*="submit" i], button[class*="primary" i], [class*="save" i]');
      }

      if (sendBtn) {
        triggerClick(sendBtn, doc);
        log('  🔘 Clicked: Save / Continue', 'info');
      }
    }
    return false;
  }

  function getJobId(url) {
    if (!url) return '';
    const m = url.match(/-(\d{8,})(?:\?|$)/) || url.match(/\/(\d{8,})/);
    return m ? m[1] : url;
  }

  // Process a single job in a popup with polling for elements
  async function applyInPopup(popup, job, config, seenJobs) {
    popup.location.href = job.href;

    // Wait for popup document to load and show Apply or Applied state
    const deadline = Date.now() + 15000;
    let popupDoc = null;
    let applyBtn = null;
    let isAlreadyApplied = false;

    while (Date.now() < deadline && !abortRequested) {
      await sleep(600);
      try {
        popupDoc = popup.document;
        if (!popupDoc || popupDoc.readyState !== 'complete' || !popupDoc.body) continue;

        // Check if already applied on the listing page
        if (
          findButtonByText(popupDoc, /^applied$/i) ||
          popupDoc.querySelector('[class*="already-applied" i], [class*="applied-status" i]') ||
          /you have already applied/i.test(popupDoc.body.innerText || '')
        ) {
          isAlreadyApplied = true;
          break;
        }

        applyBtn = findButtonByText(popupDoc, SELECTORS.applyButtonText) ||
          popupDoc.querySelector('#apply-button, button[id*="apply" i]');

        if (applyBtn) break;
      } catch (e) {
        // popup mid-navigation
      }
    }

    if (isAlreadyApplied) {
      log(`⏭ Already applied to "${job.title}" — skipping duplicate.`, 'info');
      seenJobs.add(job.href);
      seenJobs.add(job.jobId);
      return false;
    }

    if (!popupDoc) {
      log('⚠ Popup failed to load document — skipping.', 'warn');
      return false;
    }

    const pageSalText = popupDoc.querySelector('[class*="salary" i], [class*="sal-wrap" i], [class*="styles_jpt-salary" i]')?.textContent || '';
    const sal = parseSalaryLPA(pageSalText) || job.salary;
    const minRequired = config.minSalaryLPA || 18;

    if (!sal || !sal.disclosed || sal.max < minRequired) {
      log(`⏭ Skipped: Package "${(sal && sal.text) || pageSalText || 'Not disclosed'}" < ${minRequired} LPA`, 'warn');
      return false;
    }

    if (config.requireAllCriteria) {
      const match = checkJobMatchCriteria(popupDoc);
      if (!match.ok) {
        log(`⏭ Skipped: Match score not 100% (${match.reason})`, 'warn');
        return false;
      }
      log(`🎯 Criteria verified: ${match.reason}`, 'info');
    }

    if (!applyBtn) {
      log('⚠ No direct Apply button on listing — skipping.', 'warn');
      return false;
    }

    triggerClick(applyBtn, popupDoc);
    await sleep(2500);

    // Check if chatbot questionnaire drawer appears (poll up to 4s)
    let hasChatbot = null;
    for (let c = 0; c < 4; c++) {
      try {
        hasChatbot = popup.document.querySelector(SELECTORS.chatbot);
        if (hasChatbot && visible(hasChatbot)) break;
      } catch (e) {}
      await sleep(1000);
    }

    if (hasChatbot) {
      log('🤖 Questionnaire detected — filling verified answers...', 'info');
      await handleChatbot(popup.document);
    }

    return true;
  }

  // Synchronize sidebar facet checkboxes with active filter configuration
  // Synchronize sidebar facet checkboxes with active filter configuration
  async function syncSidebarFilters(config = {}) {
    const filters = config.targetingFilters || config;
    const clicked = [];

    function isLabelChecked(label) {
      if (!label) return false;
      const icon = label.querySelector('i');
      if (icon) {
        if (icon.classList.contains('ni-icon-checked')) return true;
        if (icon.classList.contains('ni-icon-unchecked')) return false;
      }
      const input = label.querySelector('input') || (label.htmlFor && document.getElementById(label.htmlFor));
      return Boolean(input && input.checked);
    }

    async function clickLabel(pattern, name) {
      const labels = [...document.querySelectorAll('label')];
      const match = labels.find(
        (l) => pattern.test(l.getAttribute('for') || '') || pattern.test(l.textContent || '')
      );
      if (match) {
        if (isLabelChecked(match)) {
          return false; // Already checked
        }
        match.click();
        clicked.push(name || match.textContent.trim().slice(0, 30));
        await sleep(350);
        return true;
      }
      return false;
    }

    // 1. Posted By: Company Jobs (Direct Employer)
    if (filters.postedBy === 'direct') {
      await clickLabel(/Company Jobs/i, 'Company Jobs (Direct Employer)');
    }

    // 2. Work Mode & Remote
    const locs = Array.isArray(filters.locations) ? filters.locations.map((l) => l.toLowerCase()) : ['bengaluru'];
    const wantsRemote = locs.includes('remote') || filters.workMode === 'remote_only' || filters.workMode === 'hybrid_remote';

    if (wantsRemote) {
      await clickLabel(/Remote/i, 'Remote Work Mode');
    }

    if (filters.workMode === 'hybrid_remote' || filters.workMode === 'hybrid_only') {
      await clickLabel(/Hybrid/i, 'Hybrid Work Mode');
    } else if (filters.workMode === 'office') {
      await clickLabel(/Work from office/i, 'Work from Office');
    }

    // 3. Physical Locations (Bengaluru, Pune, Hyderabad, Delhi / NCR, etc.)
    const physicalCities = locs.filter((l) => l !== 'remote');
    if (physicalCities.length > 0) {
      // Check if any requested city is not yet in the DOM (e.g. Pune is under View More)
      let needsViewMore = false;
      for (const city of physicalCities) {
        const found = [...document.querySelectorAll('label')].some((l) => {
          const forAttr = l.getAttribute('for') || '';
          return forAttr.includes('cityTypeGid') && new RegExp(city, 'i').test(forAttr || l.textContent || '');
        });
        if (!found) {
          needsViewMore = true;
          break;
        }
      }

      if (needsViewMore) {
        const viewMoreLink = document.getElementById('cityTypeGid') || document.querySelector('a[id*="cityTypeGid"]');
        if (viewMoreLink) {
          viewMoreLink.click();
          await sleep(600);
        }
      }

      let drawerSelectionMade = false;
      for (const city of physicalCities) {
        const cityPattern = city === 'delhi' ? /delhi/i : new RegExp(city, 'i');
        const label = [...document.querySelectorAll('label')].find((l) => {
          const forAttr = l.getAttribute('for') || '';
          return forAttr.includes('cityTypeGid') && cityPattern.test(forAttr || l.textContent || '');
        });

        if (label && !isLabelChecked(label)) {
          label.click();
          clicked.push(`Location: ${city.charAt(0).toUpperCase() + city.slice(1)}`);
          drawerSelectionMade = true;
          await sleep(350);
        }
      }

      // If expanded drawer was opened and selections made, click Apply button
      const applyBtn = document.querySelector('.styles_filter-apply-btn__MDAUd');
      if (applyBtn && (needsViewMore || drawerSelectionMade)) {
        applyBtn.click();
        await sleep(2000);
      }
    }

    // 4. Department: Engineering - Software & QA
    if (filters.department === 'engineering') {
      await clickLabel(/Engineering - Software & QA/i, 'Engineering - Software & QA');
    } else if (filters.department === 'data') {
      await clickLabel(/Data Science/i, 'Data Science');
    } else if (filters.department === 'product') {
      await clickLabel(/Product Management/i, 'Product Management');
    }

    // 5. Salary Packages
    const minSalary = filters.minSalaryLPA || 18;
    if (minSalary >= 18) {
      await clickLabel(/15-25 Lakhs/i, '15-25 Lakhs');
      await clickLabel(/25-50 Lakhs/i, '25-50 Lakhs');
    }

    // 6. Company Type
    if (filters.companyType === 'mnc_startup') {
      await clickLabel(/Foreign MNC/i, 'Foreign MNC');
      await clickLabel(/Corporate/i, 'Corporate');
      await clickLabel(/Startup/i, 'Startup');
    } else if (filters.companyType === 'mnc') {
      await clickLabel(/Foreign MNC/i, 'Foreign MNC');
      await clickLabel(/Corporate/i, 'Corporate');
    } else if (filters.companyType === 'startup') {
      await clickLabel(/Startup/i, 'Startup');
    }

    // 7. Education: B.Tech / B.E.
    if (filters.education === 'btech') {
      await clickLabel(/B\.Tech \/ B\.E\./i, 'B.Tech / B.E.');
    }

    // 8. Freshness Dropdown
    if (filters.freshness && filters.freshness !== 'any') {
      const freshBtn = document.getElementById('filter-freshness');
      if (freshBtn) {
        freshBtn.click();
        await sleep(400);
        const options = [...document.querySelectorAll('ul[data-filter-id="freshness"] li, [class*="menu"] li')];
        const targetDays = filters.freshness;
        const opt = options.find((o) => new RegExp(`${targetDays} days?`, 'i').test(o.textContent));
        if (opt) {
          opt.click();
          clicked.push(`Freshness: Last ${targetDays} days`);
        }
      }
    }

    if (clicked.length > 0) {
      log(`⚡ Auto-applied ${clicked.length} sidebar filters: ${clicked.join(', ')}`, 'success');
      await sleep(2500); // Allow Naukri SPA to re-query and refresh card results
    } else {
      log('ℹ Target sidebar filters are verified and active on page.', 'info');
    }
    return clicked;
  }

  // Main application execution loop
  async function runAutoApply(config) {
    if (isRunning) return;
    isRunning = true;
    abortRequested = false;

    // 0. Synchronize candidate profile from config or local storage
    if (config.candidateProfile) {
      updateCandidateProfile(config.candidateProfile);
    } else {
      try {
        const { candidateProfile: storedProfile } = await chrome.storage.local.get('candidateProfile');
        if (storedProfile) updateCandidateProfile(storedProfile);
      } catch (e) {}
    }

    // 1. Verify we are on a Naukri tab and on a search results page
    const currentUrl = window.location.href;
    const isSearchPage = /(-jobs|\/jobs|\/search|q=)/i.test(currentUrl);

    if (!isSearchPage) {
      log(`Current tab: ${window.location.pathname || '/'}`, 'info');
      const targetUrl = config.searchUrl || 'https://www.naukri.com/full-stack-developer-jobs?experience=4&ctcFilter=15to25&ctcFilter=25to50&ctcFilter=50to75';
      log(`⚠ Tab is not on a job search page. Navigating to targeted search...`, 'warn');
      isRunning = false;
      window.location.href = targetUrl;
      return;
    }

    // 2. Synchronize on-page sidebar filters (Company Jobs, Freshness, Locations, etc.)
    await syncSidebarFilters(config);

    // 3. Load already seen / applied jobs from local storage
    const { seenJobs: storedSeen = [] } = await chrome.storage.local.get('seenJobs');
    const seenJobs = new Set(storedSeen);

    const minSalary = config.minSalaryLPA || 18;
    const maxTarget = config.maxPerRun || 10;

    log(`Starting auto-apply session (Min: ${minSalary} LPA, Target: ${maxTarget} jobs, Seen: ${seenJobs.size})...`, 'info');

    // 4. Wait for client-rendered job cards to appear
    log('⏳ Loading job listings on search page...', 'info');
    let cards = await waitForCards(15000);
    if (!cards || cards.length === 0) {
      log('⚠ No job cards rendered after 15s. If you have active filters, try broadening them.', 'warn');
      isRunning = false;
      return;
    }

    log(`Found ${cards.length} job cards on current search page.`, 'info');

    const popup = window.open('about:blank', 'jobMatchAiPopup', 'width=1200,height=800');
    if (!popup) {
      log('🚫 Popup blocked! Please click the icon in your address bar and choose "Always allow popups from www.naukri.com".', 'warn');
      isRunning = false;
      chrome.runtime.sendMessage({ type: 'STOP_APPLY' }).catch(() => {});
      return;
    }

    let appliedCount = 0;
    const sessionJobs = [];
    let pageNumber = 1;

    try {
      while (appliedCount < maxTarget && !abortRequested) {
        cards = getJobCards();
        if (cards.length === 0) {
          cards = await waitForCards(10000);
        }

        let targetJob = null;
        let skippedSalary = 0;
        let skippedUndisclosed = 0;
        let skippedSeen = 0;
        let totalScanned = 0;

        for (const card of cards) {
          if (abortRequested) break;
          totalScanned++;

          const link = card.querySelector(SELECTORS.jobTitleLink);
          if (!link || !link.href) continue;

          const href = link.href;
          const jobId = getJobId(href);

          // Prevent duplicate applications: skip if already seen/applied
          if (seenJobs.has(href) || seenJobs.has(jobId)) {
            skippedSeen++;
            continue;
          }

          // Card-level check: skip if Naukri card indicates already applied
          const cardText = card.innerText || '';
          if (/\bapplied\b/i.test(cardText) && !/\bapply\b/i.test(cardText)) {
            seenJobs.add(href);
            seenJobs.add(jobId);
            skippedSeen++;
            continue;
          }

          const title = link.textContent.trim() || 'Software Engineer';
          const sal = parseSalaryLPA(card.querySelector(SELECTORS.cardSalary)?.textContent || '');

          if (config.skipUndisclosed && (!sal || !sal.disclosed)) {
            skippedUndisclosed++;
            continue;
          }
          if (sal && sal.disclosed && sal.max < minSalary) {
            skippedSalary++;
            continue;
          }

          const company = card.querySelector(SELECTORS.cardCompany)?.textContent?.trim() || 'Direct Employer';
          targetJob = { href, jobId, title, company, salary: sal, card };
          break;
        }

        if (!targetJob || abortRequested) {
          log(`Page ${pageNumber} summary (${totalScanned} cards): ${skippedSalary} < ${minSalary} LPA, ${skippedUndisclosed} undisclosed, ${skippedSeen} already seen.`, 'info');

          // Check if there is a Next results page button to keep going
          const nextBtn = findButtonByText(document, SELECTORS.nextPageText) ||
            document.querySelector('a.fright, [class*="next" i] a, a[class*="next" i], a[rel="next"]');

          if (nextBtn && visible(nextBtn) && !abortRequested) {
            log('🌐 Current page exhausted. Navigating to Next page...', 'info');
            pageNumber++;
            triggerClick(nextBtn, document);
            await sleep(5000);
            await waitForCards(15000);
            continue;
          }

          log('No more new eligible jobs found on this search.', 'info');
          break;
        }

        // Mark as seen immediately so it can never be selected again
        seenJobs.add(targetJob.href);
        seenJobs.add(targetJob.jobId);
        chrome.storage.local.set({ seenJobs: [...seenJobs] }).catch(() => {});

        log(`▶ Inspecting (${appliedCount + 1}/${maxTarget}): ${targetJob.title} @ ${targetJob.company}`, 'info');
        targetJob.card.scrollIntoView({ block: 'center' });

        const success = await applyInPopup(popup, targetJob, config, seenJobs);
        if (success) {
          appliedCount++;
          const jobRecord = {
            title: targetJob.title,
            company: targetJob.company,
            salary: (targetJob.salary && targetJob.salary.text) || '≥ 18 LPA',
            link: targetJob.href,
            verified: 'submitted',
            date: new Date().toLocaleTimeString()
          };
          sessionJobs.push(jobRecord);
          log(`✅ Applied (${appliedCount}/${maxTarget}): ${targetJob.title} @ ${targetJob.company}`, 'success');

          chrome.runtime.sendMessage({
            type: 'JOB_SUBMITTED',
            job: jobRecord
          }).catch(() => {});
        }

        // Anti-bot detection: randomized human pacing delay between job applications
        const pacingDelay = getHumanDelay(config.pacingSpeed || 'stealth');
        log(`⏳ Human pacing delay: waiting ${(pacingDelay / 1000).toFixed(1)}s before next job...`, 'info');
        await sleep(pacingDelay);
      }
    } finally {
      if (popup && !popup.closed) popup.close();
      isRunning = false;
      log(`Run complete. Submitted ${appliedCount} applications.`, 'info');

      // Dispatch session completion and trigger email digest
      chrome.runtime.sendMessage({
        type: 'SESSION_FINISHED',
        sessionJobs
      }).catch(() => {});
    }
  }

  // Listen for control commands from Side Panel
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
      sendResponse({ pong: true });
    } else if (msg.type === 'EXECUTE_AUTO_APPLY') {
      runAutoApply(msg.config || {});
      sendResponse({ received: true });
    } else if (msg.type === 'SYNC_FILTERS') {
      syncSidebarFilters(msg.filters || {}).then((clicked) => {
        sendResponse({ success: true, count: clicked.length });
      });
      return true;
    } else if (msg.type === 'PAUSE_AUTO_APPLY') {
      abortRequested = true;
      isRunning = false;
      log('Automation paused by user.', 'warn');
      sendResponse({ paused: true });
    }
    return true;
  });
})();
