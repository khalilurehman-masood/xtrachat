# XtraChat

A Chrome extension that puts a draggable floating button on AI chat pages. Pick a
PDF or image, and it uploads to [catbox.moe](https://catbox.moe) and hands you a
shareable link to paste into the conversation.

Scanned PDFs — the ones that are just photographs of pages, with no text layer —
are detected and converted to images on your machine first, because chat tools
extract nothing from them otherwise.

## Install for development

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

Requires Chrome 116+ (`chrome.offscreen` and `chrome.runtime.getContexts`).

## Usage

- Click the floating button to open the panel. Dragging moves it instead — the
  position is remembered, and clamped back on screen if the window is resized.
- Click the drop zone or **Choose file** to browse, or drop a file onto the panel.
  On touch devices a **Camera** button appears for photographing a document.
- **Supported: PDF, PNG, JPG, JPEG, GIF, WEBP — up to 25 MB.**
- After upload, use the copy icon next to the link. Multi-page conversions get a
  **Copy all links** button.
- The toolbar popup has two switches: show/hide the button, and **Enable on all
  sites** (off by default — see Permissions).

## Scanned PDFs

A PDF with no text layer gets rasterized so a vision model can read it.

- PDF.js (bundled in `vendor/`, run in an offscreen document since the service
  worker has no canvas) samples the first 3 pages. Averaging under 50 characters
  per page means it's a scan.
- Text PDFs upload untouched as `.pdf`, with no prompt.
- Scanned PDFs show a confirmation with the page count first. You can convert,
  upload the original instead, or cancel.
- Each page becomes its own image and its own link. Pages are deliberately **not**
  stitched into one tall image: vision models downscale large images until the
  text is unreadable, which would defeat the point.

| Guard | Value |
|---|---|
| Input file size | 25 MB |
| Pages converted | 10 max (larger PDFs offer "convert first 10") |
| Render resolution | longest side 2000 px, scale capped at 3× |
| Encoding | JPEG, quality 0.85 |
| Per-page image | 5 MB (retried once at 1400 px / q0.70, then skipped) |
| Total per run | 40 MB |
| Pacing | sequential, ~300 ms apart, cancellable |

All tunable at the top of `content.js`, `background.js` and `offscreen.js`.

## Permissions

The button ships enabled only on a short list of AI chat sites (ChatGPT, Claude,
Gemini, Perplexity, Copilot, Grok, Poe, DeepSeek). Anything wider is **opt-in**:
the popup's "Enable on all sites" switch requests `*://*/*` at runtime and
registers the content script dynamically. Revoking it unregisters the script.

## Privacy

Uploads are anonymous and **public** — anyone with the link can open the file, and
anonymous uploads can't be deleted afterwards. The extension says so before your
first upload. Nothing else leaves your device; there are no analytics and no
backend of ours. See [PRIVACY.md](PRIVACY.md).

## Architecture notes

- **Shadow DOM.** The widget renders inside a shadow root with its CSS in
  `styles.js`, so page styles can't reach in and our styles can't leak out. An
  earlier version injected a global `.hidden` rule onto every page it ran on.
- **Base64 over the message channel.** `chrome.runtime.sendMessage` serializes as
  JSON, so ArrayBuffers/Blobs arrive as `{}`. File bytes travel as base64
  (~33% overhead, part of why the size cap is conservative).
- **Uploads happen in the service worker.** catbox.moe sends no CORS headers, so a
  content-script fetch would be blocked; the worker's `host_permissions` apply.
- **Progress travels over a port.** `chrome.tabs.sendMessage` would need host
  permission for the page's own URL, which we deliberately don't hold.

## Packaging

```powershell
.\build.ps1     # -> dist/xtrachat-v<version>.zip
```

Ships only the runtime files with `manifest.json` at the ZIP root. It builds the
archive via `System.IO.Compression` rather than `Compress-Archive`, which writes
backslash entry names on PowerShell 5.1 and produces a spec-violating ZIP.

See [STORE-LISTING.md](STORE-LISTING.md) for submission copy and the
pre-submission checklist.

## Next steps

- A PDF mixing text pages with scanned pages is classified from a 3-page sample,
  so it can be misjudged; a manual override is the natural follow-up.
- Optional catbox userhash so uploads belong to the user's account and can be
  deleted.
- Upload history; per-site auto-paste into chat inputs.
- Mobile: Chrome for Android doesn't support extensions yet. The UI is already
  touch-first; a real mobile launch means a Firefox Android port or a PWA with an
  upload proxy.
