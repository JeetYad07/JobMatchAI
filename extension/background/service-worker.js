/**
 * JobMatch AI — Background Service Worker (Manifest V3)
 * Manages side panel behavior, ephemeral state persistence via chrome.storage.local,
 * badge updates, content script injection, and email bridge forwarding.
 */

// Configure the side panel to open immediately on clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[JobMatch AI] Error setting panel behavior:', err));

// Initialize default storage on installation
chrome.runtime.onInstalled.addListener(async () => {
  const defaults = {
    running: false,
    minSalaryLPA: 18,
    requireAllCriteria: true,
    maxPerRun: 10,
    dailyCap: 20,
    todayApplied: 0,
    todayDate: new Date().toDateString(),
    appliedJobs: [],
    seenJobs: [],
    logs: [
      {
        time: new Date().toLocaleTimeString(),
        text: 'JobMatch AI installed and ready.',
        type: 'info'
      }
    ]
  };

  const stored = await chrome.storage.local.get(Object.keys(defaults));
  const toSet = {};
  for (const [k, v] of Object.entries(defaults)) {
    if (stored[k] === undefined) {
      toSet[k] = v;
    }
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }

  await updateBadge();
  console.log('[JobMatch AI] Service Worker initialized successfully.');
});

// Update badge count with today's applied jobs
async function updateBadge() {
  const { todayApplied = 0 } = await chrome.storage.local.get('todayApplied');
  if (todayApplied > 0) {
    await chrome.action.setBadgeText({ text: String(todayApplied) });
    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// Check and reset daily counter if the day rolled over
async function checkDailyReset() {
  const { todayDate } = await chrome.storage.local.get('todayDate');
  const currentDay = new Date().toDateString();
  if (todayDate !== currentDay) {
    await chrome.storage.local.set({
      todayDate: currentDay,
      todayApplied: 0,
    });
    await updateBadge();
  }
}

// Dispatch email digest to local bridge server (http://127.0.0.1:3099)
async function triggerEmailDigest(jobs) {
  try {
    const res = await fetch('http://127.0.0.1:3099/api/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs })
    });
    const data = await res.json();
    return data && data.success;
  } catch (err) {
    console.warn('[JobMatch AI] Email bridge server offline:', err.message);
    return false;
  }
}

// Listen for messages from Side Panel or Content Scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await checkDailyReset();

    switch (message.type) {
      case 'GET_STATUS': {
        const state = await chrome.storage.local.get([
          'running',
          'minSalaryLPA',
          'requireAllCriteria',
          'maxPerRun',
          'dailyCap',
          'todayApplied',
          'appliedJobs',
          'logs'
        ]);
        sendResponse({ success: true, state });
        break;
      }

      case 'START_APPLY': {
        await chrome.storage.local.set({ running: true });
        const config = message.config || {};
        const targetUrl = config.searchUrl || 'https://www.naukri.com/full-stack-developer-jobs?experience=4&ctcFilter=15to25&ctcFilter=25to50&ctcFilter=50to75';

        // Helper to run content script on tab
        const runOnTab = async (tabId) => {
          chrome.tabs.sendMessage(tabId, { type: 'PING' }, async (response) => {
            if (chrome.runtime.lastError || !response || !response.pong) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId },
                  files: ['content/naukri-content.js']
                });
                await new Promise((r) => setTimeout(r, 400));
              } catch (e) {
                console.log('[JobMatch AI] Script injection notice:', e.message);
              }
            }

            chrome.tabs.sendMessage(tabId, {
              type: 'EXECUTE_AUTO_APPLY',
              config
            }).catch((err) => console.error('[JobMatch AI] Message tab err:', err));
          });
        };

        // Find active tab or any Naukri tab
        let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || !tab.url || !tab.url.includes('naukri.com')) {
          const naukriTabs = await chrome.tabs.query({ url: '*://*.naukri.com/*' });
          tab = naukriTabs[0];
        }

        // If no Naukri tab is open, open one directly with the targeted search URL
        if (!tab) {
          chrome.tabs.create({ url: targetUrl, active: true }, (newTab) => {
            const listener = (tabId, info) => {
              if (tabId === newTab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => runOnTab(tabId), 2000);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
          sendResponse({ success: true, message: 'Opening targeted search in new tab...' });
          break;
        }

        // Tab is open: check if auto-pilot navigation is enabled and tab is not yet on the exact search URL
        const currentUrl = tab.url || '';
        const isSearchPage = /(-jobs|\/jobs|\/search|q=)/i.test(currentUrl);
        let urlsEqual = false;
        try {
          const u1 = new URL(currentUrl);
          const u2 = new URL(targetUrl);
          urlsEqual = (u1.origin === u2.origin && u1.pathname === u2.pathname && u1.search === u2.search);
        } catch (e) {
          urlsEqual = false;
        }

        const shouldNavigate = config.autoNavigate && (!isSearchPage || !urlsEqual);

        if (shouldNavigate) {
          chrome.tabs.update(tab.id, { url: targetUrl, active: true }, (updatedTab) => {
            const listener = (tabId, info) => {
              if (tabId === updatedTab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => runOnTab(tabId), 2000);
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
          sendResponse({ success: true, message: 'Navigating tab to targeted search page...' });
          break;
        }

        // Tab is already on search page: trigger directly
        await runOnTab(tab.id);
        sendResponse({ success: true, message: 'Automation initiated on active search tab.' });
        break;
      }

      case 'STOP_APPLY': {
        await chrome.storage.local.set({ running: false });
        const tabs = await chrome.tabs.query({ url: '*://*.naukri.com/*' });
        for (const t of tabs) {
          if (t.id) {
            chrome.tabs.sendMessage(t.id, { type: 'PAUSE_AUTO_APPLY' }).catch(() => {});
          }
        }
        sendResponse({ success: true, message: 'Automation paused.' });
        break;
      }

      case 'JOB_SUBMITTED': {
        const { job } = message;
        const { todayApplied = 0, appliedJobs = [] } = await chrome.storage.local.get(['todayApplied', 'appliedJobs']);
        const newCount = todayApplied + 1;
        const updatedJobs = [job, ...appliedJobs].slice(0, 100);

        await chrome.storage.local.set({
          todayApplied: newCount,
          appliedJobs: updatedJobs
        });
        await updateBadge();
        sendResponse({ success: true, newCount });
        break;
      }

      case 'APPEND_LOG': {
        const { log } = message;
        const { logs = [] } = await chrome.storage.local.get('logs');
        // Store in chronological order (appended to end)
        const updatedLogs = [...logs, log].slice(-100);
        await chrome.storage.local.set({ logs: updatedLogs });
        // Stream directly to sidepanel in real-time
        chrome.runtime.sendMessage({ type: 'LIVE_LOG', log }).catch(() => {});
        sendResponse({ success: true });
        break;
      }

      case 'SESSION_FINISHED': {
        const { sessionJobs = [] } = message;
        await chrome.storage.local.set({ running: false });

        if (sessionJobs.length > 0) {
          const sent = await triggerEmailDigest(sessionJobs);
          const logMsg = sent
            ? `✉ Email digest sent with ${sessionJobs.length} applications to your inbox!`
            : `ℹ Email digest saved locally. (Start "node email-notifier.js --server" to auto-dispatch)`;
          const time = new Date().toLocaleTimeString();
          const logItem = { time, text: logMsg, type: sent ? 'success' : 'info' };

          const { logs = [] } = await chrome.storage.local.get('logs');
          await chrome.storage.local.set({ logs: [...logs, logItem].slice(-100) });
          chrome.runtime.sendMessage({ type: 'LIVE_LOG', log: logItem }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case 'DISPATCH_EMAIL_DIGEST': {
        const { appliedJobs = [] } = await chrome.storage.local.get('appliedJobs');
        const jobsToSend = (message.jobs && message.jobs.length > 0) ? message.jobs : appliedJobs;
        const ok = await triggerEmailDigest(jobsToSend);
        sendResponse({ success: ok });
        break;
      }

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});
