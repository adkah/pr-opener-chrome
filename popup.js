document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    
    if (currentTab && currentTab.url) {
      const url = new URL(currentTab.url);
      
      if (url.hostname === 'github.com' && url.pathname.includes('/commits/')) {
        statusElement.textContent = 'Active on GitHub commits page';
        statusElement.className = 'status active';
      } else if (url.hostname === 'github.com') {
        statusElement.textContent = 'On GitHub - navigate to commits page';
        statusElement.className = 'status inactive';
      } else {
        statusElement.textContent = 'Not on GitHub';
        statusElement.className = 'status inactive';
      }
    }
  });
});
