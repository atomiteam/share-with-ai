# TicketPack — Ticket to ZIP

A local-first Chrome Manifest V3 extension. Source repository: https://github.com/atomiteam/share-with-ai. Review a ticket, export its text and selected attachments as a ZIP, and optionally open an AI app with a copied prompt. Version 0.3.1 is an unpacked developer build, not a Chrome Web Store listing.

## Install (no Google review needed for local testing)

1. Extract `TicketPack-chrome-extension.zip` to a permanent folder.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**, click **Load unpacked**, and select the extracted folder containing `manifest.json`.
4. Pin TicketPack from Chrome's extensions menu.
5. Sign in to your ticket system, open one ticket, and click TicketPack.

Your organization may restrict developer-mode extensions. A public or unlisted Chrome Web Store release requires a developer account and Google review; this package has not been submitted. No Jira administrator installation is involved, although company browser and data policies still apply.

## Use

Keep the original ticket tab open. The extension opens a progress tab, captures the ticket, downloads detected attachments, and starts saving the ZIP automatically. Chrome download settings may still show a location prompt. No second Capture or Download click is needed. Select the correct provider manually if a custom domain is not recognized, then click Capture ticket. Review the capture mode and warnings. Edit the title and description, exclude fields, edit or exclude comments, and select attachments. For files hosted elsewhere, click the per-host permission button before downloading. Use Download ZIP to retry or export edited content. A detected attachment failure stops the export by default; grant permission/retry, or explicitly check Allow ZIP with failed attachments.

A downloaded ZIP contains `ticket.html`, `ticket.md`, `ticket.json`, `export-report.json`, `AI-INSTRUCTIONS.txt`, and selected files under `attachments/`. Open ticket.html after extracting the ZIP. Files get numbered safe names to avoid collisions; original names appear in the metadata. Attachment discovery includes arbitrary download links and binary files, and supplements API metadata with page attachment links. Successfully downloaded attachments have SHA-256 checksums. The report records downloaded, failed and excluded files. The ZIP uses the standard uncompressed STORE format for compatibility; already compressed attachments rarely benefit from recompression.

## AI handoff

Choose ChatGPT, Claude, Gemini or Microsoft Copilot and click **Download ZIP & open AI**. This starts the download, copies a prompt, and opens the chosen app. Complete/save the download, manually attach the ZIP and paste the prompt. No automatic upload, auto-send, AI credentials or AI API billing is involved. If the app/account does not accept ZIP files, extract the ZIP and attach ticket.md and relevant files individually. File size/type and plan limits depend on the AI app. The prompt is also in AI-INSTRUCTIONS.txt if clipboard access fails.

## Provider coverage — read this before relying on an export

| System | Collection implemented | Important limits |
|---|---|---|
| Jira Cloud | REST v3, paginated comments, attachment metadata | Requires access through the existing signed-in browser session; SSO/API policy may block it |
| Jira Data Center | REST v2 fallback; /jira context paths on /browse URLs | Instance/version specific behavior needs verification |
| Jira Service Management | Same Jira adapter where an issue key is present | Customer portal permissions may block API access; falls back to visible page |
| Azure DevOps | Work item fields, paginated comments, AttachedFile relations | Open a /_workitems/edit/ID URL; API 7.1; older Server versions may fall back |
| GitLab | Issue REST API, paginated notes; attachment links in Markdown | Signed-in session must permit API GET; root-host deployments; custom URL prefixes unsupported |
| GitHub | Public issue API and paginated comments; attachment links in Markdown | Browser cookies do not authenticate api.github.com. Private issues generally use visible-page fallback. No token storage is implemented |
| Linear | Visible-page capture | Partial, layout dependent |
| YouTrack | Visible-page capture | Partial, layout dependent |
| Redmine | Visible-page capture | Partial, layout dependent |
| Bugzilla | Visible-page capture | Partial, layout dependent |
| ServiceNow | Visible-page capture | Partial; framed/shadow DOM pages often need ticket/frame opened directly |
| Zendesk | Visible-page capture | Partial, layout dependent |
| Freshdesk / Freshservice | Visible-page capture | Partial, layout dependent |
| Salesforce Service Cloud | Visible-page capture | Partial; shadow DOM content may be inaccessible |
| Other / custom domains | Generic visible-page capture | Partial; no guarantee the page is a ticket |

Visible-page mode is intentionally labeled **PARTIAL**, both in the review UI and the exported files. Expand all comments/sections before capture. It cannot guarantee all comments, fields or files are present; it may include surrounding page text. Provider selectors are heuristics and may change. No screenshots, frame recursion, linked-ticket traversal, revision histories, worklogs, or segmented/DRM video reconstruction are implemented. Original video attachments and direct video file URLs are supported; blob/HLS/DASH previews alone are not downloadable originals. API mode also is not a complete audit backup; it exports current accessible fields and comments, not every product feature. Comment collection is capped at 100 pages and reports truncation. Any comment-page failure preserves previously collected comments with a warning.

## Authentication, attachments and privacy

- Read-only requests; no ticket edits or external server.
- Existing browser sessions are reused. No passwords, API tokens, cookie extraction, analytics, or persistent ticket storage.
- `activeTab` and `scripting`: read the tab only after clicking the extension icon. `downloads`: save the ZIP. `clipboardWrite`: copy the AI prompt.
- Optional HTTP/HTTPS host access is declared broadly to support arbitrary company instances, but external-host permission is requested individually, only when you press its button. Granted host permissions persist until revoked in Chrome's extension settings.
- Attachments download from the extension context first, with a source-tab fallback for same-origin files; external files require host permission. Session cookies may be sent to that attachment host. SSO, cross-origin redirects, signed URLs and browser cookie restrictions may still block downloads. Failures are recorded, not silently omitted.
- 25 MiB per attachment, 150 MiB cumulative attachment data. ZIP generation happens in memory. Large text/metadata can increase memory use; close finished review tabs.
- Ticket data remains in the review tab's memory until closed. The ZIP is saved to disk and can contain confidential information. Preview everything before export; no automatic redaction is claimed. Excluded attachment bytes and their direct download URLs are not included in the ZIP. Ticket text/fields may still contain references or links to them.
- Avoid opening untrusted attachments. ticket.html escapes source content and disables scripts and remote content with CSP. Original attachments retain their original contents.

## Development and validation

No build step, package installation or remote runtime dependencies. Source files are the installed extension. Run `npm test` with Node 20+ and Python 3 for ZIP interoperability/security tests. Run `python3 scripts/package.py` to build the store-upload ZIP with manifest.json at the archive root. See TEST-RESULTS.md for the checks performed on this build and remaining live-system verification.

To update: replace files in the installed folder, click Reload on chrome://extensions, and reopen the review page. Source changes do not automatically update an already installed copy. To uninstall, remove TicketPack in chrome://extensions.

## API references

- https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item?view=azure-devops-rest-7.1
- https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/comments/get-comments?view=azure-devops-rest-7.1
- https://docs.github.com/en/rest/issues
- https://docs.github.com/en/rest/issues/comments
- https://docs.gitlab.com/api/issues/
- https://docs.gitlab.com/api/notes/
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab

## Video integrity (0.3)

Downloads bypass the HTTP cache and retry a partial HTTP 206 response with a full-file range request. A remaining partial response, empty file, known metadata size mismatch, login/error document, or unrecognized MP4 header is rejected rather than archived as a successful video. MP4 checks validate the container header, not playback/codec integrity. Same-origin fallback responses go through the same validation. Limits remain 25 MiB per file and 150 MiB total; larger files cause an explicit failure.

## Jira Cloud download fix (0.3.1)

Jira Cloud attachment URLs use `/rest/api/3/attachment/content/ID?redirect=false` to request the file directly, rather than a media redirect. Duplicate page download links are normalized to the same endpoint. Source-tab errors are serialized explicitly; missing results cannot mask the original error with a null/base64 exception. Both extension and source-tab errors are displayed together. The per-file host permission button is also available for the source host if persistent access is needed.
