# Privacy Policy

Last updated: September 26, 2026

Jev X Post Filter is a browser extension that classifies visible X posts according to categories you configure. This policy describes the extension's data handling.

## Data the extension processes

- **Post text:** The extension reads post text visible in your X/Twitter feed when you have saved categories and an OpenRouter API key. It sends the text to OpenRouter to obtain category scores. The extension limits each submitted post to 8,000 characters.
- **Categories:** Your category descriptions are saved in Chrome local extension storage so they remain available between browser sessions.
- **OpenRouter API key:** The key you enter is held in Chrome session storage and used by the extension service worker to authenticate requests to OpenRouter. It is cleared when the browser session ends or when you choose **Forget API key**. Updating from a previous version removes an older locally stored key.

## Service providers and purpose

Post text and your API key are sent to OpenRouter's Decisions API at `https://openrouter.ai/api/alpha/decisions` for inference with `typesafe/jev-1.13`. OpenRouter and the provider that handles a request process this information under their own terms and privacy practices. Review OpenRouter's current policies before use.

The extension developer does not operate a server and does not receive post text, category results, or API keys. The extension does not save post text or classification responses to persistent storage; it applies a highlight to the current page.

## Your choices

You can change or remove categories in the extension popup. Use **Forget API key** to clear the current session's key. Uninstalling the extension removes its stored categories. You can stop classification by removing all categories or uninstalling the extension.

## Contact

This project is distributed as source code. Add a maintainer contact address here before publishing the extension publicly.
