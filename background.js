// Limits that bound a conversion run. Mirrored in content.js for UI copy.
const MAX_CONVERT_PAGES = 10;
const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;
const UPLOAD_SPACING_MS = 300;

// --- Optional "all sites" access -------------------------------------------
// The extension ships with a short, purpose-tied list of chat sites in the
// manifest. Everything beyond that is opt-in: the user grants *://*/* from the
// popup, and only then do we register a content script for it.
const CONTENT_FILES = ['styles.js', 'content.js'];
const ALL_SITES_ID = 'xtrachat-all-sites';

async function syncDynamicScripts() {
  try {
    const granted = await chrome.permissions.contains({ origins: ['*://*/*'] });
    let existing = [];
    try {
      existing = await chrome.scripting.getRegisteredContentScripts({ ids: [ALL_SITES_ID] });
    } catch (e) { /* nothing registered yet */ }

    if (granted && existing.length === 0) {
      await chrome.scripting.registerContentScripts([{
        id: ALL_SITES_ID,
        matches: ['*://*/*'],
        js: CONTENT_FILES,
        runAt: 'document_idle',
        persistAcrossSessions: true
      }]);
    } else if (!granted && existing.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: [ALL_SITES_ID] });
    }
  } catch (e) {
    console.warn('XtraChat: could not sync dynamic scripts:', e.message);
  }
}

// Granting access mid-session leaves already-open tabs without the content script.
// Inject it so the button appears immediately instead of after a reload.
async function injectIntoOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        // content.js is guarded against double-injection, so the sites already
        // covered by the manifest are harmless here.
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
      } catch (e) { /* restricted page (web store, chrome://, PDF viewer) */ }
    }
  } catch (e) {
    console.warn('XtraChat: could not inject into open tabs:', e.message);
  }
}

chrome.runtime.onInstalled.addListener(async details => {
  await syncDynamicScripts();
  // Offer "every site" as a single click, rather than demanding broad access
  // up front at install time.
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

chrome.runtime.onStartup.addListener(syncDynamicScripts);
chrome.permissions.onRemoved.addListener(syncDynamicScripts);
chrome.permissions.onAdded.addListener(async perms => {
  await syncDynamicScripts();
  if (perms && perms.origins && perms.origins.length) await injectIntoOpenTabs();
});

// The content script sends file bytes as base64 because chrome.runtime.sendMessage
// serializes messages as JSON (ArrayBuffers/Blobs would arrive as `{}`).
function base64ToBlob(b64, type) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

// MV3 service workers are terminated after ~30s of inactivity, and an in-flight
// fetch() does NOT reset that timer — a slow upload would be killed mid-flight
// and the caller would just hang. Calling an extension API on a timer does reset
// it. (The PDF path survived this only because its open port kept the worker up.)
let keepaliveTimer = null;
let keepaliveHolders = 0;

function startKeepalive() {
  keepaliveHolders++;
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000);
}

function stopKeepalive() {
  keepaliveHolders = Math.max(0, keepaliveHolders - 1);
  if (keepaliveHolders === 0 && keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

// --- Hosts and speed-based routing -----------------------------------------
// Upload speed to these hosts varies enormously by network and by day (catbox
// measured 11 KB/s on one connection where uguu managed 198 KB/s). Rather than
// hard-coding a winner, measure every upload and send the next one to whichever
// host has actually been fastest for this user.
const HOSTS = {
  uguu: {
    id: 'uguu',
    label: 'uguu.se',
    retention: 'expires in ~3 hours',
    permanent: false,
    maxBytes: 128 * 1024 * 1024,
    endpoint: 'https://uguu.se/upload?output=text',
    build(blob, name) {
      const f = new FormData();
      f.append('files[]', blob, name);
      return f;
    }
  },
  catbox: {
    id: 'catbox',
    label: 'catbox.moe',
    retention: 'permanent',
    permanent: true,
    maxBytes: 200 * 1024 * 1024,
    endpoint: 'https://catbox.moe/user/api.php',
    build(blob, name) {
      const f = new FormData();
      f.append('reqtype', 'fileupload');
      f.append('fileToUpload', blob, name);
      return f;
    }
  }
};

const STATS_KEY = 'hostStats';
const STAT_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // networks change; forget stale samples
const FAIL_COOLDOWN_MS = 10 * 60 * 1000;
const PROBE_MAX_BYTES = 512 * 1024;           // only probe an unknown host cheaply

async function getStats() {
  const data = await chrome.storage.local.get({ [STATS_KEY]: {} });
  return data[STATS_KEY] || {};
}

async function updateStat(id, patch) {
  const stats = await getStats();
  stats[id] = Object.assign({}, stats[id], patch);
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

async function recordSpeed(id, kbps) {
  const stats = await getStats();
  const prev = stats[id] && stats[id].kbps;
  // Exponential moving average, so one bad run doesn't blacklist a host.
  const kbpsAvg = prev ? (prev * 0.5 + kbps * 0.5) : kbps;
  await updateStat(id, { kbps: Math.round(kbpsAvg * 10) / 10, lastAt: Date.now(), failAt: 0 });
}

/**
 * Order hosts best-first. An unmeasured host is tried first only when the file
 * is small, so learning its speed costs the user a few seconds, not minutes.
 */
async function routeOrder(sizeBytes) {
  const stats = await getStats();
  const now = Date.now();

  const candidates = Object.keys(HOSTS)
    .filter(id => sizeBytes <= HOSTS[id].maxBytes)
    .map(id => {
      const s = stats[id] || {};
      const fresh = s.lastAt && (now - s.lastAt) < STAT_TTL_MS;
      return {
        id,
        kbps: fresh ? (s.kbps || 0) : 0,
        known: !!fresh,
        cooling: s.failAt ? (now - s.failAt) < FAIL_COOLDOWN_MS : false
      };
    });

  candidates.sort((a, b) => {
    // A host that just failed goes last, but is still kept as a fallback —
    // dropping it entirely would leave nothing to fail over to.
    if (a.cooling !== b.cooling) return a.cooling ? 1 : -1;
    if (a.known !== b.known) {
      // Probe an unknown host only if this upload is small enough to be cheap.
      if (sizeBytes <= PROBE_MAX_BYTES) return a.known ? 1 : -1;
      return a.known ? -1 : 1;
    }
    return b.kbps - a.kbps;
  });

  return candidates.map(c => c.id);
}

async function uploadToHost(host, blob, fileName) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  startKeepalive();

  try {
    const res = await fetch(host.endpoint, {
      method: 'POST',
      body: host.build(blob, fileName),
      signal: controller.signal
    });
    const text = (await res.text()).trim();

    if (!res.ok || !text.startsWith('http')) {
      throw new Error(text.slice(0, 140) || `HTTP ${res.status}`);
    }
    return text;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`);
    }
    if (e instanceof TypeError) throw new Error('could not be reached');
    throw e;
  } finally {
    clearTimeout(timer);
    stopKeepalive();
  }
}

/**
 * Upload, measuring throughput and falling back to the next host on failure.
 * Returns { url, host: {label, retention, permanent}, kbps }.
 */
async function upload(blob, fileName) {
  if (blob.size === 0) throw new Error('File is empty');

  const order = await routeOrder(blob.size);
  if (!order.length) throw new Error('File is too large for any available host');

  const errors = [];
  for (const id of order) {
    const host = HOSTS[id];
    const started = Date.now();
    try {
      const url = await uploadToHost(host, blob, fileName);
      const secs = Math.max(0.001, (Date.now() - started) / 1000);
      const kbps = (blob.size / 1024) / secs;
      await recordSpeed(id, kbps);
      return {
        url,
        host: { label: host.label, retention: host.retention, permanent: host.permanent },
        kbps: Math.round(kbps)
      };
    } catch (e) {
      errors.push(`${host.label}: ${e.message}`);
      await updateStat(id, { failAt: Date.now() });
    }
  }

  throw new Error(errors.join(' | '));
}

// --- Offscreen document lifecycle -----------------------------------------
// PDF.js needs canvas + document, so rendering happens in an offscreen page.
let creating = null;

async function ensureOffscreen() {
  if (!chrome.offscreen) throw new Error('This Chrome version does not support PDF conversion');

  // getContexts is Chrome 116+; on older builds fall through and let a duplicate
  // createDocument call reject, which we swallow below.
  if (chrome.runtime.getContexts) {
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (existing.length > 0) return;
  }

  if (creating) {
    await creating;
    return;
  }
  creating = chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Render scanned PDF pages to images with PDF.js'
  });
  try {
    await creating;
  } catch (e) {
    // "Only a single offscreen document may be created" means one already exists.
    if (!/single offscreen/i.test(e.message)) throw e;
  } finally {
    creating = null;
  }
}

function askOffscreen(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ target: 'offscreen', ...payload }, resp => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!resp) return reject(new Error('No response from PDF renderer'));
      if (!resp.success) {
        const err = new Error(resp.error || 'PDF error');
        err.name = resp.name;
        return reject(err);
      }
      resolve(resp);
    });
  });
}

// --- Simple single-file upload (non-PDF, or PDF kept as-is) ---------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'upload') {
    (async () => {
      try {
        if (!message.dataB64) throw new Error('No file data received');
        const blob = base64ToBlob(message.dataB64, message.fileType);
        const result = await upload(blob, message.fileName);
        sendResponse({ success: true, url: result.url, host: result.host, kbps: result.kbps });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();

    // indicate async response
    return true;
  }
});

// --- Conversion run, driven over a port ------------------------------------
// A port (opened by the content script) is used instead of chrome.tabs.sendMessage,
// which would require host permission for the page's own URL.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'fu-convert') return;

  let cancelled = false;
  let pdfB64 = null;
  let baseName = 'page';

  port.onDisconnect.addListener(() => { cancelled = true; });

  port.onMessage.addListener(async msg => {
    try {
      if (msg.type === 'analyze') {
        pdfB64 = msg.dataB64;
        baseName = (msg.fileName || 'page').replace(/\.pdf$/i, '');
        await ensureOffscreen();
        const info = await askOffscreen({ type: 'analyze', dataB64: pdfB64 });
        port.postMessage({ type: 'analyzed', pageCount: info.pageCount, isScanned: info.isScanned });
        return;
      }

      if (msg.type === 'cancel') {
        cancelled = true;
        return;
      }

      if (msg.type === 'convert') {
        const total = Math.min(msg.pageCount, MAX_CONVERT_PAGES);
        let uploaded = 0;
        const failures = [];

        for (let n = 1; n <= total; n++) {
          if (cancelled) break;

          port.postMessage({ type: 'progress', phase: 'render', page: n, total });
          let image;
          try {
            image = await askOffscreen({ type: 'renderPage', pageNum: n });
          } catch (e) {
            failures.push(n);
            continue;
          }

          if (uploaded + image.bytes > MAX_TOTAL_UPLOAD_BYTES) {
            port.postMessage({ type: 'budget', page: n });
            break;
          }
          if (cancelled) break;

          port.postMessage({ type: 'progress', phase: 'upload', page: n, total });
          try {
            const result = await upload(
              base64ToBlob(image.dataB64, 'image/jpeg'),
              `${baseName}-p${n}.jpg`
            );
            uploaded += image.bytes;
            port.postMessage({ type: 'link', page: n, url: result.url, host: result.host });
          } catch (e) {
            failures.push(n);
          }

          if (n < total) await new Promise(r => setTimeout(r, UPLOAD_SPACING_MS));
        }

        try { await askOffscreen({ type: 'release' }); } catch (e) { /* best effort */ }
        port.postMessage({ type: 'done', cancelled, failures });
        return;
      }
    } catch (e) {
      port.postMessage({ type: 'error', error: e.message, name: e.name });
    }
  });
});
