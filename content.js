const POST_SELECTOR = 'article[data-testid="tweet"]';
const MATCH_COLOR = 'rgba(255, 0, 0, 0.18)';
const BORDER_COLOR = '#e5484d';
const CHECKED = 'jevFilterChecked';
const pending = [];
let active = 0;
let config = { categories: [] };

chrome.storage.local.get(['categories'], (saved) => {
  config = { categories: (saved.categories || []).filter(Boolean).slice(0, 5) };
  scan(document);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.categories) return;
  chrome.storage.local.get(['categories'], (saved) => {
    config = { categories: (saved.categories || []).filter(Boolean).slice(0, 5) };
    document.querySelectorAll(`[${CHECKED}]`).forEach((post) => {
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
    post.style.setProperty('background-color', MATCH_COLOR, 'important');
    post.style.setProperty('box-shadow', `inset 3px 0 ${BORDER_COLOR}`, 'important');
    post.title = `Jev match: ${matches.join(', ')}`;
  }
  post.dataset.jevFilterChecked = 'done';
}

function resetHighlight(post) {
  post.style.removeProperty('background-color');
  post.style.removeProperty('box-shadow');
  post.removeAttribute('title');
}
