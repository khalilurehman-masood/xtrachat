(function () {
  if (window.__xtrachatInjected) return;
  window.__xtrachatInjected = true;

  const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];
  const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
  const MAX_CONVERT_PAGES = 10;      // mirrors background.js
  const HANDLE_MARGIN = 20;
  const DROP_PROMPT = 'Drop a PDF or image here, or tap to browse';
  const TOUCH = window.matchMedia('(pointer: coarse)').matches;

  let host = null;   // the element in the page
  let root = null;   // its shadow root
  let dragging = false;
  let moved = false;
  let offsetX = 0, offsetY = 0, startX = 0, startY = 0;

  function extOf(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.ceil(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // chrome.runtime.sendMessage serializes as JSON, so raw ArrayBuffers/Blobs do not
  // survive the trip to the service worker. Base64 does.
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.slice(result.indexOf(',') + 1));
      };
      reader.onerror = () => reject(reader.error || new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }

  const UPLOAD_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 16V4M12 4L7 9M12 4L17 9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 16V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const COPY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
      <path d="M5 15H4C3.44772 15 3 14.5523 3 14V4C3 3.44772 3.44772 3 4 3H14C14.5523 3 15 3.44772 15 4V5" stroke="currentColor" stroke-width="2"/>
    </svg>`;

  function build() {
    // Shadow DOM: page CSS cannot reach in, and our CSS cannot reach out.
    host = document.createElement('div');
    host.id = 'xtrachat-root';
    root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = FU_CSS;
    root.appendChild(style);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="fu-handle" title="XtraChat — upload a file">${UPLOAD_ICON}</div>
      <div id="fu-panel" class="hidden">
        <div id="fu-drop"><span id="fu-drop-label">${DROP_PROMPT}</span></div>
        <div id="fu-hint">PDFs and images only &middot; max ${formatSize(MAX_SIZE)}</div>
        <input id="fu-file" type="file" accept="${ALLOWED_EXT.map(e => '.' + e).join(',')}" />
        <input id="fu-camera" type="file" accept="image/*" capture="environment" />
        <div id="fu-actions">
          <button id="fu-upload">Choose file</button>
          ${TOUCH ? '<button id="fu-shoot" class="fu-secondary">Camera</button>' : ''}
        </div>
        <div id="fu-consent" class="hidden">
          <div id="fu-consent-text">
            Files are uploaded to <b>catbox.moe</b>, a free public host. Anyone with the
            link can open the file, and anonymous uploads cannot be deleted afterwards.
            Don't upload anything private.
          </div>
          <button id="fu-consent-ok">I understand — continue</button>
          <button id="fu-consent-no" class="fu-secondary">Cancel</button>
        </div>
        <div id="fu-confirm" class="hidden">
          <div id="fu-confirm-text"></div>
          <button id="fu-convert">Convert to images</button>
          <button id="fu-asis" class="fu-secondary">Upload PDF as-is</button>
          <button id="fu-abort" class="fu-secondary">Cancel</button>
        </div>
        <div id="fu-status"></div>
        <button id="fu-cancel" class="fu-secondary hidden">Cancel</button>
        <div id="fu-links" class="hidden"></div>
        <button id="fu-copyall" class="hidden">Copy all links</button>
      </div>
    `;
    while (wrap.firstChild) root.appendChild(wrap.firstChild);

    // Page stylesheets that match the host element beat our :host rules, so the
    // properties that must not be overridden are set inline with !important.
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    host.style.setProperty('display', 'block', 'important');

    document.documentElement.appendChild(host);
    applyPosition();
    wire();
  }

  function applyPosition(pos) {
    const set = (prop, value) => host.style.setProperty(prop, value, 'important');
    if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
      set('left', pos.left + 'px');
      set('top', pos.top + 'px');
      host.style.removeProperty('right');
      host.style.removeProperty('bottom');
    } else {
      set('right', HANDLE_MARGIN + 'px');
      set('bottom', HANDLE_MARGIN + 'px');
      host.style.removeProperty('left');
      host.style.removeProperty('top');
    }
  }

  // A position saved on a wide window would otherwise strand the icon off-screen
  // on a narrow one (or after a phone rotates).
  function clampIntoView() {
    if (!host) return;
    const handle = root.getElementById('fu-handle');
    if (!handle) return;
    const rect = handle.getBoundingClientRect();
    if (!rect.width) return;

    const maxLeft = Math.max(0, window.innerWidth - rect.width - 4);
    const maxTop = Math.max(0, window.innerHeight - rect.height - 4);
    const left = Math.min(Math.max(rect.left, 4), maxLeft);
    const top = Math.min(Math.max(rect.top, 4), maxTop);

    if (left !== rect.left || top !== rect.top) applyPosition({ left, top });
  }

  function savePosition() {
    const handle = root.getElementById('fu-handle');
    const rect = handle.getBoundingClientRect();
    chrome.storage.local.set({ fuPosition: { left: rect.left, top: rect.top } });
  }

  function wire() {
    const $ = id => root.getElementById(id);
    const handle = $('fu-handle');
    const panel = $('fu-panel');
    const uploadBtn = $('fu-upload');
    const shootBtn = $('fu-shoot');
    const fileInput = $('fu-file');
    const cameraInput = $('fu-camera');
    const status = $('fu-status');
    const linksDiv = $('fu-links');
    const copyAllBtn = $('fu-copyall');
    const cancelBtn = $('fu-cancel');
    const consentDiv = $('fu-consent');
    const consentOk = $('fu-consent-ok');
    const consentNo = $('fu-consent-no');
    const confirmDiv = $('fu-confirm');
    const confirmText = $('fu-confirm-text');
    const convertBtn = $('fu-convert');
    const asIsBtn = $('fu-asis');
    const abortBtn = $('fu-abort');
    const dropZone = $('fu-drop');
    const dropLabel = $('fu-drop-label');
    const actions = $('fu-actions');

    let selectedFile = null;
    let pendingB64 = null;
    let port = null;
    let links = [];

    // --- drag -------------------------------------------------------------
    function startDrag(clientX, clientY) {
      dragging = true;
      moved = false;
      startX = clientX;
      startY = clientY;
      const rect = handle.getBoundingClientRect();
      offsetX = clientX - rect.left;
      offsetY = clientY - rect.top;
    }

    function moveDrag(clientX, clientY) {
      if (!dragging) return;
      if (Math.abs(clientX - startX) > 5 || Math.abs(clientY - startY) > 5) moved = true;
      applyPosition({ left: clientX - offsetX, top: clientY - offsetY });
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = 'grab';
      if (moved) { clampIntoView(); savePosition(); }
    }

    handle.addEventListener('mousedown', e => {
      startDrag(e.clientX, e.clientY);
      handle.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    document.addEventListener('mouseup', endDrag);

    // Touch events stay on the handle for the whole gesture, so listening here
    // (rather than on document) avoids a non-passive document listener that
    // would slow scrolling on every page.
    handle.addEventListener('touchstart', e => {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
    }, { passive: true });
    handle.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();          // needs passive:false, or the page scrolls
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive: false });
    handle.addEventListener('touchend', endDrag);
    handle.addEventListener('touchcancel', endDrag);

    window.addEventListener('resize', clampIntoView);
    window.addEventListener('orientationchange', clampIntoView);

    // Open the panel on whichever side has room.
    function placePanel() {
      const rect = handle.getBoundingClientRect();
      panel.classList.toggle('fu-above', rect.bottom + 320 > window.innerHeight);
      panel.classList.toggle('fu-right', rect.left + 300 > window.innerWidth);
    }

    handle.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      placePanel();
      panel.classList.toggle('hidden');
    });

    // --- selection --------------------------------------------------------
    function validate(file) {
      const ext = extOf(file.name);
      if (!ALLOWED_EXT.includes(ext)) return `File type ".${ext}" isn't allowed`;
      if (file.size > MAX_SIZE) return `File is too large (max ${formatSize(MAX_SIZE)})`;
      return null;
    }

    function clearSelection() {
      selectedFile = null;
      pendingB64 = null;
      fileInput.value = '';
      cameraInput.value = '';
      dropLabel.textContent = DROP_PROMPT;
      uploadBtn.textContent = 'Choose file';
    }

    function selectFile(file) {
      const err = validate(file);
      if (err) { clearSelection(); status.textContent = err; return; }
      selectedFile = file;
      dropLabel.textContent = `${file.name} (${formatSize(file.size)})`;
      uploadBtn.textContent = 'Upload';
      status.textContent = '';
      resetResults();
    }

    // After the extension is reloaded, content scripts already running in open tabs
    // are orphaned: chrome.* calls throw "Extension context invalidated".
    function contextAlive() {
      try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; }
    }

    function openPicker(input) {
      if (!contextAlive()) {
        status.textContent = 'Extension was updated — refresh this page first';
        return;
      }
      try {
        input.click();
      } catch (e) {
        status.textContent = 'Could not open picker: ' + e.message;
      }
    }

    dropZone.addEventListener('click', () => openPicker(fileInput));
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) selectFile(fileInput.files[0]);
    });
    cameraInput.addEventListener('change', () => {
      if (cameraInput.files[0]) selectFile(cameraInput.files[0]);
    });
    if (shootBtn) shootBtn.addEventListener('click', () => openPicker(cameraInput));

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('fu-dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('fu-dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('fu-dragover');
      const file = e.dataTransfer.files[0];
      if (file) selectFile(file);
    });

    // --- results ----------------------------------------------------------
    function resetResults() {
      links = [];
      linksDiv.innerHTML = '';
      linksDiv.classList.add('hidden');
      copyAllBtn.classList.add('hidden');
    }

    function copyText(text, okMsg) {
      navigator.clipboard.writeText(text)
        .then(() => { status.textContent = okMsg; })
        .catch(() => { status.textContent = 'Copy failed'; });
    }

    function addLink(url, label) {
      links.push(url);
      const row = document.createElement('div');
      row.className = 'fu-link-row';
      const input = document.createElement('input');
      input.readOnly = true;
      input.value = url;
      input.title = label || url;
      const btn = document.createElement('button');
      btn.className = 'fu-copy-btn';
      btn.title = 'Copy link';
      btn.innerHTML = COPY_ICON;
      btn.addEventListener('click', () => copyText(url, 'Copied' + (label ? ' ' + label : '')));
      row.appendChild(input);
      row.appendChild(btn);
      linksDiv.appendChild(row);
      linksDiv.classList.remove('hidden');
      copyAllBtn.classList.toggle('hidden', links.length < 2);
    }

    copyAllBtn.addEventListener('click', () => copyText(links.join('\n'), `Copied ${links.length} links`));

    // --- upload -----------------------------------------------------------
    function setBusy(busy) {
      handle.classList.toggle('fu-busy', busy);
      uploadBtn.disabled = busy;
    }

    function showConfirm(show) {
      confirmDiv.classList.toggle('hidden', !show);
      actions.classList.toggle('hidden', show);
    }

    function closePort() {
      if (port) {
        try { port.disconnect(); } catch (e) { /* already gone */ }
        port = null;
      }
    }

    function simpleUpload(fileName, fileType, dataB64) {
      status.textContent = 'Uploading...';
      setBusy(true);
      chrome.runtime.sendMessage({ action: 'upload', fileName, fileType, dataB64 }, resp => {
        setBusy(false);
        if (!resp) { status.textContent = 'No response from extension'; return; }
        if (resp.success) {
          status.textContent = 'Upload complete';
          addLink(resp.url);
          clearSelection();
        } else {
          status.textContent = 'Upload failed: ' + (resp.error || 'unknown');
        }
      });
    }

    function uploadAsIs() {
      showConfirm(false);
      closePort();
      if (selectedFile && pendingB64) simpleUpload(selectedFile.name, selectedFile.type, pendingB64);
    }

    function analyzePdf(file, dataB64) {
      status.textContent = 'Checking PDF...';
      setBusy(true);
      port = chrome.runtime.connect({ name: 'fu-convert' });

      port.onMessage.addListener(msg => {
        if (msg.type === 'analyzed') {
          if (!msg.isScanned) {
            // Text PDF: chat tools read these fine, upload untouched.
            closePort();
            simpleUpload(file.name, file.type, dataB64);
            return;
          }
          setBusy(false);
          const capped = msg.pageCount > MAX_CONVERT_PAGES;
          confirmText.textContent = capped
            ? `Scanned PDF — ${msg.pageCount} pages, over the ${MAX_CONVERT_PAGES}-page limit.`
            : `Scanned PDF — ${msg.pageCount} page${msg.pageCount > 1 ? 's' : ''}. Convert to image${msg.pageCount > 1 ? 's' : ''}?`;
          convertBtn.textContent = capped ? `Convert first ${MAX_CONVERT_PAGES} pages` : 'Convert to images';
          convertBtn.onclick = () => {
            showConfirm(false);
            setBusy(true);
            cancelBtn.classList.remove('hidden');
            resetResults();
            port.postMessage({ type: 'convert', pageCount: msg.pageCount });
          };
          showConfirm(true);
          status.textContent = '';
          return;
        }

        if (msg.type === 'progress') {
          const verb = msg.phase === 'render' ? 'Rendering' : 'Uploading';
          status.textContent = `${verb} page ${msg.page} of ${msg.total}...`;
          return;
        }

        if (msg.type === 'link') { addLink(msg.url, `page ${msg.page}`); return; }

        if (msg.type === 'budget') {
          status.textContent = `Stopped at page ${msg.page} — total upload size limit reached`;
          return;
        }

        if (msg.type === 'done') {
          setBusy(false);
          cancelBtn.classList.add('hidden');
          closePort();
          const parts = [];
          if (msg.cancelled) parts.push('Cancelled');
          else parts.push(`Done — ${links.length} image${links.length === 1 ? '' : 's'} uploaded`);
          if (msg.failures && msg.failures.length) parts.push(`failed: page ${msg.failures.join(', ')}`);
          status.textContent = parts.join(' · ');
          clearSelection();
          return;
        }

        if (msg.type === 'error') {
          setBusy(false);
          cancelBtn.classList.add('hidden');
          status.textContent = msg.name === 'PasswordException'
            ? 'PDF is password protected'
            : 'PDF error: ' + msg.error;
          confirmText.textContent = 'Upload the original PDF instead?';
          convertBtn.classList.add('hidden');
          showConfirm(true);
        }
      });

      port.onDisconnect.addListener(() => { port = null; });
      port.postMessage({ type: 'analyze', dataB64, fileName: file.name });
    }

    cancelBtn.addEventListener('click', () => {
      if (port) port.postMessage({ type: 'cancel' });
      status.textContent = 'Cancelling...';
    });

    asIsBtn.addEventListener('click', uploadAsIs);
    abortBtn.addEventListener('click', () => {
      showConfirm(false);
      convertBtn.classList.remove('hidden');
      closePort();
      setBusy(false);
      status.textContent = 'Cancelled';
    });

    // --- consent gate -----------------------------------------------------
    // Files leave the device to a public third-party host; say so once, up front.
    let afterConsent = null;

    function withConsent(run) {
      chrome.storage.local.get({ uploadConsent: false }, data => {
        if (data.uploadConsent) { run(); return; }
        afterConsent = run;
        consentDiv.classList.remove('hidden');
        actions.classList.add('hidden');
        setBusy(false);
      });
    }

    consentOk.addEventListener('click', () => {
      chrome.storage.local.set({ uploadConsent: true });
      consentDiv.classList.add('hidden');
      actions.classList.remove('hidden');
      const run = afterConsent;
      afterConsent = null;
      if (run) run();
    });

    consentNo.addEventListener('click', () => {
      afterConsent = null;
      consentDiv.classList.add('hidden');
      actions.classList.remove('hidden');
      setBusy(false);
      status.textContent = 'Cancelled';
    });

    uploadBtn.addEventListener('click', async () => {
      // No file picked yet: this button opens the picker instead of erroring.
      if (!selectedFile) { openPicker(fileInput); return; }

      const file = selectedFile;
      resetResults();
      setBusy(true);
      status.textContent = 'Reading file...';
      try {
        pendingB64 = await fileToBase64(file);
      } catch (e) {
        setBusy(false);
        status.textContent = 'Could not read file: ' + e.message;
        return;
      }

      withConsent(() => {
        setBusy(true);
        convertBtn.classList.remove('hidden');
        if (extOf(file.name) === 'pdf') {
          analyzePdf(file, pendingB64);
        } else {
          simpleUpload(file.name, file.type, pendingB64);
        }
      });
    });
  }

  function destroy() {
    if (host) {
      host.remove();
      host = null;
      root = null;
    }
  }

  chrome.storage.local.get({ enabled: true, fuPosition: null }, data => {
    if (data.enabled) {
      build();
      if (data.fuPosition) applyPosition(data.fuPosition);
      clampIntoView();
    }
  });

  chrome.storage.onChanged.addListener(changes => {
    if (!changes.enabled) return;
    if (changes.enabled.newValue) {
      if (!host) {
        chrome.storage.local.get({ fuPosition: null }, data => {
          build();
          if (data.fuPosition) applyPosition(data.fuPosition);
          clampIntoView();
        });
      }
    } else {
      destroy();
    }
  });
})();
