const fields = Array.from({ length: 5 }, (_, i) => document.getElementById(`category${i + 1}`));
const status = document.getElementById('status');

Promise.all([
  chrome.storage.session.get('apiKey'),
  chrome.storage.local.get(['categories', 'badgePeriod', 'matchAction'])
]).then(([session, saved]) => {
  document.getElementById('apiKey').value = session.apiKey || '';
  const categories = saved.categories || [];
  fields.forEach((field, index) => { field.value = categories[index] || ''; });
  document.getElementById('badgePeriod').value = saved.badgePeriod || 'last-hour';
  document.getElementById('matchAction').value = saved.matchAction || 'highlight';
});

document.getElementById('settings').addEventListener('submit', (event) => {
  event.preventDefault();
  const apiKey = document.getElementById('apiKey').value.trim();
  const categories = [...new Set(fields.map((field) => field.value.trim()).filter(Boolean))];
  const badgePeriod = document.getElementById('badgePeriod').value;
  const matchAction = document.getElementById('matchAction').value;
  const saves = [chrome.storage.local.set({ categories, badgePeriod, matchAction })];
  if (apiKey) saves.push(chrome.storage.session.set({ apiKey }));
  Promise.all(saves).then(() => {
    if (!apiKey) return showStatus('Categories saved. Add an API key to classify posts.');
    showStatus(categories.length
      ? 'Settings saved. X will recheck visible posts.'
      : 'Categories cleared. Add a category to resume classification.');
  });
});

document.getElementById('forgetKey').addEventListener('click', () => {
  chrome.storage.session.remove('apiKey').then(() => {
    document.getElementById('apiKey').value = '';
    showStatus('API key forgotten for this browser session.');
  });
});

document.getElementById('openStats').addEventListener('click', () => chrome.runtime.openOptionsPage());

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
