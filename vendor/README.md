# Vendored third-party code

These files are **unmodified** minified builds of [PDF.js](https://github.com/mozilla/pdf.js)
(`pdfjs-dist`), vendored locally because Manifest V3 forbids loading remote code.
They are minified, not obfuscated.

| File | Version | Source URL | SHA-256 |
|---|---|---|---|
| `pdf.min.mjs` | 4.10.38 | `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs` | `27FC2A057A00F92A4334AD06E17DBD7259912954E9FB7F76400BCCA5FD190A9C` |
| `pdf.worker.min.mjs` | 4.10.38 | `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs` | `1BAA1844C89C80A5B2797C916E75AB29254BE46D8E9CB53CB6364D7AAD84BE36` |

Licence: Apache-2.0 (Mozilla Foundation).

## Verifying

```powershell
curl.exe -s -o pdf.min.mjs https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs
Get-FileHash pdf.min.mjs -Algorithm SHA256
```

```bash
curl -s https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs | sha256sum
```

The hashes above must match byte for byte.

## Where it is used

Only in `offscreen.js`, inside the extension's offscreen document, to (a) read a
PDF's text layer to decide whether it is a scan and (b) rasterize scanned pages
to JPEG. The worker is loaded from the extension's own origin via
`chrome.runtime.getURL('vendor/pdf.worker.min.mjs')` — never from a network URL.
