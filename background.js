chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openTab') {
    chrome.tabs.create({
      url: message.url,
      active: false
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('GitHub PR Opener extension installed');
});
