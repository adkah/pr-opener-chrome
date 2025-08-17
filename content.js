(function() {
  'use strict';

  function isGitHubCommitsPage() {
    return window.location.hostname === 'github.com' && 
           window.location.pathname.includes('/commits/');
  }

  function getCommitsData() {
    const commits = [];
    const commitElements = document.querySelectorAll('[data-testid="commit-row-item"]');
    
    commitElements.forEach((element, index) => {
      try {
        const commitLinks = element.querySelectorAll('a[href*="/commit/"]');
        const timeElement = element.querySelector('relative-time');
        const authorLinks = element.querySelectorAll('a[href*="/commits?author="]');
        
        if (commitLinks.length > 0 && timeElement) {
          const commitLink = commitLinks[0];
          const commitUrl = commitLink.href;
          const commitHash = commitUrl.split('/commit/')[1];
          const commitDate = new Date(timeElement.getAttribute('datetime'));
          
          const titleText = element.getAttribute('aria-label') || '';
          const commitTitle = titleText.split('.')[0] || commitLink.textContent.trim();
          
          const author = authorLinks.length > 0 ? 
            authorLinks[0].textContent.trim() : 
            'Unknown';
          
          const prLinks = element.querySelectorAll('a[href*="/pull/"]');
          let prUrl = null;
          if (prLinks.length > 0) {
            prUrl = prLinks[0].href;
          }
          
          commits.push({
            hash: commitHash,
            url: commitUrl,
            date: commitDate,
            title: commitTitle,
            author: author,
            prUrl: prUrl
          });
        }
      } catch (error) {
        console.error(`Error processing commit ${index + 1}:`, error);
      }
    });
    
    return commits;
  }

  function getRepoInfo() {
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3) {
      return {
        owner: pathParts[1],
        repo: pathParts[2]
      };
    }
    return null;
  }

  async function findPRForCommit(repoInfo, commitHash) {
    try {
      const commitResponse = await fetch(`https://github.com/${repoInfo.owner}/${repoInfo.repo}/commit/${commitHash}`);
      const commitText = await commitResponse.text();
      
      const prPattern = /\/pull\/(\d+)/g;
      const matches = commitText.match(prPattern);
      
      if (matches && matches.length > 0) {
        const prNumber = matches[0].match(/\d+/)[0];
        return `https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/${prNumber}`;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding PR for commit:', error);
      return null;
    }
  }

  function createDatePickerUI() {
    try {
      const existingUI = document.getElementById('github-pr-opener-ui');
      if (existingUI) {
        existingUI.remove();
      }

      const uiContainer = document.createElement('div');
      uiContainer.id = 'github-pr-opener-ui';
      uiContainer.className = 'github-pr-opener-container';
      
      uiContainer.innerHTML = `
        <div class="github-pr-opener-panel">
          <div class="date-picker-section">
            <label for="commit-date-picker">Open PRs for commits since:</label>
            <input type="date" id="commit-date-picker" />
            <button id="open-prs-btn">Open PRs</button>
          </div>
          <div id="status-message" class="status-message"></div>
        </div>
      `;

      let inserted = false;
      
      const listView = document.querySelector('.ListView-module__ul--A_8jF') || document.querySelector('[data-listview-component="items-list"]');
      if (listView && listView.parentNode) {
        listView.parentNode.insertBefore(uiContainer, listView);
        inserted = true;
      }
      
      if (!inserted) {
        const commitList = document.querySelector('.js-navigation-container');
        if (commitList && commitList.parentNode) {
          commitList.parentNode.insertBefore(uiContainer, commitList);
          inserted = true;
        }
      }
      
      if (!inserted) {
        const repoHeader = document.querySelector('[data-pjax-container]');
        if (repoHeader) {
          repoHeader.appendChild(uiContainer);
          inserted = true;
        }
      }
      
      if (!inserted) {
        const main = document.querySelector('main') || document.querySelector('#js-repo-pjax-container');
        if (main) {
          main.insertBefore(uiContainer, main.firstChild);
          inserted = true;
        }
      }
      
      if (!inserted) {
        document.body.appendChild(uiContainer);
      }
    } catch (error) {
      console.error('Error creating UI:', error);
      return;
    }

    const datePicker = document.getElementById('commit-date-picker');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7);
    datePicker.value = defaultDate.toISOString().split('T')[0];

    const openPrsBtn = document.getElementById('open-prs-btn');
    const statusMessage = document.getElementById('status-message');

    openPrsBtn.addEventListener('click', async () => {
      const selectedDate = new Date(datePicker.value);
      if (!selectedDate || isNaN(selectedDate)) {
        statusMessage.textContent = 'Please select a valid date';
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
        return;
      }

      statusMessage.textContent = 'Finding PRs for commits...';
      statusMessage.className = 'status-message loading';
      statusMessage.style.display = 'block';
      openPrsBtn.disabled = true;

      try {
        const commits = getCommitsData();
        const repoInfo = getRepoInfo();
        
        if (!repoInfo) {
          throw new Error('Could not determine repository information');
        }

        const filteredCommits = commits.filter(commit => commit.date >= selectedDate);
        
        if (filteredCommits.length === 0) {
          statusMessage.textContent = `No commits found since ${selectedDate.toDateString()}`;
          statusMessage.className = 'status-message warning';
          statusMessage.style.display = 'block';
          openPrsBtn.disabled = false;
          return;
        }

        statusMessage.textContent = `Found ${filteredCommits.length} commits, searching for PRs...`;

        const urlsToOpen = new Set();
        let foundPRs = 0;
        let foundCommits = 0;

        for (const commit of filteredCommits) {
          let prUrl = null;
          
          if (commit.prUrl) {
            prUrl = commit.prUrl;
          } else {
            prUrl = await findPRForCommit(repoInfo, commit.hash);
          }
          
          if (prUrl) {
            urlsToOpen.add(prUrl);
            foundPRs++;
          } else {
            urlsToOpen.add(commit.url);
            foundCommits++;
          }
          
          statusMessage.textContent = `Processed ${filteredCommits.indexOf(commit) + 1}/${filteredCommits.length} commits, found ${foundPRs} PRs, ${foundCommits} commits...`;
        }

        if (urlsToOpen.size === 0) {
          statusMessage.textContent = 'No commits or PRs found';
          statusMessage.className = 'status-message warning';
          statusMessage.style.display = 'block';
        } else {
          const urlArray = Array.from(urlsToOpen).reverse();
          for (const url of urlArray) {
            chrome.runtime.sendMessage({
              action: 'openTab',
              url: url
            });
          }
          
          let message = `Opened ${urlArray.length} tabs`;
          if (foundPRs > 0 && foundCommits > 0) {
            message += ` (${foundPRs} PRs, ${foundCommits} commits)`;
          } else if (foundPRs > 0) {
            message += ` (${foundPRs} PRs)`;
          } else {
            message += ` (${foundCommits} commits)`;
          }
          
          statusMessage.textContent = message;
          statusMessage.className = 'status-message success';
          statusMessage.style.display = 'block';
        }

      } catch (error) {
        console.error('Error processing commits:', error);
        statusMessage.textContent = `Error: ${error.message}`;
        statusMessage.className = 'status-message error';
        statusMessage.style.display = 'block';
      } finally {
        openPrsBtn.disabled = false;
      }
    });
  }

  function init() {
    if (isGitHubCommitsPage()) {
      setTimeout(() => {
        createDatePickerUI();
      }, 100);
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(createDatePickerUI, 500);
        });
      }
      
      window.addEventListener('load', () => {
        setTimeout(createDatePickerUI, 1000);
      });
      
      const observer = new MutationObserver((mutations) => {
        const commitList = document.querySelector('.js-navigation-container');
        const commits = document.querySelectorAll('.js-navigation-item[data-url]');
        
        if (commitList && commits.length > 0) {
          createDatePickerUI();
          observer.disconnect();
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      let attempts = 0;
      const fallbackInterval = setInterval(() => {
        attempts++;
        
        if (attempts >= 5) {
          clearInterval(fallbackInterval);
          return;
        }
        
        const existingUI = document.getElementById('github-pr-opener-ui');
        if (!existingUI) {
          createDatePickerUI();
        } else {
          clearInterval(fallbackInterval);
        }
      }, 2000);

      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          if (isGitHubCommitsPage()) {
            setTimeout(createDatePickerUI, 1000);
          }
        }
      }).observe(document, { subtree: true, childList: true });
    }
  }

  init();
})();