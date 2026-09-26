const POST_SELECTOR = 'article[data-testid="tweet"]';
const MATCH_COLOR = 'rgba(255, 0, 0, 0.18)';
const BORDER_COLOR = '#e5484d';
const CHECKED = 'jevFilterChecked';
const CHECKED_ATTRIBUTE = 'data-jev-filter-checked';
const pending = [];
let active = 0;
const originalStyles = new WeakMap();
const originalTitles = new WeakMap();
let config = { categories: [], matchAction: 'highlight' };

chrome.storage.local.get(['categories', 'matchAction'], (saved) => {
  config = {
    categories: (saved.categories || []).filter(Boolean).slice(0, 5),
    matchAction: saved.matchAction === 'hide' ? 'hide' : 'highlight'
  };
  scan(document);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || (!changes.categories && !changes.matchAction)) return;
  chrome.storage.local.get(['categories', 'matchAction'], (saved) => {
    config = {
      categories: (saved.categories || []).filter(Boolean).slice(0, 5),
      matchAction: saved.matchAction === 'hide' ? 'hide' : 'highlight'
    };
    document.querySelectorAll(`[${CHECKED_ATTRIBUTE}]`).forEach((post) => {
      delete post.dataset.jevFilterChecked;
      resetHighlight(post);
    });
    pending.length = 0;
    scan(document);
  });
});

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) scan(node);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

function scan(root) {
  if (!config.categories.length) return;
  if (root.matches?.(POST_SELECTOR)) enqueue(root);
  root.querySelectorAll?.(POST_SELECTOR).forEach(enqueue);
}

function enqueue(post) {
  if (post.dataset.jevFilterChecked) return;
  post.dataset.jevFilterChecked = 'pending';
  pending.push(post);
  processQueue();
}

function processQueue() {
  while (active < 2 && pending.length) {
    const post = pending.shift();
    if (!post.isConnected) continue;
    active++;
    classify(post).catch((error) => {
      delete post.dataset.jevFilterChecked;
      console.warn('[Jev X Post Filter]', error.message);
    }).finally(() => { active--; processQueue(); });
  }
}

async function classify(post) {
  const text = post.querySelector('[data-testid="tweetText"]')?.innerText?.trim();
  if (!text) { post.dataset.jevFilterChecked = 'done'; return; }
  const result = await chrome.runtime.sendMessage({ type: 'jev:classify', text });
  if (result?.error) throw new Error(result.error);
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  if (matches.length) {
    if (config.matchAction === 'hide') {
      setPostStyle(post, 'display', 'none', 'important');
    } else {
      setPostStyle(post, 'background-color', MATCH_COLOR, 'important');
      setPostStyle(post, 'box-shadow', `inset 3px 0 ${BORDER_COLOR}`, 'important');
    }
    if (!originalTitles.has(post)) originalTitles.set(post, post.title);
    post.title = `Jev match: ${matches.join(', ')}`;
  }
  post.dataset.jevFilterChecked = 'done';
}

function resetHighlight(post) {
  const savedStyles = originalStyles.get(post);
  if (savedStyles) {
    for (const [property, original] of savedStyles) {
      if (original.value) post.style.setProperty(property, original.value, original.priority);
      else post.style.removeProperty(property);
    }
    originalStyles.delete(post);
  }
  if (originalTitles.has(post)) {
    post.title = originalTitles.get(post);
    originalTitles.delete(post);
  }
}

function setPostStyle(post, property, value, priority) {
  let savedStyles = originalStyles.get(post);
  if (!savedStyles) {
    savedStyles = new Map();
    originalStyles.set(post, savedStyles);
  }
  if (!savedStyles.has(property)) {
    savedStyles.set(property, {
      value: post.style.getPropertyValue(property),
      priority: post.style.getPropertyPriority(property)
    });
  }
  post.style.setProperty(property, value, priority);
}
