/**
 * JobMatch AI — Side Panel Controller
 * Handles user interactions, smart search targeting filters,
 * resume auto-preset, metrics, real-time logs, and email digests.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Actions & Status
  const btnToggle = document.getElementById('btnToggleApply');
  const btnIcon = document.getElementById('btnIcon');
  const btnText = document.getElementById('btnText');
  const btnSendDigest = document.getElementById('btnSendDigest');
  const statusBadge = document.getElementById('appStatusBadge');
  const statusText = document.getElementById('statusText');
  const metricApplied = document.getElementById('metricApplied');
  const quickTip = document.getElementById('quickTip');
  const logStream = document.getElementById('logStream');
  const btnClearLogs = document.getElementById('btnClearLogs');

  // DOM Elements - Rules & Toggles
  const inputMinSalary = document.getElementById('inputMinSalary');
  const inputMaxTarget = document.getElementById('inputMaxTarget');
  const toggleCriteriaMatch = document.getElementById('toggleCriteriaMatch');
  const toggleSkipUndisclosed = document.getElementById('toggleSkipUndisclosed');

  // DOM Elements - Smart Search Targeting Hub
  const btnAutoFillResume = document.getElementById('btnAutoFillResume');
  const btnOpenSearch = document.getElementById('btnOpenSearch');
  const btnSyncFilters = document.getElementById('btnSyncFilters');
  const filterRole = document.getElementById('filterRole');
  const filterExperience = document.getElementById('filterExperience');
  const locationChips = document.querySelectorAll('#locationChips .chip-pill');
  const filterWorkMode = document.getElementById('filterWorkMode');
  const filterFreshness = document.getElementById('filterFreshness');
  const filterPostedBy = document.getElementById('filterPostedBy');
  const filterDepartment = document.getElementById('filterDepartment');
  const filterCompanyType = document.getElementById('filterCompanyType');
  const filterEducation = document.getElementById('filterEducation');
  const toggleAutoNavigate = document.getElementById('toggleAutoNavigate');

  let isRunning = false;
  let isToggling = false;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Append a single log entry and auto-scroll to bottom
  function appendLogEntry(item) {
    if (!item || !item.text) return;
    const placeholder = logStream.querySelector('.placeholder-entry');
    if (placeholder) placeholder.remove();

    const entry = document.createElement('div');
    entry.className = `log-entry ${item.type || 'info'}`;
    entry.innerHTML = `
      <span class="log-time">${item.time || new Date().toLocaleTimeString()}</span>
      <span class="log-msg">${escapeHtml(item.text)}</span>
    `;
    logStream.appendChild(entry);
    logStream.scrollTop = logStream.scrollHeight;
  }

  // Render complete log history
  function renderLogs(logs = []) {
    logStream.innerHTML = '';
    if (logs.length === 0) {
      logStream.innerHTML = `
        <div class="log-entry info placeholder-entry">
          <span class="log-time">00:00</span>
          <span class="log-msg">Ready. Click Start to begin auto-applying.</span>
        </div>`;
      return;
    }
    logs.forEach(appendLogEntry);
  }

  // Update UI running state
  function updateRunningState(running) {
    isRunning = running;
    if (running) {
      btnToggle.classList.add('running');
      btnIcon.textContent = '⏹';
      btnText.textContent = 'Pause Automation';
      statusBadge.classList.add('active');
      statusText.textContent = 'Applying';
      quickTip.textContent = 'Active: Scanning jobs matching your targeting filters.';
    } else {
      btnToggle.classList.remove('running');
      btnIcon.textContent = '▶';
      btnText.textContent = 'Start Auto-Apply';
      statusBadge.classList.remove('active');
      statusText.textContent = 'Ready';
      quickTip.textContent = 'Tip: Click "Fill from Resume" to apply with pre-verified filters.';
    }
  }

  // Extract selected locations from chip pills
  function getSelectedLocations() {
    return [...document.querySelectorAll('#locationChips .chip-pill.active')]
      .map((el) => el.getAttribute('data-loc'))
      .filter(Boolean);
  }

  // Set location chip pills active state
  function setSelectedLocations(locs = []) {
    const set = new Set(locs.map((l) => l.toLowerCase()));
    locationChips.forEach((chip) => {
      const loc = chip.getAttribute('data-loc');
      if (set.has(loc)) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // Read all user filters from the UI
  function getFiltersFromUI() {
    return {
      role: filterRole.value || 'full-stack-developer',
      experience: Number(filterExperience.value) || 4,
      locations: getSelectedLocations(),
      workMode: filterWorkMode.value,
      freshness: filterFreshness.value,
      postedBy: filterPostedBy.value,
      department: filterDepartment.value,
      companyType: filterCompanyType.value,
      education: filterEducation.value,
      autoNavigate: toggleAutoNavigate ? toggleAutoNavigate.checked : true,
      minSalaryLPA: Number(inputMinSalary.value) || 18,
      maxPerRun: Number(inputMaxTarget.value) || 10,
      requireAllCriteria: toggleCriteriaMatch ? toggleCriteriaMatch.checked : true,
      skipUndisclosed: toggleSkipUndisclosed ? toggleSkipUndisclosed.checked : true
    };
  }

  const CITY_GIDS = {
    bengaluru: '97',
    bangalore: '97',
    delhi: '9508',
    pune: '139',
    hyderabad: '17',
    mumbai: '218',
    chennai: '14'
  };

  const CITY_SLUGS = {
    bengaluru: 'in-bengaluru',
    pune: 'in-pune',
    hyderabad: 'in-hyderabad-secunderabad',
    delhi: 'in-delhi-ncr',
    mumbai: 'in-mumbai',
    chennai: 'in-chennai'
  };

  // Build high-precision parameterized Naukri search URL
  function buildNaukriSearchUrl(filters) {
    const roleSlug = (filters.role || 'full-stack-developer')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const selectedLocs = (filters.locations && Array.isArray(filters.locations))
      ? filters.locations.map((l) => l.toLowerCase())
      : ['bengaluru'];

    const hasRemote = selectedLocs.includes('remote') ||
      filters.workMode === 'remote_only' ||
      filters.workMode === 'hybrid_remote';

    const physicalCities = selectedLocs.filter((l) => l !== 'remote');

    let baseUrl = '';
    const params = new URLSearchParams();

    // Canonical single physical city URL or multi-city URL
    if (physicalCities.length === 1 && CITY_SLUGS[physicalCities[0]]) {
      baseUrl = `https://www.naukri.com/${roleSlug}-jobs-${CITY_SLUGS[physicalCities[0]]}`;
    } else {
      baseUrl = `https://www.naukri.com/${roleSlug}-jobs`;
      physicalCities.forEach((city) => {
        if (CITY_GIDS[city]) {
          params.append('cityTypeGid', CITY_GIDS[city]);
        }
      });
    }

    // 1. Experience
    if (filters.experience !== undefined && filters.experience !== null && filters.experience !== '') {
      params.set('experience', String(filters.experience));
    }

    // 2. Compensation Filter (minSalary)
    const minSal = filters.minSalaryLPA || 18;
    if (minSal >= 18) {
      params.append('ctcFilter', '15to25');
      params.append('ctcFilter', '25to50');
      params.append('ctcFilter', '50to75');
    } else if (minSal >= 15) {
      params.append('ctcFilter', '15to25');
      params.append('ctcFilter', '25to50');
    } else if (minSal >= 10) {
      params.append('ctcFilter', '10to15');
      params.append('ctcFilter', '15to25');
    }

    // 3. Work Mode & Remote (wfhType: 1=Office, 2=Hybrid, 3=Remote)
    if (filters.workMode === 'remote_only') {
      params.set('wfhType', '3');
    } else if (filters.workMode === 'hybrid_only') {
      params.set('wfhType', '2');
    } else if (filters.workMode === 'office') {
      params.set('wfhType', '1');
    } else if (hasRemote || filters.workMode === 'hybrid_remote') {
      params.append('wfhType', '2');
      params.append('wfhType', '3');
    }

    // 4. Freshness / Posting Age
    if (filters.freshness && filters.freshness !== 'any') {
      params.set('jobAge', String(filters.freshness));
    }

    // 5. Posted By (1 = Direct Employer, excludes third-party agencies)
    if (filters.postedBy === 'direct') {
      params.set('postedBy', '1');
    }

    // 6. Department (Engineering - Software & QA)
    if (filters.department === 'engineering') {
      params.set('glbl_qc_dept', 'engineering---software-qa_1');
    }

    // 7. Company Type
    if (filters.companyType === 'mnc') {
      params.set('companyType', 'foreign_mnc,corporate');
    } else if (filters.companyType === 'startup') {
      params.set('companyType', 'startup');
    } else if (filters.companyType === 'mnc_startup') {
      params.set('companyType', 'foreign_mnc,corporate,startup');
    }

    // 8. Education (12 = B.Tech / B.E.)
    if (filters.education === 'btech') {
      params.set('ugTypeGid', '12');
    }

    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  // Save current targeting filters to local storage
  async function saveTargetingFilters() {
    const filters = getFiltersFromUI();
    await chrome.storage.local.set({
      targetingFilters: filters,
      minSalaryLPA: filters.minSalaryLPA,
      maxPerRun: filters.maxPerRun,
      requireAllCriteria: filters.requireAllCriteria,
      skipUndisclosed: filters.skipUndisclosed
    });
  }

  // Initial state fetch from storage
  async function loadState() {
    const data = await chrome.storage.local.get([
      'running',
      'minSalaryLPA',
      'requireAllCriteria',
      'skipUndisclosed',
      'maxPerRun',
      'dailyCap',
      'todayApplied',
      'logs',
      'targetingFilters'
    ]);

    updateRunningState(Boolean(data.running));
    metricApplied.innerHTML = `${data.todayApplied || 0} <span class="metric-max">/ ${data.dailyCap || 20}</span>`;
    inputMinSalary.value = data.minSalaryLPA || 18;
    inputMaxTarget.value = data.maxPerRun || 10;
    if (toggleCriteriaMatch) toggleCriteriaMatch.checked = data.requireAllCriteria !== false;
    if (toggleSkipUndisclosed) toggleSkipUndisclosed.checked = data.skipUndisclosed !== false;
    renderLogs(data.logs || []);

    // Restore saved targeting filters
    const tf = data.targetingFilters;
    if (tf) {
      if (tf.role && filterRole) filterRole.value = tf.role;
      if (tf.experience && filterExperience) filterExperience.value = tf.experience;
      if (tf.locations) setSelectedLocations(tf.locations);
      if (tf.workMode && filterWorkMode) filterWorkMode.value = tf.workMode;
      if (tf.freshness && filterFreshness) filterFreshness.value = tf.freshness;
      if (tf.postedBy && filterPostedBy) filterPostedBy.value = tf.postedBy;
      if (tf.department && filterDepartment) filterDepartment.value = tf.department;
      if (tf.companyType && filterCompanyType) filterCompanyType.value = tf.companyType;
      if (tf.education && filterEducation) filterEducation.value = tf.education;
      if (toggleAutoNavigate && tf.autoNavigate !== undefined) toggleAutoNavigate.checked = tf.autoNavigate;
    }
  }

  await loadState();

  // Location chips toggle handler
  locationChips.forEach((chip) => {
    chip.addEventListener('click', async () => {
      chip.classList.toggle('active');
      await saveTargetingFilters();
    });
  });

  // "✨ Fill from Resume" preset button
  if (btnAutoFillResume) {
    btnAutoFillResume.addEventListener('click', async () => {
      filterRole.value = 'full-stack-developer';
      filterExperience.value = 4;
      setSelectedLocations(['bengaluru', 'remote']);
      filterWorkMode.value = 'hybrid_remote';
      filterFreshness.value = '7';
      filterPostedBy.value = 'direct';
      filterDepartment.value = 'engineering';
      filterCompanyType.value = 'mnc_startup';
      filterEducation.value = 'btech';
      inputMinSalary.value = 18;
      inputMaxTarget.value = 10;
      if (toggleCriteriaMatch) toggleCriteriaMatch.checked = true;
      if (toggleSkipUndisclosed) toggleSkipUndisclosed.checked = true;
      if (toggleAutoNavigate) toggleAutoNavigate.checked = true;

      await saveTargetingFilters();
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: '✨ Filters configured from verified CV: 4 yrs exp, ≥18 LPA, Bengaluru/Remote, Direct Employer, Last 7 Days.',
        type: 'success'
      });
    });
  }

  // "🔍 Preview Filtered Search" button
  if (btnOpenSearch) {
    btnOpenSearch.addEventListener('click', async () => {
      const filters = getFiltersFromUI();
      const targetUrl = buildNaukriSearchUrl(filters);
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: `🌐 Opening filtered search: ${targetUrl.slice(0, 75)}...`,
        type: 'info'
      });

      let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab || !tab.url || !tab.url.includes('naukri.com')) {
        const naukriTabs = await chrome.tabs.query({ url: '*://*.naukri.com/*' });
        tab = naukriTabs[0];
      }

      if (tab && tab.id) {
        chrome.tabs.update(tab.id, { url: targetUrl, active: true });
      } else {
        chrome.tabs.create({ url: targetUrl, active: true });
      }
    });
  }

  // "⚡ Apply Filters to Page" button (Live URL & targeting application)
  if (btnSyncFilters) {
    btnSyncFilters.addEventListener('click', async () => {
      const filters = getFiltersFromUI();
      const targetUrl = buildNaukriSearchUrl(filters);
      await saveTargetingFilters();

      const locSummary = (filters.locations && filters.locations.length) ? filters.locations.join(', ') : 'All India';
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: `⚡ Applying targeting filters (${locSummary}, ≥${filters.minSalaryLPA} LPA, exp: ${filters.experience}y)...`,
        type: 'info'
      });

      let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab || !tab.url || !tab.url.includes('naukri.com')) {
        const naukriTabs = await chrome.tabs.query({ url: '*://*.naukri.com/*' });
        tab = naukriTabs[0];
      }

      if (tab && tab.id) {
        chrome.tabs.update(tab.id, { url: targetUrl, active: true }, () => {
          appendLogEntry({
            time: new Date().toLocaleTimeString(),
            text: `✅ Filters applied! Page refreshed with target criteria.`,
            type: 'success'
          });
        });
      } else {
        chrome.tabs.create({ url: targetUrl, active: true }, () => {
          appendLogEntry({
            time: new Date().toLocaleTimeString(),
            text: `🌐 Opened new tab with target search filters.`,
            type: 'success'
          });
        });
      }
    });
  }

  // Listen for direct real-time broadcast logs
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'LIVE_LOG' || msg.type === 'APPEND_LOG') {
      if (msg.log) appendLogEntry(msg.log);
    }
  });

  // Listen for storage changes in real-time
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.running) {
      updateRunningState(Boolean(changes.running.newValue));
    }
    if (changes.todayApplied || changes.dailyCap) {
      chrome.storage.local.get(['todayApplied', 'dailyCap']).then((d) => {
        metricApplied.innerHTML = `${d.todayApplied || 0} <span class="metric-max">/ ${d.dailyCap || 20}</span>`;
      });
    }
  });

  // Toggle Start / Stop with debounce & auto-pilot search URL
  btnToggle.addEventListener('click', async () => {
    if (isToggling) return;
    isToggling = true;
    btnToggle.disabled = true;
    setTimeout(() => {
      btnToggle.disabled = false;
      isToggling = false;
    }, 1500);

    const targetRunning = !isRunning;
    const filters = getFiltersFromUI();
    const searchUrl = buildNaukriSearchUrl(filters);

    const config = {
      ...filters,
      searchUrl
    };

    await saveTargetingFilters();

    if (targetRunning) {
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: `Targeting: ${filters.role} (≥ ${filters.minSalaryLPA} LPA, exp: ${filters.experience} yrs)...`,
        type: 'info'
      });

      chrome.runtime.sendMessage({ type: 'START_APPLY', config }, (res) => {
        if (res && res.success) {
          updateRunningState(true);
        } else if (res && res.message) {
          appendLogEntry({ time: new Date().toLocaleTimeString(), text: res.message, type: 'warn' });
          alert(res.message);
          updateRunningState(false);
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: 'STOP_APPLY' }, () => {
        updateRunningState(false);
      });
    }
  });

  // Send Email Digest Button
  if (btnSendDigest) {
    btnSendDigest.addEventListener('click', async () => {
      btnSendDigest.disabled = true;
      btnSendDigest.textContent = '⏳ Sending Digest...';
      appendLogEntry({ time: new Date().toLocaleTimeString(), text: 'Sending email digest to your inbox...', type: 'info' });

      chrome.runtime.sendMessage({ type: 'DISPATCH_EMAIL_DIGEST' }, (res) => {
        btnSendDigest.disabled = false;
        btnSendDigest.textContent = '✉ Send Digest to Email';
        if (res && res.success) {
          appendLogEntry({ time: new Date().toLocaleTimeString(), text: '✅ Email digest successfully sent to imjeet227@gmail.com!', type: 'success' });
        } else {
          appendLogEntry({
            time: new Date().toLocaleTimeString(),
            text: '⚠ Email bridge server offline. Run "node email-notifier.js --server" in terminal.',
            type: 'warn'
          });
        }
      });
    });
  }

  // Save settings on changes
  [
    filterRole, filterExperience, filterWorkMode, filterFreshness,
    filterPostedBy, filterDepartment, filterCompanyType, filterEducation,
    inputMinSalary, inputMaxTarget, toggleCriteriaMatch, toggleSkipUndisclosed, toggleAutoNavigate
  ].forEach((el) => {
    if (el) el.addEventListener('change', saveTargetingFilters);
  });

  // Clear logs button completely clears feed
  btnClearLogs.addEventListener('click', async () => {
    await chrome.storage.local.set({ logs: [] });
    logStream.innerHTML = '';
  });
});
