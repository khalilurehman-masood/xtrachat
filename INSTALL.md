# Installing XtraChat

## The easy way — Chrome Web Store

**[Add to Chrome](https://chromewebstore.google.com/detail/hpkgjgoigicdkobifmjmmaomcmmochhk)**

One click, and it updates itself automatically. This is what you want unless you
have a reason to run the source directly.

---

## Manual install (from the zip)

Use this if you want to run a modified copy, or a version that isn't published yet.

> **Heads up:** Chrome deliberately blocks installing extensions from a downloaded
> `.crx` file (on Windows since Chrome 33, macOS since Chrome 44). There is no
> double-click installer for off-store extensions — the folder method below is the
> only supported way.

### Steps (Chrome, Edge, Brave, Opera — any Chromium browser)

1. **Download** `xtrachat.zip` from the
   [latest release](https://github.com/khalilurehman-masood/xtrachat/releases/latest).

2. **Unzip it** to somewhere permanent — `Documents\XtraChat`, for example.
   **Don't delete this folder afterwards.** The browser loads the extension from
   it every time it starts, so if the folder moves or disappears, the extension
   breaks. (Don't run it from your Downloads folder or from inside the zip.)

3. **Open the extensions page:** type `chrome://extensions` in the address bar
   and press Enter. (In Edge it's `edge://extensions`, in Brave `brave://extensions`.)

4. **Turn on "Developer mode"** — the toggle in the top-right corner.

5. **Click "Load unpacked"** (top-left), select the folder you unzipped, and
   click Select Folder.

XtraChat is now installed. A welcome tab opens — click **Enable on all sites** if
you want the button on every page, or skip it to keep it to AI chat sites only.

## Using it

- Look for the blue circle with an upload arrow, bottom-right of the page.
- Click it, choose a PNG, JPG, JPEG or PDF (up to 25 MB), and press Upload.
- Copy the link and paste it into your chat.
- Drag the circle anywhere you like — it remembers where you put it.

## Things worth knowing

**Chrome may warn you about developer mode.** You might see a
"Disable developer mode extensions" prompt when the browser starts. Click **Cancel**
or **Keep** — dismissing it doesn't remove the extension. This warning exists because
you installed from a folder rather than a store; it isn't a problem with XtraChat.

**No automatic updates.** Store extensions update themselves; this one can't. To
update, download the new zip, replace the folder's contents, then click the refresh
arrow (↻) on the XtraChat card in `chrome://extensions`.

**Uploads are public.** Files go to a free public file host — anyone with the link
can open them, and they can't be deleted on demand. Don't upload anything private.
See the [privacy policy](https://khalilurehman-masood.github.io/xtrachat/privacy.html).

## Troubleshooting

| Problem | Fix |
|---|---|
| "Manifest file is missing or unreadable" | You selected the wrong folder. Pick the one that has `manifest.json` directly inside it — if the zip created a nested folder, go one level deeper. |
| No button on the page | It only appears on AI chat sites unless you enabled all sites. Open the extension's popup (puzzle-piece icon → XtraChat) and check both switches. Then reload the page. |
| Button vanished after restarting | The folder was moved or deleted. Put it back, or re-unzip and load it again. |
| Nothing happens on `chrome://` pages, the Web Store, or PDFs | Expected — browsers block extensions on those pages entirely. |
| Upload seems stuck | Watch the status line; it shows elapsed seconds. Large files on a slow connection genuinely take a while. It gives up and reports an error after 3 minutes. |
