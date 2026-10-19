# Chrome Web Store listing

Name: TicketPack — Share with AI

Summary: Export a ticket and its attachments to a local ZIP, then optionally open your AI app with a copied analysis prompt.

Category: Developer Tools
Language: English
Website: https://github.com/atomiteam/share-with-ai
Support: https://github.com/atomiteam/share-with-ai/issues
Privacy policy: https://github.com/atomiteam/share-with-ai/blob/main/PRIVACY.md

## Description

Take ticket context with you. Click TicketPack on an open ticket to capture its details, download attachments and create one ZIP on your computer.

The ZIP includes readable offline HTML, Markdown, structured JSON, selected original attachments and an export report. The compact action page provides Download and Share with AI. Ticket details stay in the ZIP; dedicated status and error sections show progress, confirmed completion and actionable failures.

API adapters are available for Jira, Azure DevOps, GitHub and GitLab. Private GitHub issues generally use partial visible-page capture without an API credential. Linear, YouTrack, Redmine, Bugzilla, ServiceNow, Zendesk, Freshdesk/Freshservice and Salesforce Service Cloud use partial visible-page capture. Hidden or unloaded content may be missing, and capture quality depends on the site's layout and permissions. Partial captures are labeled.

Optional AI handoff opens ChatGPT, Claude, Gemini or Microsoft Copilot and copies an analysis prompt. Attach the ZIP yourself. TicketPack never automatically uploads tickets or sends messages to an AI service. File support depends on your AI app and plan.

Local processing. No developer backend, account, analytics or advertising. Existing ticket permissions apply. Up to 250 MiB per file and 500 MiB of attachment data per export. Failed attachment downloads stop the export and show actionable errors. Success is shown only when Chrome confirms the ZIP download is complete.

TicketPack is an independent tool, not affiliated with Atlassian, Microsoft, GitHub, GitLab or the AI services mentioned.

## Single purpose

Export the currently selected support/development ticket and its accessible attachments as a local ZIP for user-controlled sharing.

## Permission explanations

- activeTab: Read the selected ticket page only after the user clicks the extension action; no background browsing collection.
- scripting: Run read-only collectors and same-origin attachment download fallback on that selected tab.
- downloads: Save the generated ZIP to the user's computer.
- clipboardWrite: Copy the analysis prompt only when the user selects AI handoff.
- Optional http://*/* and https://*/* hosts: Support customer-hosted ticket systems and attachment domains. No permanent hosts are granted at install; optional access is requested for an exact host when the user presses its permission button. Normal browsing is not monitored.
- Remote code: None. All executable code ships in the extension package.

## Privacy disclosure guidance

Be accurate about local access: the extension processes website content and may process personally identifiable information in ticket fields/comments/files. Do not claim it cannot access user data. No data is collected by a developer backend, sold, or used for advertising. Dashboard checkbox wording must be reviewed at submission time against PRIVACY.md.

## Reviewer instructions

Use a test Jira issue containing a small text file and a small MP4, or a public GitHub issue with an attachment. Sign into your own test ticket system if needed; TicketPack has no separate account. Click the action icon: a progress/review tab opens and download begins automatically. Check the ZIP's ticket.html, attachments/ and export-report.json. Denied attachment access must show an error, not a successful empty file. For private ticket systems inaccessible to reviewers, use a non-sensitive test system/account supplied by the publisher; do not supply production credentials.

## Remaining publisher tasks

- Complete Google sign-in and developer registration if not already registered.
- Verify publisher contact details and any required legal/trader declarations; do not invent them.
- Upload dist/TicketPack-0.4.1-chrome-store.zip.
- Upload a genuine, non-sensitive extension screenshot at a size accepted by the dashboard. Do not use screenshots of private company tickets.
- Complete privacy declarations, distribution and review notes.
- Submit for review. No review submission has yet been made by this repository.
