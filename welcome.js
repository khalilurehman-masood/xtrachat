const ALL_SITES = { origins: ['*://*/*'] };

const enableBtn = document.getElementById('enable');
const skipBtn = document.getElementById('skip');
const granted = document.getElementById('granted');
const denied = document.getElementById('denied');

function showGranted() {
  enableBtn.disabled = true;
  enableBtn.textContent = 'Enabled on all sites';
  skipBtn.style.display = 'none';
  denied.classList.remove('show');
  granted.classList.add('show');
}

// Someone re-opening this page after already granting shouldn't be asked again.
chrome.permissions.contains(ALL_SITES, has => {
  if (has) showGranted();
});

// permissions.request() only works inside a user gesture, which a click handler is.
enableBtn.addEventListener('click', () => {
  chrome.permissions.request(ALL_SITES, ok => {
    if (ok) {
      showGranted();
    } else {
      granted.classList.remove('show');
      denied.classList.add('show');
    }
  });
});

skipBtn.addEventListener('click', () => {
  granted.classList.remove('show');
  denied.classList.add('show');
});
