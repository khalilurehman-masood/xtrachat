const enabled = document.getElementById('fu-enabled');
const allSites = document.getElementById('fu-allsites');
const ALL_SITES = { origins: ['*://*/*'] };

chrome.storage.local.get({ enabled: true }, data => {
  enabled.checked = data.enabled;
});

enabled.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: enabled.checked });
});

chrome.permissions.contains(ALL_SITES, has => {
  allSites.checked = !!has;
});

// chrome.permissions.request() must run inside a user gesture; a checkbox
// change handler fired by a real click qualifies.
allSites.addEventListener('change', () => {
  if (allSites.checked) {
    chrome.permissions.request(ALL_SITES, granted => {
      allSites.checked = !!granted;   // reverts the switch if the user declines
    });
  } else {
    chrome.permissions.remove(ALL_SITES, () => {
      allSites.checked = false;
    });
  }
});
