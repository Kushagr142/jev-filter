const HOUR_MS = 60 * 60 * 1_000;
const periodControl = document.getElementById('period');
let reportData = null;

periodControl.addEventListener('change', render);
chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'local' && (changes.statsBuckets || changes.statsRecentMinutes || changes.categories)) ||
      (area === 'session' && changes.statsSessionCounts)) loadStats();
});
window.setInterval(loadStats, 60_000);
loadStats();

function loadStats() {
  chrome.runtime.sendMessage({ type: 'jev:get-stats' }).then((result) => {
    if (result?.error) throw new Error(result.error);
    reportData = result;
    render();
  }).catch((error) => {
    document.getElementById('empty').hidden = false;
    document.getElementById('empty').textContent = error.message || 'Could not load detection statistics.';
  });
}

function render() {
  if (!reportData) return;
  const now = new Date();
  const rows = makeRows(periodControl.value, now, reportData.statsBuckets || {});
  const categories = [...new Set([
    ...(reportData.categories || []).filter((value) => typeof value === 'string' && value.trim()),
    ...Object.values(reportData.statsBuckets || {}).flatMap((counts) => Object.keys(counts || {}))
  ])];
  const sessionTotal = sum(reportData.sessionCounts);
  const hourTotal = Object.entries(reportData.recentMinutes || {}).reduce((total, [start, counts]) => {
    return Number(start) >= now.getTime() - HOUR_MS ? total + sum(counts) : total;
  }, 0);
  document.getElementById('sessionTotal').textContent = sessionTotal.toLocaleString();
  document.getElementById('hourTotal').textContent = hourTotal.toLocaleString();

  const titles = {
    hour: ['Hourly breakdown', 'Each row is an hour; columns are your classifiers.'],
    day: ['Daily breakdown', 'Each row is a local calendar day; columns are your classifiers.'],
    week: ['Weekly breakdown', 'Weeks run Monday through Sunday in your local time.']
  };
  document.getElementById('reportTitle').textContent = titles[periodControl.value][0];
  document.getElementById('reportDescription').textContent = titles[periodControl.value][1];

  const empty = categories.length === 0;
  document.getElementById('empty').hidden = !empty;
  document.getElementById('tableWrap').hidden = empty;
  if (empty) return;

  const totals = Object.fromEntries(categories.map((category) => [category, 0]));
  const head = `<thead><tr><th scope="col">Period</th>${categories.map((category) => `<th scope="col">${escapeHtml(category)}</th>`).join('')}<th scope="col">All</th></tr></thead>`;
  const body = rows.map((row) => {
    const cells = categories.map((category) => {
      const count = row.counts[category] || 0;
      totals[category] += count;
      return `<td>${count.toLocaleString()}</td>`;
    }).join('');
    return `<tr><th scope="row">${escapeHtml(row.label)}</th>${cells}<td class="total">${sum(row.counts).toLocaleString()}</td></tr>`;
  }).join('');
  const footer = `<tfoot><tr><th scope="row">Period total</th>${categories.map((category) => `<td>${totals[category].toLocaleString()}</td>`).join('')}<td>${sum(totals).toLocaleString()}</td></tr></tfoot>`;
  document.getElementById('tableWrap').innerHTML = `<table>${head}<tbody>${body}</tbody>${footer}</table>`;
}

function makeRows(period, now, statsBuckets) {
  const entries = Object.entries(statsBuckets).map(([start, counts]) => [Number(start), counts || {}]);
  if (period === 'hour') {
    const currentHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    return Array.from({ length: 24 }, (_, index) => {
      const start = currentHour - index * HOUR_MS;
      const label = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(start));
      return { label, counts: entries.find(([bucket]) => bucket === start)?.[1] || {} };
    });
  }
  if (period === 'day') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Array.from({ length: 7 }, (_, index) => {
      const start = new Date(today);
      start.setDate(start.getDate() - index);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const counts = aggregate(entries, start.getTime(), end.getTime());
      const label = index === 0 ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(start);
      return { label, counts };
    });
  }
  const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  thisMonday.setDate(thisMonday.getDate() - ((thisMonday.getDay() + 6) % 7));
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      label: `Week of ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)}`,
      counts: aggregate(entries, start.getTime(), end.getTime())
    };
  });
}

function aggregate(entries, start, end) {
  const counts = {};
  for (const [bucket, values] of entries) {
    if (bucket < start || bucket >= end) continue;
    for (const [category, count] of Object.entries(values)) counts[category] = (counts[category] || 0) + Number(count || 0);
  }
  return counts;
}

function sum(counts) {
  return Object.values(counts || {}).reduce((total, count) => total + (Number(count) || 0), 0);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
