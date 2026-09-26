const OPENROUTER_URL = 'https://openrouter.ai/api/alpha/decisions';
const MAX_POST_LENGTH = 8_000;
const ALLOWED_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  // Remove keys saved by earlier versions, which kept them in local storage.
  chrome.storage.local.remove('apiKey');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'jev:classify') return;
  if (!isAllowedXSender(sender) || typeof message.text !== 'string') {
    sendResponse({ error: 'Classification request was not valid.' });
    return;
  }
  const text = message.text.trim().slice(0, MAX_POST_LENGTH);
  if (!text) {
    sendResponse({ matches: [] });
    return;
  }
  classifyPost(text)
    .then((matches) => sendResponse({ matches }))
    .catch((error) => sendResponse({ error: error.message || 'Classification failed.' }));
  return true;
});

function isAllowedXSender(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== 'string') return false;
  try {
    return ALLOWED_HOSTS.has(new URL(sender.url).hostname);
  } catch {
    return false;
  }
}

async function classifyPost(post) {
  const [{ apiKey }, { categories = [] }] = await Promise.all([
    chrome.storage.session.get('apiKey'),
    chrome.storage.local.get('categories')
  ]);
  const cleanCategories = categories
    .filter((category) => typeof category === 'string')
    .map((category) => category.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 5);
  if (!apiKey) throw new Error('Add your OpenRouter key in the extension popup.');
  if (!cleanCategories.length) throw new Error('Add at least one category in the extension popup.');

  const questions = Object.fromEntries(cleanCategories.map((category, index) => [
    `category_${index + 1}`,
    { type: 'noul', instructions: `Is the post about ${category}?` }
  ]));
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'typesafe/jev-1.13', state: { post }, questions })
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}: ${await response.text()}`);

  const result = await response.json();
  const answers = result.answers || {};
  return cleanCategories.filter((_, index) => {
    const answer = answers[`category_${index + 1}`];
    return answer?.type === 'noul' && Number(answer.noul) >= 0.5;
  });
}
