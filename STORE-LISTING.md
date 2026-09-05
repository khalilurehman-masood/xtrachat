# Chrome Web Store submission copy

Paste-ready text for each field in the Developer Dashboard. Nothing here ships in
the extension package.

---

## Store listing tab

**Name:** `XtraChat`

**Short description** (132 char max — this is `description` in manifest.json):
```
Upload an image or PDF from any page and get a shareable link to paste into your AI chat. Scanned PDFs become readable images.
```

**Category:** Productivity → Workflow & Planning
**Language:** English

**Detailed description:**
```
XtraChat puts a small floating button on your AI chat pages. Click it, pick an image or a PDF, and you get a public link in one step — ready to paste into the conversation.

WHY
Chat tools each have their own upload limits, formats and quirks. A link works everywhere, in any chat, without fighting an upload dialog.

HOW IT WORKS
1. Click the floating button (drag it anywhere you like — it remembers where).
2. Choose an image or PDF, or drop one onto the panel.
3. Copy the link and paste it into your chat.

SUPPORTED FILES
PNG, JPG, JPEG and PDF, up to 25 MB.

SCANNED PDFs
A PDF that is just photographs of pages has no text in it, so chat tools read nothing from it. XtraChat notices this, tells you how many pages it found, and offers to convert the pages into images that a vision model can actually read. Conversion happens entirely on your own computer. Ordinary text PDFs are left alone and uploaded as-is.

Sensible limits are built in: 25 MB per file, up to 10 pages converted per PDF, and you always confirm before anything is converted or uploaded.

PRIVACY — PLEASE READ
Files are uploaded to a free public file host we do not operate: uguu.se (links last about 3 hours) or catbox.moe (permanent), whichever is faster on your connection. The panel tells you which was used.
• Anyone with the link can open your file.
• Uploads cannot be deleted on demand (uguu.se links do expire by themselves).
• Do not upload anything confidential or personal.
XtraChat itself collects nothing: no analytics, no tracking, no accounts, no servers of ours. Your settings stay on your computer.

PERMISSIONS
By default the button appears only on a short list of AI chat sites. If you want it everywhere, there is an opt-in switch in the popup — it is off unless you turn it on, and you can revoke it any time.

Open source. Not affiliated with OpenAI, Google, Anthropic, Microsoft, uguu.se, or catbox.moe.
```

**Support URL:** `https://github.com/khalilurehman-masood/xtrachat/issues`
**Website / homepage:** `https://khalilurehman-masood.github.io/xtrachat/`

**Assets:**
- Store icon: `icons/store-icon-128.png` (128×128, 96px art + 16px padding)
- Small promo tile: `icons/promo-440x280.png` (440×280) — required for ranking
- Screenshots: see the section below

---

## Contact email — unavoidable, but choose which one

Google requires a **verified contact email** on the account, and it **is shown publicly**
under your extension's contact information on the listing. A GitHub link cannot replace
it. A GitHub URL *can* be used for the Support URL field and as the contact channel inside
the privacy policy — both are set up above.

**Recommendation:** register (or add and verify) a dedicated address such as
`xtrachat.dev@gmail.com` rather than exposing your personal one. Note the *account* email
of the Google account you register with **cannot be changed later**, so pick it
deliberately before paying the fee.

---

## Screenshots

**Specification:** 1280×800 px, PNG or JPEG, **full bleed** (no padding, no rounded
corners, no drop shadows, no device frames). Minimum 1, maximum 5. The first one is your
thumbnail — make it the strongest.

**How to capture at exactly 1280×800:** open DevTools (F12) → toggle the device toolbar
(Ctrl+Shift+M) → choose *Responsive* → type `1280` × `800` → set DPR to `1` → then the
device-toolbar ⋮ menu → **Capture screenshot**. This produces an exact-size PNG and
includes the floating widget, since it lives in the page.

**Rules that matter:** screenshots must show the extension actually working — do not mock
them up or use pure marketing art, which is a rejection risk. Keep third-party logos
(ChatGPT, Gemini, Claude) small and incidental in frame so nothing implies an
affiliation, and never put those names in overlaid text.

**Shot list, in order:**

| # | Shot | What must be visible | Why it earns its place |
|---|---|---|---|
| 1 | **The core loop** | Floating button on a chat page with the panel open: drop zone, "Images (PNG, JPG, JPEG) or PDF · max 25.0 MB", and the Upload button | Answers "what is this?" in one glance — this is the thumbnail |
| 2 | **Result** | A finished upload: the link in the field, the copy icon, status "Upload complete" | Shows the payoff — the thing users came for |
| 3 | **Scanned PDF** | The amber confirmation: "Scanned PDF — 3 pages. Convert to images?" with the Convert / Upload as-is / Cancel buttons | Your differentiator, and it demonstrates you ask before doing heavy work |
| 4 | **Multi-page result** | Several `page 1…n` links stacked with the "Copy all links" button | Shows the feature completes, not just starts |
| 5 | **Permissions** | The popup with both switches, "Enable on all sites" **off** | Reassures privacy-minded users, and shows a reviewer the opt-in model |

Shots 1–3 are the minimum worth publishing. To stage shot 3, use an image-only PDF —
`scan-1page.pdf` / `scan-15page.pdf` from the test fixtures work, or photograph any
document page and save it as a PDF.

---

## Privacy tab

**Single purpose:**
```
XtraChat uploads a file the user selects to a file host and returns a shareable link they can paste into a chat. Converting scanned PDF pages into images is part of preparing that file so the link is usable by chat tools.
```

**Permission justifications:**

| Field | Text |
|---|---|
| `storage` | Stores the floating button's on-screen position, whether it is shown, and whether the user has acknowledged the upload warning. All local; nothing is transmitted. |
| `offscreen` | Scanned PDFs are rasterized to images with a bundled copy of PDF.js, which requires a DOM and canvas. The MV3 service worker has neither, so an offscreen document performs the conversion locally on the user's machine. |
| `scripting` | Used only to register the content script on additional hosts after the user explicitly opts in to "Enable on all sites" from the popup, and to unregister it when they opt out. |
| `host_permissions: https://catbox.moe/*` and `https://uguu.se/*` | The two upload endpoints. The extension POSTs the user's selected file to one of these file-hosting APIs and receives a public link in return. This is the extension's core function. Upload speed to these hosts varies by network, so the extension times each upload and sends the next one to whichever has been faster, falling back to the other if one fails. Only a speed number is stored, locally. |
| Content script hosts (chatgpt.com, claude.ai, gemini.google.com, perplexity.ai, copilot.microsoft.com, grok.com, poe.com, chat.deepseek.com, chat.openai.com) | These are the AI chat sites where the floating upload button appears. The extension only injects its own UI into a shadow root; it does not read, modify, or transmit any page content. |
| `optional_host_permissions: *://*/*` | Off by default and never granted at install. Most users want the button available on any page, so a welcome page shown once after installation offers a single "Enable on all sites" button that calls chrome.permissions.request() from a user gesture. Declining is a first-class option and the extension stays fully functional on the listed chat sites. Revocable at any time from the popup, which unregisters the dynamic content script. |
| `tabs` API (no permission declared) | chrome.tabs.create opens the one-time welcome page after install. chrome.tabs.query/scripting.executeScript are used only after the user grants all-sites access, to inject the button into already-open tabs so they don't have to reload. No tab URLs are read, stored, or transmitted. |

**Data usage — declare:**
- ✅ Personally identifiable / user content: **yes** — the file the user chooses is transmitted to uguu.se or catbox.moe at their explicit action.
- ❌ Health, financial, authentication, personal communications *collected by us*, location, web history, user activity: **no**.
- Certify: not sold to third parties; not used for anything unrelated to the single purpose; not used for creditworthiness/lending.

**Privacy policy URL:** `https://khalilurehman-masood.github.io/xtrachat/privacy.html` — live.

---

## Notes to reviewer

```
TESTING
The extension needs a file to demonstrate anything. To test:
1. Visit any listed chat site, e.g. https://claude.ai
2. Click the blue floating button (bottom-right by default; draggable).
3. Choose any small PNG or JPG image, and click Upload.
4. A link appears with a copy button, labelled with the host used and how long it lasts.

To test the scanned-PDF path, use any image-only PDF (a photographed or scanned
page with no selectable text). The extension will report the page count and ask
before converting. A text PDF will upload untouched, with no prompt.

THIRD-PARTY CODE
vendor/pdf.min.mjs and vendor/pdf.worker.min.mjs are unmodified minified builds
of PDF.js (pdfjs-dist 4.10.38), vendored locally because MV3 forbids remote code.
They are minified, not obfuscated. vendor/README.md lists the exact jsDelivr
source URLs and SHA-256 hashes so the bytes can be verified independently.

NO REMOTE CODE
There is no eval(), no new Function(), and no script is fetched at runtime. The
only network request the extension makes is a multipart POST to
https://catbox.moe/user/api.php or https://uguu.se/upload containing the file the user selected.

HOST PERMISSIONS
The static content script list is limited to AI chat sites, which is where the
feature is used. Broad access (*://*/*) is optional, off by default, requested
only from a user gesture in the popup, and revocable there.

USER DATA
No analytics, no tracking, no backend of ours. The uploaded file goes directly
from the user's browser to the file host. The extension warns the user in-product
before the first upload that files become public and cannot be deleted.
```

---

## Pre-submission checklist

- [x] ~~Create the GitHub repo and run `set-urls.ps1`~~ — done
- [x] ~~Enable GitHub Pages from `main` `/docs`~~ — live at https://khalilurehman-masood.github.io/xtrachat/
- [x] ~~Add a `LICENSE`~~ — MIT
- [ ] Register developer account, pay the one-time **$5 USD** fee, enable 2-Step Verification
- [ ] Verify the contact email — remember **it cannot be changed later**, and it is shown publicly on the listing
- [ ] Search the store for an existing "XtraChat" to avoid a name collision
- [ ] Capture at least the first three 1280×800 screenshots (see Screenshots above)
- [ ] Run `build.ps1`, then install the ZIP in a **fresh profile** and retest
- [ ] Declare EU trader / non-trader status (traders must publish contact details)
- [ ] Submit; approval gives you **30 days** to publish
