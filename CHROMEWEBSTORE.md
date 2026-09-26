# Chrome Web Store preparation

## Single purpose

Highlight X posts that match up to five user-defined text categories using TypeSafe Jev 1.13 through OpenRouter.

## Permission justification

| Permission or access | Why it is needed |
| --- | --- |
| `storage` | Store user-defined categories and hold the user-provided OpenRouter key in session storage. |
| `alarms` | Refresh the badge and prune expired statistics once per minute. |
| X/Twitter content-script match patterns | Read visible post text and apply a matching highlight on X. |
| `https://openrouter.ai/*` host permission | Let the extension service worker send classification requests to OpenRouter. |

The content script match patterns are limited to X/Twitter. The extension does not request the `tabs`, `history`, `cookies`, `scripting`, or `<all_urls>` permissions.

## Data handling

- **Collected from page:** visible post text, only while the extension is active on an X/Twitter page with categories configured.
- **Sent to:** OpenRouter at `https://openrouter.ai/api/alpha/decisions`, using model `typesafe/jev-1.13`.
- **Purpose:** determine whether the post matches the user's categories.
- **Other recipients:** no project-operated server receives the data.
- **API key:** provided by the user, held in Chrome session storage, accessible to the extension service worker, and transmitted to OpenRouter as a bearer credential. It is cleared when the browser session ends or when the user selects **Forget API key**.
- **Categories:** saved in Chrome local extension storage.
- **Detection statistics:** aggregate positive counts by category and hour are stored locally for up to 90 days, with minute-level counts kept for the rolling last hour. Session totals stay in session storage. No post text or post IDs are included in the statistics.
- **Retention by this extension:** post text and classification results are not persisted by the extension; results are applied to the page DOM while the page is open.

## Before store submission

- Publish a public privacy policy that describes the data flow above and add its URL to the Developer Dashboard.
- Complete Chrome Web Store user data disclosures and justify each permission in the listing.
- Confirm current OpenRouter terms and retention settings for the account/provider used.
- Verify the final packaged extension in Chrome and ensure no API key or personal data is included in the package.
