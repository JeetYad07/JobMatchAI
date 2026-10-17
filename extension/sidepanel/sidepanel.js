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
  const selectPacingSpeed = document.getElementById('selectPacingSpeed');

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

  // DOM Elements - Candidate Profile Editor
  const btnToggleProfileEdit = document.getElementById('btnToggleProfileEdit');
  const profileEditorDrawer = document.getElementById('profileEditorDrawer');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const btnResetProfile = document.getElementById('btnResetProfile');
  const profileName = document.getElementById('profileName');
  const profileRole = document.getElementById('profileRole');
  const profileMeta = document.getElementById('profileMeta');

  const inputProfileName = document.getElementById('inputProfileName');
  const inputProfileEmail = document.getElementById('inputProfileEmail');
  const inputProfilePhone = document.getElementById('inputProfilePhone');
  const inputProfileRole = document.getElementById('inputProfileRole');
  const inputProfileCompany = document.getElementById('inputProfileCompany');
  const inputProfileExp = document.getElementById('inputProfileExp');
  const inputProfileEdu = document.getElementById('inputProfileEdu');
  const inputProfileLocation = document.getElementById('inputProfileLocation');
  const inputProfileNotice = document.getElementById('inputProfileNotice');
  const inputProfileCurrentCTC = document.getElementById('inputProfileCurrentCTC');
  const inputProfileExpectedCTC = document.getElementById('inputProfileExpectedCTC');
  const inputProfileLinkedin = document.getElementById('inputProfileLinkedin');
  const inputProfileGithub = document.getElementById('inputProfileGithub');

  const DEFAULT_PROFILE = {
    name: 'Jeet Bahadur',
    email: 'jeetb.yadav11@gmail.com',
    phone: '+91 9478632012',
    location: 'Bengaluru, India',
    currentRole: 'Software Engineer',
    company: 'MSG Global Solutions',
    education: 'B.Tech in Chemical Engineering, NIT Jalandhar (2018-2022)',
    yearsNumber: '4.3',
    noticePeriod: '30 days',
    currentCTC: '0',
    expectedCTC: '18-25',
    linkedin: 'https://www.linkedin.com/in/jeet-y-41a073175/',
    github: 'https://github.com/JeetYad07'
  };

  let activeProfile = { ...DEFAULT_PROFILE };

  let isRunning = false;
  let isToggling = false;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Render candidate profile summary preview card
  function renderProfilePreview(profile) {
    if (!profile) return;
    if (profileName) profileName.textContent = profile.name || DEFAULT_PROFILE.name;
    if (profileRole) {
      profileRole.innerHTML = `${escapeHtml(profile.currentRole || DEFAULT_PROFILE.currentRole)} &bull; ${escapeHtml(profile.company || DEFAULT_PROFILE.company)}`;
    }
    if (profileMeta) {
      const eduShort = (profile.education || 'B.Tech NITJ').split(',')[0];
      profileMeta.innerHTML = `
        <span>💼 ${escapeHtml(profile.yearsNumber || DEFAULT_PROFILE.yearsNumber)} Yrs Exp</span> &bull; 
        <span>📍 ${escapeHtml(profile.location || DEFAULT_PROFILE.location)}</span> &bull; 
        <span>🎓 ${escapeHtml(eduShort)}</span>
      `;
    }
  }

  // Populate drawer inputs with profile data
  function fillProfileInputs(profile) {
    if (!profile) return;
    if (inputProfileName) inputProfileName.value = profile.name || '';
    if (inputProfileEmail) inputProfileEmail.value = profile.email || '';
    if (inputProfilePhone) inputProfilePhone.value = profile.phone || '';
    if (inputProfileRole) inputProfileRole.value = profile.currentRole || '';
    if (inputProfileCompany) inputProfileCompany.value = profile.company || '';
    if (inputProfileExp) inputProfileExp.value = profile.yearsNumber || '';
    if (inputProfileEdu) inputProfileEdu.value = profile.education || '';
    if (inputProfileLocation) inputProfileLocation.value = profile.location || '';
    if (inputProfileNotice) inputProfileNotice.value = profile.noticePeriod || '';
    if (inputProfileCurrentCTC) inputProfileCurrentCTC.value = profile.currentCTC || '';
    if (inputProfileExpectedCTC) inputProfileExpectedCTC.value = profile.expectedCTC || '';
    if (inputProfileLinkedin) inputProfileLinkedin.value = profile.linkedin || '';
    if (inputProfileGithub) inputProfileGithub.value = profile.github || '';
  }

  // Collect modified candidate profile from inputs
  function getProfileFromInputs() {
    return {
      name: inputProfileName?.value?.trim() || activeProfile.name || DEFAULT_PROFILE.name,
      email: inputProfileEmail?.value?.trim() || activeProfile.email || DEFAULT_PROFILE.email,
      phone: inputProfilePhone?.value?.trim() || activeProfile.phone || DEFAULT_PROFILE.phone,
      currentRole: inputProfileRole?.value?.trim() || activeProfile.currentRole || DEFAULT_PROFILE.currentRole,
      company: inputProfileCompany?.value?.trim() || activeProfile.company || DEFAULT_PROFILE.company,
      yearsNumber: inputProfileExp?.value?.trim() || activeProfile.yearsNumber || DEFAULT_PROFILE.yearsNumber,
      education: inputProfileEdu?.value?.trim() || activeProfile.education || DEFAULT_PROFILE.education,
      location: inputProfileLocation?.value?.trim() || activeProfile.location || DEFAULT_PROFILE.location,
      noticePeriod: inputProfileNotice?.value?.trim() || activeProfile.noticePeriod || DEFAULT_PROFILE.noticePeriod,
      currentCTC: inputProfileCurrentCTC?.value?.trim() || activeProfile.currentCTC || DEFAULT_PROFILE.currentCTC,
      expectedCTC: inputProfileExpectedCTC?.value?.trim() || activeProfile.expectedCTC || DEFAULT_PROFILE.expectedCTC,
      linkedin: inputProfileLinkedin?.value?.trim() || activeProfile.linkedin || DEFAULT_PROFILE.linkedin,
      github: inputProfileGithub?.value?.trim() || activeProfile.github || DEFAULT_PROFILE.github,
    };
  }

  // Persist candidate profile to storage and refresh UI
  async function saveCandidateProfile(profile) {
    activeProfile = { ...profile };
    await chrome.storage.local.set({ candidateProfile: activeProfile });
    renderProfilePreview(activeProfile);
    fillProfileInputs(activeProfile);
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
      skipUndisclosed: toggleSkipUndisclosed ? toggleSkipUndisclosed.checked : true,
      pacingSpeed: selectPacingSpeed ? selectPacingSpeed.value : 'stealth',
      candidateProfile: activeProfile
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
      skipUndisclosed: filters.skipUndisclosed,
      pacingSpeed: filters.pacingSpeed,
      candidateProfile: activeProfile
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
      'targetingFilters',
      'candidateProfile',
      'pacingSpeed'
    ]);

    updateRunningState(Boolean(data.running));
    metricApplied.innerHTML = `${data.todayApplied || 0} <span class="metric-max">/ ${data.dailyCap || 20}</span>`;
    inputMinSalary.value = data.minSalaryLPA || 18;
    inputMaxTarget.value = data.maxPerRun || 10;
    if (toggleCriteriaMatch) toggleCriteriaMatch.checked = data.requireAllCriteria !== false;
    if (toggleSkipUndisclosed) toggleSkipUndisclosed.checked = data.skipUndisclosed !== false;
    if (selectPacingSpeed && data.pacingSpeed) selectPacingSpeed.value = data.pacingSpeed;

    activeProfile = data.candidateProfile ? { ...DEFAULT_PROFILE, ...data.candidateProfile } : { ...DEFAULT_PROFILE };
    renderProfilePreview(activeProfile);
    fillProfileInputs(activeProfile);

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
      if (tf.pacingSpeed && selectPacingSpeed) selectPacingSpeed.value = tf.pacingSpeed;
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

  // Profile Drawer Event Listeners
  if (btnToggleProfileEdit && profileEditorDrawer) {
    btnToggleProfileEdit.addEventListener('click', () => {
      const isHidden = profileEditorDrawer.style.display === 'none';
      profileEditorDrawer.style.display = isHidden ? 'block' : 'none';
      btnToggleProfileEdit.textContent = isHidden ? '✕ Close' : '✏ Edit';
    });
  }

  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      const updated = getProfileFromInputs();
      await saveCandidateProfile(updated);
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: `💾 Candidate profile updated: ${updated.name} (${updated.currentRole} @ ${updated.company})`,
        type: 'success'
      });
      if (profileEditorDrawer) profileEditorDrawer.style.display = 'none';
      if (btnToggleProfileEdit) btnToggleProfileEdit.textContent = '✏ Edit';
    });
  }

  if (btnResetProfile) {
    btnResetProfile.addEventListener('click', async () => {
      await saveCandidateProfile(DEFAULT_PROFILE);
      appendLogEntry({
        time: new Date().toLocaleTimeString(),
        text: `↺ Profile reset to Jeet Bahadur's verified CV defaults.`,
        type: 'info'
      });
    });
  }

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
    inputMinSalary, inputMaxTarget, toggleCriteriaMatch, toggleSkipUndisclosed, toggleAutoNavigate,
    selectPacingSpeed
  ].forEach((el) => {
    if (el) el.addEventListener('change', saveTargetingFilters);
  });

  // Clear logs button completely clears feed
  btnClearLogs.addEventListener('click', async () => {
    await chrome.storage.local.set({ logs: [] });
    logStream.innerHTML = '';
  });
});
