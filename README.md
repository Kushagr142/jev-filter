# Jev X Post Filter

A Chrome extension that asks TypeSafe Jev 1.13, through OpenRouter, whether X posts match your categories. Matching posts receive a red highlight.

## Requirements

- Google Chrome or another Chromium-based browser with Manifest V3 extension support.
- Chrome 102 or newer (needed for session storage of the API key).
- An OpenRouter account and API key with access to `typesafe/jev-1.13`.
- This project folder (`manifest.json`, `popup.html`, `popup.css`, `popup.js`, `content.js`, `background.js`, and the `stats.*` files). No build step or package installation is needed.

## Install the package in Chrome

1. Download or clone this project and keep the extension files together in one folder.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** using the switch near the top-right of the page.
4. Click **Load unpacked** and select the project folder containing `manifest.json`.
5. Pin **Jev X Post Filter** from Chrome's Extensions menu if you want quick access to its settings.

## Configure the extension

1. Create an API key in your [OpenRouter account](https://openrouter.ai/keys).
2. Open the extension popup from Chrome's toolbar.
3. Paste the OpenRouter API key into the key field.
4. Enter between one and five categories. Use a short description for each, for example:
   - `posts about artificial intelligence`
   - `posts about cooking`
   - `posts discussing baseball`
5. Click **Save settings**.
6. Open or refresh [x.com](https://x.com) to start classifying posts.

Categories are saved in Chrome's local extension storage. The API key is held in Chrome session storage, which is cleared when the browser session ends, and can also be removed with **Forget API key**. The key is only read by the extension service worker and sent to OpenRouter in classification requests. Each classified post uses your OpenRouter account. Jev evaluates each category separately, and a post is highlighted if any category's returned probability is at least `0.5`.

## Detection counts

The toolbar badge counts positive classifier detections across all categories. In the popup, choose whether it displays the last hour or the current browser session; its tooltip shows both totals. Select **View hourly, daily, and weekly stats** for per-category counts grouped by the past 24 hours, 7 days, or 12 weeks. Hourly history is stored locally for up to 90 days, minute counts are kept locally for the rolling last hour, and session totals reset when the browser session ends. A post that matches multiple categories increments each matching classifier, and re-evaluating a post after a refresh or category change can count it again.

After updating from an earlier version, enter the API key again once. The update removes any key saved by the earlier version from local extension storage.

## Package for sharing

The extension does not need compiling. To share it privately, compress the project folder and have the recipient extract it before using **Load unpacked**. Do not include personal API keys in the folder or archive; each person should enter their own key in the popup.

For Chrome Web Store submission, use Chrome's **Pack extension** option on `chrome://extensions` or follow the [Chrome extension packaging guide](https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-your-own/). Store submission also requires a developer account and store listing details.

## Troubleshooting

- **The popup says settings are saved, but posts do not change:** refresh the X tab after saving settings. You must re-enter the API key after a browser restart.
- **The toolbar badge is zero:** it counts only positive classifier results. Open the statistics view to inspect the per-category totals and selected reporting period.
- **Posts are not highlighted:** the extension only handles post text visible to X in the current feed. Check that the API key is valid and that your OpenRouter account can use the selected model.
- **A request fails:** open Chrome DevTools on the X tab and check the Console for a `[Jev X Post Filter]` message. Refresh the page to retry failed posts.
- **You changed the extension files:** return to `chrome://extensions` and click the extension's reload icon, then refresh X.

## Privacy and data flow

The extension reads the text of X posts shown on the page and sends that text to OpenRouter for classification. Requests use `typesafe/jev-1.13`. This extension does not send posts to a separate server operated by this project. Review OpenRouter's current privacy and data handling terms before use. See [PRIVACY.md](PRIVACY.md) for the project's privacy disclosure. Before publishing in the Chrome Web Store, host that disclosure at a publicly accessible URL and complete the store's data use disclosures.
