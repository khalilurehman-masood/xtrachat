# XtraChat — Privacy Policy

**Last updated: 5 September 2026**

XtraChat is a Chrome extension that uploads an image or PDF you choose to a public
file host and gives you back a link you can paste into a chat.

## The short version

We do not run any servers, we do not collect anything, and we have no analytics.
The only data that leaves your device is **the file you explicitly choose to
upload**, and it goes straight to the file host.

## What leaves your device

**Files you select.** When you pick a file and press Upload, that file is sent over
HTTPS to a free third-party file host, which returns a public link to it. Two hosts
are used:

| Host | Retention |
|---|---|
| [uguu.se](https://uguu.se) | Files are deleted automatically after about 3 hours |
| [catbox.moe](https://catbox.moe) | Permanent |

XtraChat measures how fast each host actually is on your connection and sends each
upload to whichever has been faster, falling back to the other if one fails. The
extension records only the measured speed (a number, stored locally) — never the
file, its name, or its link. The panel always shows which host was used and how
long that link will live.

Three things follow from this, and you should assume all of them:

- **The uploaded file is public.** Anyone who has the link — or guesses it — can
  open it. Links are not passwords.
- **Anonymous uploads cannot be deleted on demand.** Neither XtraChat nor you can
  remove a file once uploaded. A uguu.se upload does expire on its own after about
  3 hours; a catbox.moe upload stays up indefinitely.
- **Neither host is operated by us.** Their handling of your file is governed by
  their own terms and privacy practices at https://uguu.se and https://catbox.moe.

Because of this, XtraChat asks you to confirm you understand before your first
upload, and repeats the warning in the extension's popup. **Do not upload
anything confidential, personal, or sensitive.**

**Scanned PDFs.** If you upload a PDF that has no text layer (a scan), XtraChat
offers to convert its pages to images so chat tools can read them. That
conversion happens **entirely on your own computer** using a bundled copy of
PDF.js. The resulting images are then uploaded the same way as any other file.

## What stays on your device

Stored locally through Chrome's `storage.local` API, never transmitted:

- The floating button's position on screen
- Whether the button is shown
- Whether you have acknowledged the upload warning
- Measured upload speed for each host, so the faster one can be chosen next time

Uninstalling the extension removes all of it.

## What we never do

- We do not collect, transmit, or store your browsing history, page contents,
  form data, credentials, or personal information.
- We do not use analytics, trackers, advertising, or fingerprinting.
- We do not sell or transfer your data to anyone. We never receive it.
- We do not read or transmit the content of the pages the button appears on.

## Permissions and why they exist

| Permission | Why |
|---|---|
| `storage` | Saves the button position and your settings locally. |
| `offscreen` | Renders scanned PDF pages to images on your device; Chrome's service worker has no canvas. |
| `scripting` | Registers the button on additional sites **only** after you turn on "Enable on all sites". |
| `https://catbox.moe/*`, `https://uguu.se/*` | The two upload endpoints. |
| Listed chat sites | Where the floating button appears by default. |
| `*://*/*` (optional) | Off by default. Only granted if you explicitly enable the button on all sites, and revocable at any time from the popup. |

## Children

XtraChat is not directed at children under 13.

## Changes

Material changes to this policy will be published here, and the "Last updated"
date will change.

## Contact

Questions, bugs, or privacy requests: please
[open an issue on GitHub](https://github.com/khalilurehman-masood/xtrachat/issues).

---

*The canonical, published version of this policy is at
`https://khalilurehman-masood.github.io/xtrachat/privacy.html` — see `docs/privacy.html`.*
