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

chrome.runtime.onInstalled.addListener(syncDynamicScripts);
chrome.runtime.onStartup.addListener(syncDynamicScripts);
chrome.permissions.onAdded.addListener(syncDynamicScripts);
chrome.permissions.onRemoved.addListener(syncDynamicScripts);

// The content script sends file bytes as base64 because chrome.runtime.sendMessage
// serializes messages as JSON (ArrayBuffers/Blobs would arrive as `{}`).
function base64ToBlob(b64, type) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

async function uploadToCatbox(blob, fileName) {
  if (blob.size === 0) throw new Error('File is empty');

  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', blob, fileName);

  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  const text = (await res.text()).trim();

  if (!res.ok || !text.startsWith('http')) {
    throw new Error(text || `Upload failed (HTTP ${res.status})`);
  }
  return text;
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
        sendResponse({ success: true, url: await uploadToCatbox(blob, message.fileName) });
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
            const url = await uploadToCatbox(
              base64ToBlob(image.dataB64, 'image/jpeg'),
              `${baseName}-p${n}.jpg`
            );
            uploaded += image.bytes;
            port.postMessage({ type: 'link', page: n, url });
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
