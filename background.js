import { saveCapture, getCaptures, deleteCapture, clearCaptures } from './storage.js';

const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com'
];

function isRestrictedUrl(url = '') {
  return RESTRICTED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || isRestrictedUrl(tab.url)) {
    if (tab?.id) {
      chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
      chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#ef4444' });
      setTimeout(() => {
        chrome.action.setBadgeText({ tabId: tab.id, text: '' }).catch(() => {});
      }, 2000);
    }
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TECHSNAP_TOGGLE' });
  } catch {
    // Content script was not yet injected (e.g. tab opened before extension install/reload)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'TECHSNAP_TOGGLE' });
    } catch (err) {
      console.error('[TechSnap] Failed to inject content script:', err);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return false;

  if (msg.type === 'TECHSNAP_CAPTURE_TAB') {
    const windowId = sender?.tab?.windowId;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'captureVisibleTab failed' }));
    return true;
  }

  if (msg.type === 'TECHSNAP_SAVE_CAPTURE') {
    saveCapture(msg.payload)
      .then((res) => sendResponse({ ok: true, ...res }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'saveCapture failed' }));
    return true;
  }

  if (msg.type === 'TECHSNAP_LIST_CAPTURES') {
    getCaptures()
      .then((items) => sendResponse({ ok: true, items }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'getCaptures failed' }));
    return true;
  }

  if (msg.type === 'TECHSNAP_DELETE_CAPTURE') {
    deleteCapture(msg.id)
      .then(async () => {
        const items = await getCaptures();
        sendResponse({ ok: true, count: items.length });
      })
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'deleteCapture failed' }));
    return true;
  }

  if (msg.type === 'TECHSNAP_CLEAR_CAPTURES') {
    clearCaptures()
      .then(() => sendResponse({ ok: true, count: 0 }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'clearCaptures failed' }));
    return true;
  }

  return false;
});
