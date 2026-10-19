# TicketPack — Share with AI

A local-first Chrome extension to download a ticket and its attachments as a ZIP, with optional handoff to an AI app.

Source: https://github.com/atomiteam/share-with-ai

## Install

Download `store/TicketPack-0.4.0-chrome-store.zip` and extract it to a permanent folder. Open `chrome://extensions`, enable Developer mode, choose Load unpacked and select the extracted folder containing `manifest.json`. Pin TicketPack.

For an existing installation, replace the files, click Reload in Chrome's extension settings, close old extension tabs and reopen the extension. Organization-managed browsers may restrict unpacked extensions. This repository does not imply Chrome Web Store approval.

## Two actions

Open an individual ticket and click the extension icon. The compact action page opens and starts the download automatically, preserving the previous one-click behavior.

- **Download:** Collect current ticket details and all discovered attachments, build the ZIP and wait for Chrome to confirm completion. Click again to create a fresh export.
- **Share with AI:** Choose ChatGPT, Claude, Gemini or Microsoft Copilot from the app menu. Reuse the ZIP already downloaded in this tab, or create one first. Copy an analysis prompt and open the selected AI app. Attach the ZIP manually and paste the prompt. If the app does not accept ZIP files, extract and attach ticket.md and relevant files individually.

The action page does not display the ticket title, description, fields, comments or attachment list. Inspect the content in the ZIP. Progress and completion appear in the status panel. Failures appear in a dedicated error section, with per-file reasons and host-permission buttons where applicable. Partial-capture notices appear separately.

No file is automatically uploaded to AI, and no AI message is sent. If copying the prompt fails, use AI-INSTRUCTIONS.txt in the ZIP. If opening the AI app fails after saving, the page confirms the ZIP is saved and allows retrying Share with AI without downloading it again.

## ZIP contents

- `ticket.html`: readable offline document; extract the ZIP before opening.
- `ticket.md`: text for AI tools and scripts.
- `ticket.json`: structured ticket metadata, fields and comments.
- `attachments/`: all discovered original files, with numbered safe filenames and SHA-256 checksums in metadata.
- `export-report.json`: capture mode and coverage warnings.
- `AI-INSTRUCTIONS.txt`: suggested analysis prompt.

Attachment failures stop the export; incomplete ZIPs are not saved. The ZIP uses standard uncompressed STORE entries. File sizes are capped at 25 MiB each and 150 MiB of attachment data per export. MP4 headers and known metadata sizes are checked; this is not a media decoder. Partial HTTP responses are retried or rejected. Blob/HLS/DASH previews alone are not original video attachments.

## Supported systems

| System | Implemented collection | Limits |
|---|---|---|
| Jira Cloud | REST v3, paginated comments, original attachment endpoints with redirect=false | Requires the signed-in session and API permissions |
| Jira Data Center | REST v2 fallback and /jira context paths | Instance/version-specific behavior needs verification |
| Jira Service Management | Jira adapter where the issue key is available | Portal permissions may restrict API access |
| Azure DevOps | Fields, paginated comments, AttachedFile relations | Open /_workitems/edit/ID; API 7.1 |
| GitLab | Issue API, paginated notes, Markdown attachment discovery | Root-host deployments; custom URL prefixes unsupported |
| GitHub | Public issue API and paginated comments | Private issues generally use visible-page fallback; browser cookies do not authenticate api.github.com |
| Linear, YouTrack, Redmine, Bugzilla | Partial visible-page capture | Layout-dependent; expand comments first |
| ServiceNow, Zendesk, Freshdesk/Freshservice, Salesforce Service Cloud | Partial visible-page capture | Frames, shadow DOM and unloaded content may be absent |
| Other | Generic partial page capture | No completeness guarantee |

Jira dashboards and issue-list pages are rejected rather than exported as tickets. Open the actual ticket. Recognized GitHub/GitLab/Azure DevOps list pages are also rejected. Provider detection is automatic; custom deployments may fall back to generic capture.

Partial captures are explicitly labeled in the UI and ZIP. There is no frame recursion, screenshot collection, linked-ticket traversal, revision-history backup, worklog export or segmented-video reconstruction. API comment collection stops after 100 pages and records truncation or page errors.

## Privacy and permissions

No developer backend, account, analytics, advertising or ticket persistence in Chrome storage. Processing happens in the action tab's memory; completed ZIPs are saved on your computer. Existing browser sessions authorize read-only requests, without extracting passwords or API tokens.

- activeTab and scripting: collect from the selected tab after clicking the icon.
- downloads: save ZIPs and observe when their save completes or fails.
- clipboardWrite: copy a prompt only after selecting an AI app.
- Optional HTTP/HTTPS host permissions: support arbitrary company-hosted ticket and attachment domains. Persistent access is requested for one exact host only after pressing its button in an error section.

Attachment downloads can follow redirects. Cookies may be sent to the applicable ticket/attachment hosts. SSO and cookie restrictions can still block downloads; original error messages are preserved. No automatic redaction is claimed. Ticket data can be confidential; inspect the ZIP before sharing it.

See [PRIVACY.md](PRIVACY.md) for the full policy.

## Development

No build dependencies. Node 20+ and Python 3 are sufficient.

```bash
npm test
python3 scripts/package.py
```

Packaging puts manifest.json at the upload ZIP root and excludes tests and development files. See TEST-RESULTS.md and store/SUBMISSION-STATUS.md for validation and publishing status.
