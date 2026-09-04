import * as pdfjsLib from './vendor/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdf.worker.min.mjs');

// --- Limits (mirrored in content.js for the UI copy) -----------------------
const SAMPLE_PAGES = 3;          // pages inspected when classifying
const MIN_CHARS_PER_PAGE = 50;   // fewer than this on average => scanned
const TARGET_MAX_DIM = 2000;     // px, longest side of a rendered page
const MAX_SCALE = 3;
const JPEG_QUALITY = 0.85;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const RETRY_MAX_DIM = 1400;
const RETRY_QUALITY = 0.70;

// One parsed document is kept between analyze and the render calls that follow,
// so a multi-page PDF is only parsed once.
let doc = null;

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('encode failed'));
    reader.readAsDataURL(blob);
  });
}

async function closeDoc() {
  if (doc) {
    try { await doc.destroy(); } catch (e) { /* already gone */ }
    doc = null;
  }
}

/**
 * Parse the PDF and decide whether it is a scan (no usable text layer).
 * Returns { pageCount, isScanned }.
 */
async function analyze(dataB64) {
  await closeDoc();
  doc = await pdfjsLib.getDocument({ data: base64ToBytes(dataB64) }).promise;

  const sampled = Math.min(SAMPLE_PAGES, doc.numPages);
  let chars = 0;
  for (let i = 1; i <= sampled; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    chars += content.items.map(it => it.str).join('').replace(/\s/g, '').length;
    page.cleanup();
  }

  return {
    pageCount: doc.numPages,
    isScanned: (chars / sampled) < MIN_CHARS_PER_PAGE
  };
}

async function encode(canvas, quality) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('canvas encode failed');
  return blob;
}

/**
 * Render one page to a JPEG. Falls back to a smaller/rougher encode if the
 * first attempt busts MAX_IMAGE_BYTES.
 */
async function renderPage(pageNum) {
  if (!doc) throw new Error('No PDF loaded');

  const page = await doc.getPage(pageNum);

  async function draw(maxDim, quality) {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(maxDim / Math.max(base.width, base.height), MAX_SCALE);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    // Scanned pages often have transparent backgrounds; JPEG has no alpha, so
    // paint white first or the text lands on black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await encode(canvas, quality);
    canvas.width = canvas.height = 0; // release backing store
    return blob;
  }

  let blob = await draw(TARGET_MAX_DIM, JPEG_QUALITY);
  if (blob.size > MAX_IMAGE_BYTES) {
    blob = await draw(RETRY_MAX_DIM, RETRY_QUALITY);
  }
  page.cleanup();

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error(`page ${pageNum} still ${Math.round(blob.size / 1024 / 1024)}MB after downscale`);
  }

  return { dataB64: await blobToBase64(blob), bytes: blob.size };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return;

  (async () => {
    try {
      if (message.type === 'analyze') {
        sendResponse({ success: true, ...(await analyze(message.dataB64)) });
      } else if (message.type === 'renderPage') {
        sendResponse({ success: true, ...(await renderPage(message.pageNum)) });
      } else if (message.type === 'release') {
        await closeDoc();
        sendResponse({ success: true });
      }
    } catch (e) {
      // PDF.js throws a named PasswordException for encrypted files.
      sendResponse({ success: false, error: e.message, name: e.name });
    }
  })();

  return true;
});
