const OPENROUTER_URL = 'https://openrouter.ai/api/alpha/decisions';
const MAX_POST_LENGTH = 8_000;
const HOUR_MS = 60 * 60 * 1_000;
const MINUTE_MS = 60 * 1_000;
const HISTORY_MS = 90 * 24 * HOUR_MS;
const ALLOWED_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);
let statsWriteQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  // Remove keys saved by earlier versions, which kept them in local storage.
  chrome.storage.local.remove('apiKey');
  chrome.action.setBadgeBackgroundColor({ color: '#d73745' });
  scheduleBadgeRefresh();
  refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleBadgeRefresh();
  refreshBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh-detection-badge') refreshBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.badgePeriod) refreshBadge();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'jev:get-stats') {
    if (!isExtensionPage(sender)) {
      sendResponse({ error: 'Statistics request was not valid.' });
      return;
    }
    getStatistics()
      .then((stats) => sendResponse(stats))
      .catch(() => sendResponse({ error: 'Could not load detection statistics.' }));
    return true;
  }
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
    .then(async (matches) => {
      if (matches.length) await recordDetections(matches).catch((error) => console.warn('[Jev X Post Filter] Could not save statistics:', error));
      sendResponse({ matches });
    })
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

function isExtensionPage(sender) {
  return sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL('/'));
}

function scheduleBadgeRefresh() {
  chrome.alarms.create('refresh-detection-badge', { periodInMinutes: 1 });
}

async function classifyPost(post) {
  const [{ apiKey }, { categories = [] }] = await Promise.all([
    chrome.storage.session.get('apiKey'),
    chrome.storage.local.get('categories')
  ]);
  const cleanCategories = [...new Set(categories
    .filter((category) => typeof category === 'string')
    .map((category) => category.trim().slice(0, 100))
    .filter(Boolean))]
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

function recordDetections(matches) {
  statsWriteQueue = statsWriteQueue.catch(() => {}).then(async () => {
    const now = Date.now();
    const hour = Math.floor(now / HOUR_MS) * HOUR_MS;
    const minute = Math.floor(now / MINUTE_MS) * MINUTE_MS;
    const [localData, sessionData] = await Promise.all([
      chrome.storage.local.get(['statsBuckets', 'statsRecentMinutes']),
      chrome.storage.session.get(['statsSessionCounts'])
    ]);
    const buckets = localData.statsBuckets && typeof localData.statsBuckets === 'object' ? localData.statsBuckets : {};
    const hourBucket = buckets[hour] || {};
    const sessionCounts = sessionData.statsSessionCounts && typeof sessionData.statsSessionCounts === 'object'
      ? sessionData.statsSessionCounts
      : {};
    const recentMinutes = localData.statsRecentMinutes && typeof localData.statsRecentMinutes === 'object'
      ? localData.statsRecentMinutes
      : {};
    const minuteBucket = recentMinutes[minute] || {};

    for (const category of matches) {
      hourBucket[category] = (hourBucket[category] || 0) + 1;
      sessionCounts[category] = (sessionCounts[category] || 0) + 1;
      minuteBucket[category] = (minuteBucket[category] || 0) + 1;
    }
    buckets[hour] = hourBucket;
    for (const bucketStart of Object.keys(buckets)) {
      if (Number(bucketStart) < now - HISTORY_MS) delete buckets[bucketStart];
    }
    recentMinutes[minute] = minuteBucket;
    for (const bucketStart of Object.keys(recentMinutes)) {
      if (Number(bucketStart) < now - 61 * MINUTE_MS) delete recentMinutes[bucketStart];
    }

    await Promise.all([
      chrome.storage.local.set({ statsBuckets: buckets, statsRecentMinutes: recentMinutes }),
      chrome.storage.session.set({ statsSessionCounts: sessionCounts })
    ]);
    await refreshBadge();
  });
  return statsWriteQueue;
}

async function getStatistics() {
  const [localData, sessionData] = await Promise.all([
    chrome.storage.local.get(['statsBuckets', 'categories', 'statsRecentMinutes']),
    chrome.storage.session.get(['statsSessionCounts'])
  ]);
  const statsBuckets = localData.statsBuckets && typeof localData.statsBuckets === 'object' ? localData.statsBuckets : {};
  const cutoff = Date.now() - HISTORY_MS;
  let removedOldBuckets = false;
  for (const bucketStart of Object.keys(statsBuckets)) {
    if (Number(bucketStart) < cutoff) {
      delete statsBuckets[bucketStart];
      removedOldBuckets = true;
    }
  }
  const recentMinutes = localData.statsRecentMinutes && typeof localData.statsRecentMinutes === 'object' ? localData.statsRecentMinutes : {};
  const recentCutoff = Date.now() - 61 * MINUTE_MS;
  let removedOldMinutes = false;
  for (const minuteStart of Object.keys(recentMinutes)) {
    if (Number(minuteStart) < recentCutoff) {
      delete recentMinutes[minuteStart];
      removedOldMinutes = true;
    }
  }
  if (removedOldBuckets || removedOldMinutes) await chrome.storage.local.set({ statsBuckets, statsRecentMinutes: recentMinutes });
  return {
    statsBuckets,
    categories: localData.categories || [],
    sessionCounts: sessionData.statsSessionCounts || {},
    recentMinutes,
    badgePeriod: (await chrome.storage.local.get('badgePeriod')).badgePeriod || 'last-hour'
  };
}

async function refreshBadge() {
  const now = Date.now();
  const [localData, sessionData] = await Promise.all([
    chrome.storage.local.get(['badgePeriod', 'statsBuckets', 'statsRecentMinutes']),
    chrome.storage.session.get(['statsSessionCounts'])
  ]);
  const sessionCounts = sessionData.statsSessionCounts || {};
  const buckets = localData.statsBuckets || {};
  const recentMinutes = localData.statsRecentMinutes || {};
  const recentCutoff = now - HOUR_MS;
  let removedOldMinutes = false;
  let removedOldBuckets = false;
  for (const start of Object.keys(buckets)) {
    if (Number(start) < now - HISTORY_MS) {
      delete buckets[start];
      removedOldBuckets = true;
    }
  }
  for (const start of Object.keys(recentMinutes)) {
    if (Number(start) < now - 61 * MINUTE_MS) {
      delete recentMinutes[start];
      removedOldMinutes = true;
    }
  }
  if (removedOldMinutes || removedOldBuckets) {
    await chrome.storage.local.set({ statsBuckets: buckets, statsRecentMinutes: recentMinutes });
  }
  const hourTotal = Object.entries(recentMinutes).reduce((total, [start, counts]) => {
    if (Number(start) < recentCutoff) return total;
    return total + sumCounts(counts);
  }, 0);
  const sessionTotal = sumCounts(sessionCounts);
  const selectedTotal = localData.badgePeriod === 'session' ? sessionTotal : hourTotal;
  const badge = selectedTotal > 999 ? '999+' : String(selectedTotal);
  await Promise.all([
    chrome.action.setBadgeText({ text: badge }),
    chrome.action.setTitle({ title: `Jev X Post Filter · ${hourTotal} positive category detections in the last hour · ${sessionTotal} this session` })
  ]);
}

function sumCounts(counts) {
  return Object.values(counts || {}).reduce((total, value) => total + (Number(value) || 0), 0);
}
