chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.tabs.create({url: chrome.runtime.getURL(`export.html?tab=${tab.id}&auto=1`)});
});
