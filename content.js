(() => {
  if (window.__techSnapInitialized) return;
  window.__techSnapInitialized = true;

  const MAX_FULLPAGE_CSS_HEIGHT = 15000;
  const CAPTURE_QUOTA_DELAY_MS = 520;

  function t(key, substitutions) {
    try {
      const msg = chrome.i18n?.getMessage(key, substitutions);
      return msg || key;
    } catch {
      return key;
    }
  }

  const state = {
    active: false,
    mode: 'element', // 'element' | 'area'
    infoEnabled: true,
    galleryOpen: false,
    pagePopoverOpen: false,
    isCapturingFullPage: false,
    captureCount: 0,
    // Element inspector state
    hoveredEl: null,
    pinnedEl: null,
    childStack: [],
    lastPointer: { x: -9999, y: -9999 },
    wheelAccum: 0,
    // Area selection state
    areaDrawing: false,
    areaTwoClickArmed: false,
    areaStart: null,
    areaRect: null,
    dragStartTime: 0,
    // Confirm clear state
    confirmClear: false
  };

  let host = null;
  let shadow = null;
  let els = {};
  let toastTimer = null;
  let windowListenersAttached = false;

  chrome.storage.local.get(['techsnap_mode', 'techsnap_info'], (res) => {
    if (res.techsnap_mode === 'element' || res.techsnap_mode === 'area') {
      state.mode = res.techsnap_mode;
    }
    if (typeof res.techsnap_info === 'boolean') {
      state.infoEnabled = res.techsnap_info;
    }
  });

  const ICONS = {
    target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
    crop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`,
    page: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    arrowUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
    monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    scrollPage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 6h6M9 10h6M9 14h4"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
  };

  function ensureUI() {
    if (host && document.documentElement.contains(host)) return;

    host = document.createElement('div');
    host.id = 'techsnap-host';
    shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="ts-backdrop" data-mode="element"></div>
      <div class="ts-highlight"></div>
      <div class="ts-rect"></div>
      <div class="ts-badge">
        <div class="ts-badge-row">
          <span class="ts-badge-selector"></span>
          <span class="ts-badge-dims"></span>
          <span class="ts-badge-hint"></span>
        </div>
        <div class="ts-microbar">
          <button type="button" class="ts-micro-btn" id="ts-pin-parent" title="${t('pinParentTitle')}">${ICONS.arrowUp}<span>${t('pinParent')}</span></button>
          <button type="button" class="ts-micro-btn primary" id="ts-pin-capture" title="${t('pinCaptureTitle')}">${ICONS.camera}<span>${t('pinCapture')}</span></button>
          <button type="button" class="ts-micro-btn" id="ts-pin-child" title="${t('pinChildTitle')}">${ICONS.arrowDown}<span>${t('pinChild')}</span></button>
          <button type="button" class="ts-micro-btn close" id="ts-pin-unpin" title="${t('pinUnpinTitle')}">${ICONS.close}</button>
        </div>
      </div>

      <div class="ts-page-popover" id="ts-page-popover">
        <div class="ts-page-popover-title">
          <span>${t('pagePopoverTitle')}</span>
          <button type="button" class="ts-micro-btn close" id="ts-close-page-popover" title="${t('closeTitle')}">${ICONS.close}</button>
        </div>
        <button type="button" class="ts-page-choice" id="ts-capture-viewport">
          <div class="ts-page-choice-main">
            <span class="ts-page-choice-label" style="display:flex;align-items:center;gap:6px;">${ICONS.monitor}<span>${t('pageViewportLabel')}</span></span>
            <span class="ts-page-choice-sub" id="ts-viewport-dims">1440 × 900 px</span>
          </div>
          ${ICONS.chevronRight}
        </button>
        <button type="button" class="ts-page-choice" id="ts-capture-fullpage">
          <div class="ts-page-choice-main">
            <span class="ts-page-choice-label" style="display:flex;align-items:center;gap:6px;">${ICONS.scrollPage}<span>${t('pageFullLabel')}</span></span>
            <span class="ts-page-choice-sub" id="ts-fullpage-dims">1440 × 4200 px</span>
          </div>
          ${ICONS.chevronRight}
        </button>
      </div>

      <div class="ts-gallery">
        <div class="ts-gallery-header">
          <div class="ts-gallery-title">
            <span>${t('galleryTitle')}</span>
            <span class="ts-count" id="ts-gallery-count">0</span>
          </div>
          <div class="ts-gallery-actions">
            <button type="button" class="ts-btn-danger" id="ts-clear-all">${t('clearAll')}</button>
            <button type="button" class="ts-btn ts-btn-close" id="ts-close-gallery" title="${t('closeGalleryTitle')}">${ICONS.close}</button>
          </div>
        </div>
        <div class="ts-gallery-body" id="ts-gallery-body"></div>
      </div>

      <div class="ts-hud">
        <div class="ts-hud-group">
          <button type="button" class="ts-btn active" id="ts-mode-element" title="${t('modeElementTitle')}">
            ${ICONS.target}<span>${t('modeElement')}</span>
          </button>
          <button type="button" class="ts-btn" id="ts-mode-area" title="${t('modeAreaTitle')}">
            ${ICONS.crop}<span>${t('modeArea')}</span>
          </button>
          <button type="button" class="ts-btn" id="ts-mode-page" title="${t('modePageTitle')}">
            ${ICONS.page}<span>${t('modePage')}</span>
          </button>
        </div>
        <div class="ts-divider"></div>
        <button type="button" class="ts-btn ts-btn-info on" id="ts-toggle-info" title="${t('infoTitle')}">
          <span class="ts-dot"></span><span>${t('infoOn')}</span>
        </button>
        <button type="button" class="ts-btn" id="ts-toggle-gallery" title="${t('historyTitle')}">
          ${ICONS.history}<span>${t('historyLabel')}</span><span class="ts-count" id="ts-hud-count">0</span>
        </button>
        <div class="ts-divider"></div>
        <button type="button" class="ts-btn ts-btn-close" id="ts-close-hud" title="${t('closeHudTitle')}">${ICONS.close}</button>
      </div>

      <div class="ts-toast" id="ts-toast">
        <img class="ts-toast-thumb" id="ts-toast-thumb" alt="" />
        <span id="ts-toast-msg"></span>
      </div>
    `;

    shadow.appendChild(link);
    shadow.appendChild(wrapper);
    document.documentElement.appendChild(host);

    els = {
      backdrop: shadow.querySelector('.ts-backdrop'),
      highlight: shadow.querySelector('.ts-highlight'),
      rect: shadow.querySelector('.ts-rect'),
      badge: shadow.querySelector('.ts-badge'),
      badgeSelector: shadow.querySelector('.ts-badge-selector'),
      badgeDims: shadow.querySelector('.ts-badge-dims'),
      badgeHint: shadow.querySelector('.ts-badge-hint'),
      pinParentBtn: shadow.querySelector('#ts-pin-parent'),
      pinCaptureBtn: shadow.querySelector('#ts-pin-capture'),
      pinChildBtn: shadow.querySelector('#ts-pin-child'),
      pinUnpinBtn: shadow.querySelector('#ts-pin-unpin'),
      pagePopover: shadow.querySelector('#ts-page-popover'),
      closePagePopoverBtn: shadow.querySelector('#ts-close-page-popover'),
      captureViewportBtn: shadow.querySelector('#ts-capture-viewport'),
      captureFullpageBtn: shadow.querySelector('#ts-capture-fullpage'),
      viewportDims: shadow.querySelector('#ts-viewport-dims'),
      fullpageDims: shadow.querySelector('#ts-fullpage-dims'),
      gallery: shadow.querySelector('.ts-gallery'),
      galleryBody: shadow.querySelector('#ts-gallery-body'),
      galleryCount: shadow.querySelector('#ts-gallery-count'),
      clearAllBtn: shadow.querySelector('#ts-clear-all'),
      closeGalleryBtn: shadow.querySelector('#ts-close-gallery'),
      hud: shadow.querySelector('.ts-hud'),
      modeElementBtn: shadow.querySelector('#ts-mode-element'),
      modeAreaBtn: shadow.querySelector('#ts-mode-area'),
      modePageBtn: shadow.querySelector('#ts-mode-page'),
      infoBtn: shadow.querySelector('#ts-toggle-info'),
      galleryBtn: shadow.querySelector('#ts-toggle-gallery'),
      hudCount: shadow.querySelector('#ts-hud-count'),
      closeHudBtn: shadow.querySelector('#ts-close-hud'),
      toast: shadow.querySelector('#ts-toast'),
      toastThumb: shadow.querySelector('#ts-toast-thumb'),
      toastMsg: shadow.querySelector('#ts-toast-msg')
    };

    bindUIEvents();
    syncUIState();
  }

  function bindUIEvents() {
    els.modeElementBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode('element');
    });

    els.modeAreaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode('area');
    });

    els.modePageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePagePopover(!state.pagePopoverOpen);
    });

    els.closePagePopoverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePagePopover(false);
    });

    els.captureViewportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePagePopover(false);
      captureViewport();
    });

    els.captureFullpageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePagePopover(false);
      captureFullPage();
    });

    els.infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.infoEnabled = !state.infoEnabled;
      chrome.storage.local.set({ techsnap_info: state.infoEnabled });
      syncUIState();
      const target = state.pinnedEl || state.hoveredEl;
      if (state.mode === 'element' && target) {
        updateElementOverlay(target);
      }
    });

    els.galleryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGallery(!state.galleryOpen);
    });

    els.closeGalleryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleGallery(false);
    });

    els.closeHudBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deactivate();
    });

    // Pinned micro-bar actions
    els.pinParentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomElementParent();
    });

    els.pinChildBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      zoomElementChild();
    });

    els.pinCaptureBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.pinnedEl) {
        const target = state.pinnedEl;
        unpinElement();
        captureElement(target);
      }
    });

    els.pinUnpinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unpinElement();
    });

    els.clearAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!state.confirmClear) {
        state.confirmClear = true;
        els.clearAllBtn.textContent = t('confirmClearAll');
        setTimeout(() => {
          state.confirmClear = false;
          if (els.clearAllBtn) els.clearAllBtn.textContent = t('clearAll');
        }, 2500);
        return;
      }
      state.confirmClear = false;
      els.clearAllBtn.textContent = t('clearAll');
      await sendRuntimeMessage({ type: 'TECHSNAP_CLEAR_CAPTURES' });
      state.captureCount = 0;
      syncUIState();
      renderGallery([]);
      showToast(t('toastCleared'));
    });

    // Area mode backdrop events
    els.backdrop.addEventListener('mousemove', onAreaMouseMove);
    els.backdrop.addEventListener('mousedown', onAreaMouseDown);
    els.backdrop.addEventListener('mouseup', onAreaMouseUp);
    els.backdrop.addEventListener('contextmenu', onAreaContextMenu);
  }

  function attachWindowListeners() {
    if (windowListenersAttached) return;
    windowListenersAttached = true;
    window.addEventListener('mousemove', onWindowMouseMove, true);
    window.addEventListener('click', onWindowClick, true);
    window.addEventListener('wheel', onWindowWheel, { capture: true, passive: false });
    window.addEventListener('scroll', onWindowScroll, true);
    window.addEventListener('contextmenu', onWindowContextMenu, true);
  }

  function detachWindowListeners() {
    if (!windowListenersAttached) return;
    windowListenersAttached = false;
    window.removeEventListener('mousemove', onWindowMouseMove, true);
    window.removeEventListener('click', onWindowClick, true);
    window.removeEventListener('wheel', onWindowWheel, { capture: true });
    window.removeEventListener('scroll', onWindowScroll, true);
    window.removeEventListener('contextmenu', onWindowContextMenu, true);
  }

  function isEventInsideHost(e) {
    if (!host) return false;
    if (e.target === host) return true;
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    return path.includes(host);
  }

  function syncUIState() {
    if (!els.hud) return;

    els.backdrop.setAttribute('data-mode', state.mode);
    els.backdrop.classList.toggle('gallery-open', state.galleryOpen || state.pagePopoverOpen);

    els.modeElementBtn.classList.toggle('active', state.mode === 'element');
    els.modeAreaBtn.classList.toggle('active', state.mode === 'area');
    els.modePageBtn.classList.toggle('active', state.pagePopoverOpen);

    els.infoBtn.classList.toggle('on', state.infoEnabled);
    els.infoBtn.querySelector('span:last-child').textContent = state.infoEnabled ? t('infoOn') : t('infoOff');

    els.galleryBtn.classList.toggle('active', state.galleryOpen);
    els.gallery.classList.toggle('open', state.galleryOpen);
    els.pagePopover.classList.toggle('open', state.pagePopoverOpen);

    els.hudCount.textContent = String(state.captureCount);
    els.galleryCount.textContent = String(state.captureCount);

    if (state.galleryOpen || state.pagePopoverOpen) {
      els.highlight.classList.remove('visible');
      els.rect.classList.remove('visible');
      els.badge.classList.remove('visible');
      els.backdrop.style.cursor = 'default';
    } else {
      els.backdrop.style.cursor = state.mode === 'area' ? 'crosshair' : 'default';
    }
  }

  function setMode(mode) {
    state.mode = mode;
    chrome.storage.local.set({ techsnap_mode: mode });
    resetAreaSelection();
    unpinElement();
    state.hoveredEl = null;
    state.childStack = [];
    state.galleryOpen = false;
    state.pagePopoverOpen = false;
    els.highlight.classList.remove('visible');
    els.badge.classList.remove('visible');
    syncUIState();
  }

  function togglePagePopover(open) {
    state.pagePopoverOpen = open;
    if (open) {
      state.galleryOpen = false;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const totalH = Math.min(
        MAX_FULLPAGE_CSS_HEIGHT,
        Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, vh)
      );
      els.viewportDims.textContent = `${vw} × ${vh} px`;
      els.fullpageDims.textContent = `${vw} × ${totalH} px`;
    }
    syncUIState();
  }

  async function toggleGallery(open) {
    state.galleryOpen = open;
    if (open) {
      state.pagePopoverOpen = false;
    }
    state.confirmClear = false;
    if (els.clearAllBtn) els.clearAllBtn.textContent = t('clearAll');
    syncUIState();
    if (open) {
      await refreshGallery();
    }
  }

  async function refreshCount() {
    const res = await sendRuntimeMessage({ type: 'TECHSNAP_LIST_CAPTURES' });
    if (res?.ok && Array.isArray(res.items)) {
      state.captureCount = res.items.length;
      if (els.hudCount) els.hudCount.textContent = String(state.captureCount);
      if (els.galleryCount) els.galleryCount.textContent = String(state.captureCount);
      return res.items;
    }
    return [];
  }

  async function refreshGallery() {
    const items = await refreshCount();
    renderGallery(items);
  }

  function renderGallery(items) {
    if (!els.galleryBody) return;
    els.galleryBody.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ts-empty';
      empty.textContent = t('galleryEmpty');
      els.galleryBody.appendChild(empty);
      return;
    }

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'ts-card';

      const thumb = document.createElement('div');
      thumb.className = 'ts-card-thumb';
      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.alt = item.selector || 'Screenshot';
      thumb.appendChild(img);

      const meta = document.createElement('div');
      meta.className = 'ts-card-meta';

      const sel = document.createElement('div');
      sel.className = 'ts-card-selector';
      sel.title = item.selector || '';
      sel.textContent = item.selector || 'Área libre';

      const info = document.createElement('div');
      info.className = 'ts-card-info';
      const dimsSpan = document.createElement('span');
      dimsSpan.textContent = `${item.width} × ${item.height} px`;
      const hostSpan = document.createElement('span');
      hostSpan.textContent = item.hostname || formatTime(item.createdAt);
      info.append(dimsSpan, hostSpan);

      meta.append(sel, info);

      const actions = document.createElement('div');
      actions.className = 'ts-card-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'ts-card-btn';
      copyBtn.innerHTML = `${ICONS.copy}<span>${t('copyBtn')}</span>`;
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await copyDataUrlToClipboard(item.dataUrl);
        copyBtn.innerHTML = ok ? `<span>${t('copiedBtn')}</span>` : `<span>${t('errorBtn')}</span>`;
        setTimeout(() => { copyBtn.innerHTML = `${ICONS.copy}<span>${t('copyBtn')}</span>`; }, 1200);
      });

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'ts-card-btn';
      dlBtn.innerHTML = `${ICONS.download}<span>${t('downloadBtn')}</span>`;
      dlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDataUrl(item.dataUrl, buildFilename(item));
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ts-card-btn delete';
      delBtn.title = t('deleteBtnTitle');
      delBtn.innerHTML = ICONS.trash;
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await sendRuntimeMessage({ type: 'TECHSNAP_DELETE_CAPTURE', id: item.id });
        if (res?.ok) {
          state.captureCount = res.count ?? Math.max(0, state.captureCount - 1);
          syncUIState();
          card.remove();
          if (els.galleryBody.children.length === 0) {
            renderGallery([]);
          }
        }
      });

      actions.append(copyBtn, dlBtn, delBtn);
      card.append(thumb, meta, actions);
      els.galleryBody.appendChild(card);
    }
  }

  // --- Window-level Element Inspector (Native Scroll + Pin-to-Zoom) ---

  function onWindowMouseMove(e) {
    if (!state.active || state.isCapturingFullPage || state.galleryOpen || state.pagePopoverOpen) return;
    if (state.mode !== 'element') return;

    // When pinned, freeze hover selection so user can comfortably click the micro-bar!
    if (state.pinnedEl) return;

    if (isEventInsideHost(e)) {
      els.highlight.classList.remove('visible');
      els.badge.classList.remove('visible');
      state.hoveredEl = null;
      return;
    }

    state.lastPointer = { x: e.clientX, y: e.clientY };
    const target = findElementAt(e.clientX, e.clientY);
    if (target && target !== state.hoveredEl) {
      state.hoveredEl = target;
      state.childStack = [];
      updateElementOverlay(target);
    }
  }

  function onWindowClick(e) {
    if (!state.active || state.isCapturingFullPage) return;
    if (e.button !== 0) return;
    if (isEventInsideHost(e)) return;

    if (state.galleryOpen || state.pagePopoverOpen) {
      e.preventDefault();
      e.stopPropagation();
      toggleGallery(false);
      togglePagePopover(false);
      return;
    }

    if (state.mode !== 'element') return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation();
    }

    const clickedEl = findElementAt(e.clientX, e.clientY);

    if (!state.pinnedEl) {
      const target = state.hoveredEl || clickedEl;
      if (target) {
        pinElement(target);
      }
      return;
    }

    // Already pinned: if user clicks inside the pinned highlight area, capture immediately!
    const pinnedRect = state.pinnedEl.getBoundingClientRect();
    const insidePinned =
      e.clientX >= pinnedRect.left &&
      e.clientX <= pinnedRect.right &&
      e.clientY >= pinnedRect.top &&
      e.clientY <= pinnedRect.bottom;

    if (insidePinned) {
      const target = state.pinnedEl;
      unpinElement();
      captureElement(target);
    } else if (clickedEl) {
      // Clicked another element outside -> pin that new element instead
      state.childStack = [];
      pinElement(clickedEl);
    } else {
      unpinElement();
    }
  }

  function onWindowWheel(e) {
    if (!state.active || state.isCapturingFullPage || state.galleryOpen || state.pagePopoverOpen) return;
    if (state.mode !== 'element') return;

    // Crucial: When NOT pinned, let the page scroll completely naturally!
    if (!state.pinnedEl) return;

    if (isEventInsideHost(e)) return;

    // When pinned, wheel zooms in/out technically (Parent / Child)
    e.preventDefault();
    e.stopPropagation();

    state.wheelAccum += e.deltaY;
    if (Math.abs(state.wheelAccum) < 20) return;

    const direction = state.wheelAccum < 0 ? 'up' : 'down';
    state.wheelAccum = 0;

    if (direction === 'up') {
      zoomElementParent();
    } else {
      zoomElementChild();
    }
  }

  function onWindowScroll() {
    if (!state.active || state.isCapturingFullPage || state.galleryOpen || state.pagePopoverOpen) return;
    if (state.mode !== 'element') return;

    if (state.pinnedEl) {
      updateElementOverlay(state.pinnedEl);
    } else if (state.lastPointer.x > 0 && state.lastPointer.y > 0) {
      const target = findElementAt(state.lastPointer.x, state.lastPointer.y);
      if (target) {
        state.hoveredEl = target;
        updateElementOverlay(target);
      }
    }
  }

  function onWindowContextMenu(e) {
    if (!state.active || state.isCapturingFullPage) return;
    if (isEventInsideHost(e)) return;
    if (state.mode !== 'element') return;

    e.preventDefault();
    e.stopPropagation();

    if (state.pinnedEl) {
      unpinElement();
      return;
    }
    if (state.galleryOpen || state.pagePopoverOpen) {
      toggleGallery(false);
      togglePagePopover(false);
      return;
    }
    deactivate();
  }

  function pinElement(el) {
    state.pinnedEl = el;
    state.hoveredEl = el;
    updateElementOverlay(el);
  }

  function unpinElement() {
    state.pinnedEl = null;
    state.childStack = [];
    if (els.highlight) els.highlight.classList.remove('pinned');
    if (els.badge) els.badge.classList.remove('pinned');
    if (state.hoveredEl && document.documentElement.contains(state.hoveredEl)) {
      updateElementOverlay(state.hoveredEl);
    } else {
      if (els.highlight) els.highlight.classList.remove('visible');
      if (els.badge) els.badge.classList.remove('visible');
    }
  }

  function zoomElementParent() {
    if (!state.pinnedEl) return;
    const parent = state.pinnedEl.parentElement;
    if (parent && parent !== document.documentElement) {
      state.childStack.push(state.pinnedEl);
      state.pinnedEl = parent;
      state.hoveredEl = parent;
      updateElementOverlay(parent);
    }
  }

  function zoomElementChild() {
    if (!state.pinnedEl) return;
    if (state.childStack.length > 0) {
      const child = state.childStack.pop();
      if (child && document.documentElement.contains(child)) {
        state.pinnedEl = child;
        state.hoveredEl = child;
        updateElementOverlay(child);
      }
      return;
    }
    const visibleChild = Array.from(state.pinnedEl.children).find((c) => {
      const r = c.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (visibleChild) {
      state.pinnedEl = visibleChild;
      state.hoveredEl = visibleChild;
      updateElementOverlay(visibleChild);
    }
  }

  // --- Area Mode Backdrop Events ---

  function onAreaMouseMove(e) {
    if (state.galleryOpen || state.pagePopoverOpen || state.mode !== 'area') return;
    if ((state.areaDrawing || state.areaTwoClickArmed) && state.areaStart) {
      updateAreaRect(state.areaStart.x, state.areaStart.y, e.clientX, e.clientY);
    }
  }

  function onAreaMouseDown(e) {
    if (e.button !== 0) return;

    if (state.galleryOpen || state.pagePopoverOpen) {
      toggleGallery(false);
      togglePagePopover(false);
      return;
    }

    if (state.mode !== 'area') return;

    if (state.areaTwoClickArmed && state.areaStart) {
      updateAreaRect(state.areaStart.x, state.areaStart.y, e.clientX, e.clientY);
      const rect = { ...state.areaRect };
      resetAreaSelection();
      if (rect.width >= 6 && rect.height >= 6) {
        captureRect(rect, `${t('areaFreeLabel')} • ${location.hostname || 'local'}`, 'area');
      }
      return;
    }

    state.areaDrawing = true;
    state.dragStartTime = Date.now();
    state.areaStart = { x: e.clientX, y: e.clientY };
    updateAreaRect(e.clientX, e.clientY, e.clientX, e.clientY);
  }

  function onAreaMouseUp(e) {
    if (e.button !== 0 || state.mode !== 'area' || !state.areaDrawing || !state.areaStart) return;

    const dx = Math.abs(e.clientX - state.areaStart.x);
    const dy = Math.abs(e.clientY - state.areaStart.y);
    const elapsed = Date.now() - state.dragStartTime;

    state.areaDrawing = false;

    if (dx < 6 && dy < 6 && elapsed < 300) {
      state.areaTwoClickArmed = true;
      return;
    }

    const rect = { ...state.areaRect };
    resetAreaSelection();
    if (rect.width >= 6 && rect.height >= 6) {
      captureRect(rect, `${t('areaFreeLabel')} • ${location.hostname || 'local'}`, 'area');
    }
  }

  function onAreaContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    if (state.mode === 'area' && (state.areaDrawing || state.areaTwoClickArmed)) {
      resetAreaSelection();
      return;
    }
    if (state.galleryOpen || state.pagePopoverOpen) {
      toggleGallery(false);
      togglePagePopover(false);
      return;
    }
    deactivate();
  }

  function findElementAt(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (!el || el === host || host.contains(el)) continue;
      if (el === document.documentElement) continue;
      return el;
    }
    return null;
  }

  function getReadableSelector(el) {
    if (!el || !el.tagName) return 'element';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    let classes = '';
    if (typeof el.className === 'string' && el.className.trim()) {
      const list = el.className.trim().split(/\s+/).slice(0, 2);
      if (list.length) classes = '.' + list.join('.');
    }
    return `${tag}${id}${classes}`;
  }

  function updateElementOverlay(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      els.highlight.classList.remove('visible');
      els.badge.classList.remove('visible');
      return;
    }

    const isPinned = state.pinnedEl === el;
    els.highlight.style.top = `${rect.top}px`;
    els.highlight.style.left = `${rect.left}px`;
    els.highlight.style.width = `${rect.width}px`;
    els.highlight.style.height = `${rect.height}px`;
    els.highlight.classList.toggle('pinned', isPinned);
    els.highlight.classList.add('visible');

    els.badge.classList.toggle('pinned', isPinned);

    if (isPinned || state.infoEnabled) {
      const selector = getReadableSelector(el);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      els.badgeSelector.textContent = state.infoEnabled ? selector : t('pinnedFallbackLabel');
      els.badgeDims.textContent = `${w} × ${h} px`;
      els.badgeHint.textContent = isPinned ? t('hintWheelZoom') : t('hintClickPin');

      if (isPinned) {
        const hasParent = Boolean(el.parentElement && el.parentElement !== document.documentElement);
        const hasChild = state.childStack.length > 0 || Array.from(el.children).some((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        els.pinParentBtn.disabled = !hasParent;
        els.pinChildBtn.disabled = !hasChild;
      }

      els.badge.classList.add('visible');
      positionBadge(rect);
    } else {
      els.badge.classList.remove('visible');
    }
  }

  function updateAreaRect(x1, y1, x2, y2) {
    const left = Math.max(0, Math.min(x1, x2));
    const top = Math.max(0, Math.min(y1, y2));
    const right = Math.min(window.innerWidth, Math.max(x1, x2));
    const bottom = Math.min(window.innerHeight, Math.max(y1, y2));
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    state.areaRect = { left, top, width, height };

    els.rect.style.left = `${left}px`;
    els.rect.style.top = `${top}px`;
    els.rect.style.width = `${width}px`;
    els.rect.style.height = `${height}px`;
    els.rect.classList.add('visible');

    if (width > 4 && height > 4) {
      els.badge.classList.remove('pinned');
      els.badgeSelector.textContent = state.infoEnabled ? t('areaFreeLabel') : '';
      els.badgeDims.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
      els.badgeHint.textContent = state.areaTwoClickArmed ? t('hintClickCapture') : '';
      els.badge.classList.add('visible');
      positionBadge({ left, top, right, bottom, width, height });
    } else {
      els.badge.classList.remove('visible');
    }
  }

  function positionBadge(rect) {
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bRect = els.badge.getBoundingClientRect();
    const bw = Math.max(160, Math.ceil(bRect.width));
    const bh = Math.max(28, Math.ceil(bRect.height));
    const hudRect = els.hud.getBoundingClientRect();

    const clampLeft = (x) => Math.max(margin, Math.min(vw - bw - margin, x));
    const left = clampLeft(rect.left);

    const hitsHud = (x, y) => {
      if (!hudRect || hudRect.width === 0) return false;
      const pad = 10;
      return !(
        x + bw <= hudRect.left - pad ||
        x >= hudRect.right + pad ||
        y + bh <= hudRect.top - pad ||
        y >= hudRect.bottom + pad
      );
    };

    const fitsViewport = (y) => y >= margin && y + bh <= vh - margin;

    const candidates = [
      rect.top - bh - margin,                  // 1. Above element
      rect.bottom + margin,                    // 2. Below element
      Math.max(margin, rect.top + margin),     // 3. Inside top-left of tall element
      hudRect.top - bh - 12                    // 4. Safely above HUD
    ];

    let chosenTop = candidates.find((y) => fitsViewport(y) && !hitsHud(left, y));

    if (chosenTop === undefined) {
      chosenTop = Math.max(margin, Math.min(hudRect.top - bh - 12, vh - bh - margin));
    }

    els.badge.style.top = `${Math.round(chosenTop)}px`;
    els.badge.style.left = `${Math.round(left)}px`;
  }

  function resetAreaSelection() {
    state.areaDrawing = false;
    state.areaTwoClickArmed = false;
    state.areaStart = null;
    state.areaRect = null;
    if (els.rect) els.rect.classList.remove('visible');
    if (els.badge && !state.pinnedEl) els.badge.classList.remove('visible');
  }

  // --- Capture, Viewport, Full-Page Stitch, Stamp & Storage ---

  async function captureElement(el) {
    const r = el.getBoundingClientRect();
    const left = Math.max(0, r.left);
    const top = Math.max(0, r.top);
    const right = Math.min(window.innerWidth, r.right);
    const bottom = Math.min(window.innerHeight, r.bottom);
    const width = right - left;
    const height = bottom - top;

    if (width < 2 || height < 2) {
      showToast(t('toastOutOfView'), null, true);
      return;
    }

    const selector = getReadableSelector(el);
    await captureRect({ left, top, width, height }, selector, 'element');
  }

  async function captureViewport() {
    const rect = {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight
    };
    const selector = `${t('viewportLabel')} • ${location.hostname || 'local'}`;
    await captureRect(rect, selector, 'viewport');
  }

  async function captureFullPage() {
    if (state.isCapturingFullPage) return;
    state.isCapturingFullPage = true;
    unpinElement();

    const origX = window.scrollX;
    const origY = window.scrollY;
    const origScrollBehavior = document.documentElement.style.scrollBehavior;
    const hiddenStickyEls = [];

    try {
      document.documentElement.style.scrollBehavior = 'auto';

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rawTotalHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight || 0,
        vh
      );
      const totalHeight = Math.min(MAX_FULLPAGE_CSS_HEIGHT, rawTotalHeight);
      const wasCapped = rawTotalHeight > MAX_FULLPAGE_CSS_HEIGHT;

      showToast(t('toastCapturingFullpage', [String(vw), String(totalHeight)]));

      // Hide HUD completely during scroll & stitch
      host.setAttribute('data-capturing', 'true');
      await waitTwoFrames();

      const steps = [];
      for (let y = 0; y < totalHeight; y += vh) {
        steps.push(Math.min(y, Math.max(0, totalHeight - vh)));
      }
      // Deduplicate final step if exact multiple
      const uniqueSteps = [...new Set(steps)];

      let masterCanvas = null;
      let masterCtx = null;
      let scaleX = window.devicePixelRatio || 1;
      let scaleY = window.devicePixelRatio || 1;

      for (let i = 0; i < uniqueSteps.length; i++) {
        const targetY = uniqueSteps[i];
        window.scrollTo(0, targetY);
        await waitTwoFrames();
        await sleep(i === 0 ? 60 : CAPTURE_QUOTA_DELAY_MS);

        const capRes = await sendRuntimeMessage({ type: 'TECHSNAP_CAPTURE_TAB' });
        if (!capRes?.ok || !capRes.dataUrl) {
          throw new Error(capRes?.error || 'Error capturando tramo de página');
        }

        const sliceImg = await loadImage(capRes.dataUrl);
        if (i === 0) {
          scaleX = sliceImg.naturalWidth / vw;
          scaleY = sliceImg.naturalHeight / vh;
          masterCanvas = document.createElement('canvas');
          masterCanvas.width = Math.round(vw * scaleX);
          masterCanvas.height = Math.round(totalHeight * scaleY);
          masterCtx = masterCanvas.getContext('2d');
        }

        const actualScrollY = window.scrollY;
        const destY = Math.round(actualScrollY * scaleY);
        const remainingPx = Math.max(0, masterCanvas.height - destY);
        const drawH = Math.min(sliceImg.naturalHeight, remainingPx);

        if (drawH > 0) {
          masterCtx.drawImage(
            sliceImg,
            0, 0, sliceImg.naturalWidth, drawH,
            0, destY, masterCanvas.width, drawH
          );
        }

        // After capturing top slice (y = 0), temporarily hide fixed/sticky headers so they don't repeat down the page
        if (i === 0 && uniqueSteps.length > 1) {
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (el === host || host.contains(el)) continue;
            const pos = getComputedStyle(el).position;
            if (pos === 'fixed' || pos === 'sticky') {
              hiddenStickyEls.push({ el, visibility: el.style.visibility });
              el.style.visibility = 'hidden';
            }
          }
        }
      }

      // Restore fixed/sticky elements and original scroll
      for (const entry of hiddenStickyEls) {
        entry.el.style.visibility = entry.visibility;
      }
      window.scrollTo(origX, origY);
      document.documentElement.style.scrollBehavior = origScrollBehavior;
      host.removeAttribute('data-capturing');

      const selector = `${t('fullpageLabel')} • ${location.hostname || 'local'}`;
      const finalCanvas = state.infoEnabled
        ? stampFooterOnCanvas(masterCanvas, selector, vw, totalHeight, scaleX, scaleY)
        : masterCanvas;

      const finalDataUrl = finalCanvas.toDataURL('image/png');
      const copied = await copyDataUrlToClipboard(finalDataUrl);

      const saveRes = await sendRuntimeMessage({
        type: 'TECHSNAP_SAVE_CAPTURE',
        payload: {
          dataUrl: finalDataUrl,
          selector,
          width: vw,
          height: totalHeight,
          mode: 'fullpage',
          infoEnabled: state.infoEnabled,
          pageUrl: location.href,
          hostname: location.hostname || 'local'
        }
      });

      if (saveRes?.ok) {
        state.captureCount = saveRes.count ?? state.captureCount + 1;
        syncUIState();
      }

      const capNote = wasCapped ? t('toastCappedNote', [String(MAX_FULLPAGE_CSS_HEIGHT)]) : '';
      showToast(
        copied
          ? t('toastFullpageCopied', [capNote])
          : t('toastFullpageSaved', [capNote]),
        finalDataUrl,
        false
      );
    } catch (err) {
      for (const entry of hiddenStickyEls) {
        entry.el.style.visibility = entry.visibility;
      }
      window.scrollTo(origX, origY);
      document.documentElement.style.scrollBehavior = origScrollBehavior;
      host.removeAttribute('data-capturing');
      showToast(t('toastFullpageError', [err?.message || String(err)]), null, true);
    } finally {
      state.isCapturingFullPage = false;
    }
  }

  async function captureRect(rect, selector, mode) {
    try {
      host.setAttribute('data-capturing', 'true');
      await waitTwoFrames();
      await sleep(35);

      const capRes = await sendRuntimeMessage({ type: 'TECHSNAP_CAPTURE_TAB' });
      host.removeAttribute('data-capturing');

      if (!capRes?.ok || !capRes.dataUrl) {
        showToast(capRes?.error || t('toastCaptureFail'), null, true);
        return;
      }

      const finalDataUrl = await cropAndStamp(capRes.dataUrl, rect, selector, state.infoEnabled);
      const copied = await copyDataUrlToClipboard(finalDataUrl);

      const saveRes = await sendRuntimeMessage({
        type: 'TECHSNAP_SAVE_CAPTURE',
        payload: {
          dataUrl: finalDataUrl,
          selector,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          mode,
          infoEnabled: state.infoEnabled,
          pageUrl: location.href,
          hostname: location.hostname || 'local'
        }
      });

      if (saveRes?.ok) {
        state.captureCount = saveRes.count ?? state.captureCount + 1;
        syncUIState();
      }

      showToast(
        copied ? t('toastCopiedSaved') : t('toastSavedOnly'),
        finalDataUrl,
        false
      );
    } catch (err) {
      host.removeAttribute('data-capturing');
      showToast(t('toastErrorCapture', [err?.message || String(err)]), null, true);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen capturada'));
      img.src = src;
    });
  }

  async function cropAndStamp(tabDataUrl, rect, selector, includeInfo) {
    const img = await loadImage(tabDataUrl);
    const scaleX = img.naturalWidth / window.innerWidth;
    const scaleY = img.naturalHeight / window.innerHeight;

    const sx = Math.max(0, Math.round(rect.left * scaleX));
    const sy = Math.max(0, Math.round(rect.top * scaleY));
    const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(rect.width * scaleX)));
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(rect.height * scaleY)));

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = sw;
    baseCanvas.height = sh;
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    if (!includeInfo) {
      return baseCanvas.toDataURL('image/png');
    }

    const outCanvas = stampFooterOnCanvas(
      baseCanvas,
      selector,
      Math.round(rect.width),
      Math.round(rect.height),
      scaleX,
      scaleY
    );
    return outCanvas.toDataURL('image/png');
  }

  function stampFooterOnCanvas(sourceCanvas, selector, cssWidth, cssHeight, scaleX, scaleY) {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    const minWidthPx = Math.round(280 * scaleX);
    const outWidth = Math.max(sw, minWidthPx);
    const footerHeight = Math.round(32 * scaleY);
    const padX = Math.round((outWidth - sw) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = sh + footerHeight;
    const ctx = canvas.getContext('2d');

    if (outWidth > sw) {
      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, outWidth, sh);
    }

    ctx.drawImage(sourceCanvas, padX, 0);

    // Footer bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, sh, outWidth, footerHeight);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, sh, outWidth, Math.max(1, Math.round(scaleY)));

    const fontSize = Math.max(11, Math.round(12 * scaleY));
    const textPad = Math.round(10 * scaleX);
    const dimsText = `${cssWidth} × ${cssHeight} px`;

    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'middle';
    const textY = sh + footerHeight / 2;

    ctx.fillStyle = '#cbd5e1';
    const dimsWidth = ctx.measureText(dimsText).width;
    ctx.fillText(dimsText, outWidth - textPad - dimsWidth, textY);

    const maxSelWidth = outWidth - textPad * 3 - dimsWidth;
    let selText = selector;
    while (ctx.measureText(selText).width > maxSelWidth && selText.length > 4) {
      selText = selText.slice(0, -2) + '…';
    }
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(selText, textPad, textY);

    return canvas;
  }

  async function copyDataUrlToClipboard(dataUrl) {
    try {
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch {
      return false;
    }
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function buildFilename(item) {
    const cleanSel = (item.selector || 'captura')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    return `techsnap-${cleanSel || 'img'}-${item.width}x${item.height}.png`;
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function showToast(message, thumbUrl = null, isError = false) {
    if (!els.toast) return;
    clearTimeout(toastTimer);
    els.toastMsg.textContent = message;
    els.toast.classList.toggle('error', isError);
    if (thumbUrl) {
      els.toastThumb.src = thumbUrl;
      els.toastThumb.style.display = 'block';
    } else {
      els.toastThumb.style.display = 'none';
    }
    els.toast.classList.add('visible');
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('visible');
    }, 2800);
  }

  function waitTwoFrames() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    });
  }

  // --- Lifecycle ---

  async function activate() {
    ensureUI();
    state.active = true;
    state.galleryOpen = false;
    state.pagePopoverOpen = false;
    unpinElement();
    host.style.display = 'block';
    attachWindowListeners();
    syncUIState();
    await refreshCount();
  }

  function deactivate() {
    state.active = false;
    state.galleryOpen = false;
    state.pagePopoverOpen = false;
    state.hoveredEl = null;
    unpinElement();
    resetAreaSelection();
    detachWindowListeners();
    if (host) {
      host.style.display = 'none';
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TECHSNAP_TOGGLE') {
      if (state.active) {
        deactivate();
      } else {
        activate();
      }
      sendResponse({ ok: true, active: state.active });
      return true;
    }
    return false;
  });
})();
