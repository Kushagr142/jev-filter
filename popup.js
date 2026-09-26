const fields = Array.from({ length: 5 }, (_, i) => document.getElementById(`category${i + 1}`));
const status = document.getElementById('status');

Promise.all([chrome.storage.session.get('apiKey'), chrome.storage.local.get('categories')]).then(([session, saved]) => {
  document.getElementById('apiKey').value = session.apiKey || '';
  const categories = saved.categories || [];
  fields.forEach((field, index) => { field.value = categories[index] || ''; });
});

document.getElementById('settings').addEventListener('submit', (event) => {
  event.preventDefault();
  const apiKey = document.getElementById('apiKey').value.trim();
  const categories = fields.map((field) => field.value.trim()).filter(Boolean);
  if (!apiKey) return showStatus('Add your OpenRouter API key.', true);
  Promise.all([
    chrome.storage.session.set({ apiKey }),
    chrome.storage.local.set({ categories })
  ]).then(() => showStatus(categories.length
    ? 'Settings saved. Refresh X to classify its posts.'
    : 'Categories cleared. Add a category to resume classification.'));
});

document.getElementById('forgetKey').addEventListener('click', () => {
  chrome.storage.session.remove('apiKey').then(() => {
    document.getElementById('apiKey').value = '';
    showStatus('API key forgotten for this browser session.');
  });
});

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}
