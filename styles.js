// Injected into the widget's shadow root, never into the host page. Keeping it
// here (rather than content_scripts.css) means none of these selectors can ever
// match page elements — an earlier version leaked a global `.hidden` rule onto
// every site it ran on.
var FU_CSS = `
:host {
  all: initial;
  display: block;
  position: fixed;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  color: #222;
}
* { box-sizing: border-box; }
.hidden { display: none !important; }

#fu-handle {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #0066ff, #004ac2);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.24);
  user-select: none; -webkit-user-select: none;
  touch-action: none;               /* we handle the drag ourselves */
  cursor: grab;
}
#fu-handle.fu-busy { opacity: .6; cursor: wait; animation: fu-pulse 1s ease-in-out infinite; }
@keyframes fu-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(.92); } }

/* Absolutely positioned against the handle so it can flip away from screen
   edges without changing the host's own geometry. */
#fu-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: #fff; color: #222;
  padding: 12px; border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  width: min(268px, 86vw);
  max-height: min(70vh, 560px);
  overflow-y: auto;
}
#fu-panel.fu-above { top: auto; bottom: calc(100% + 8px); }
#fu-panel.fu-right { left: auto; right: 0; }

#fu-drop {
  border: 1.5px dashed #c3d4f0; border-radius: 8px;
  padding: 16px 10px; text-align: center;
  font-size: 12px; color: #5b6b80; background: #fff;
  cursor: pointer; word-break: break-word;
  transition: background .15s, border-color .15s;
}
#fu-drop:hover { border-color: #0066ff; background: #f5f9ff; }
#fu-drop.fu-dragover { border-color: #0066ff; background: #e8f1ff; color: #0066ff; }

#fu-hint { font-size: 11px; color: #888; margin-top: 6px; }
input[type=file] { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

button {
  background: #0066ff; color: #fff;
  border: none; padding: 9px 10px; border-radius: 6px;
  cursor: pointer; width: 100%;
  font-family: inherit; font-size: 12px;
}
button:hover { background: #0057db; }
button:disabled { opacity: .6; cursor: wait; }
button.fu-secondary { background: #eef1f5; color: #333; }
button.fu-secondary:hover { background: #e3e8ef; }

#fu-actions { margin-top: 10px; display: flex; gap: 6px; }
#fu-status { margin-top: 8px; color: #333; font-size: 12px; min-height: 14px; }

#fu-consent, #fu-confirm {
  margin-top: 8px; padding: 10px;
  border: 1px solid #ffe0a3; background: #fff8e8; border-radius: 8px;
}
#fu-consent-text, #fu-confirm-text {
  color: #7a5b00; font-size: 12px; margin-bottom: 8px;
}
#fu-consent a { color: #0066ff; }
#fu-consent button, #fu-confirm button { margin-bottom: 4px; }

#fu-links { margin-top: 8px; max-height: 168px; overflow-y: auto; }
.fu-link-row { display: flex; gap: 6px; align-items: stretch; margin-bottom: 4px; }
.fu-link-row input {
  flex: 1 1 auto; min-width: 0;
  padding: 7px; border: 1px solid #ddd; border-radius: 6px;
  font-family: inherit; font-size: 11px;
  color: #111; background: #fff;
}
.fu-copy-btn {
  width: auto; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  padding: 7px 9px;
}
#fu-copyall, #fu-cancel { margin-top: 6px; }
.fu-link-meta { font-size: 10px; color: #8a94a3; margin: 1px 0 7px 2px; }
.fu-link-meta.fu-temp { color: #b07d00; }

/* Touch devices: Chrome for Android has no extensions yet, but Edge Canary and
   Chrome's forthcoming desktop-Android build do — and this also covers
   touchscreen laptops. 44px is the minimum comfortable tap target. */
@media (pointer: coarse) {
  #fu-handle { width: 56px; height: 56px; }
  button { min-height: 44px; font-size: 13px; }
  .fu-copy-btn { min-width: 44px; }
  #fu-drop { padding: 22px 12px; font-size: 13px; }
  .fu-link-row input { padding: 11px 8px; font-size: 12px; }
  #fu-panel { width: min(300px, 90vw); }
}
`;
