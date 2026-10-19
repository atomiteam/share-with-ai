# Validation — 0.4.1

40 automated tests pass under Node 24 and Python 3.12.

Existing coverage: provider API pagination and fallback, attachment discovery, Jira Cloud direct-download URL normalization, TXT/binary preservation, video response validation, serialized source-tab errors, ZIP interoperability, safe filenames and offline HTML escaping.

New workflow and feedback coverage:

- Chrome download initiation does not produce premature success; completion must be confirmed.
- Completion events arriving before the download request resolves are handled.
- Unrelated download events are ignored; interrupted/cancelled saves and timeouts report errors and clean up listeners.
- Automatic export preserves original TXT/binary bytes and ticket details in the ZIP without rendering private content in the action UI.
- Attachment failures expose an error section and permission recovery; no incomplete ZIP is saved.
- AI handoff reuses an already completed ZIP and gives manual-attachment instructions.
- Clipboard/app-opening failures are reported accurately without claiming copying/upload success.
- Jira dashboards are rejected instead of exporting surrounding navigation content.

Runtime JavaScript syntax and upload-package manifest/entry checks pass. The browser workflow tests use mocked Chrome APIs and a minimal DOM, not an installed browser.

The user confirmed that 0.3.1 worked against their Jira/video attachment. The 0.4 action-screen redesign has not been visually or interactively verified in an installed Chrome browser here. Previous browser access disconnected; live integration and layout verification remain required.

0.4.1 increases limits to 250 MiB per file / 500 MiB total. Tests pack a 26 MiB log into a real ZIP, verify boundary and total-budget checks, display actual file size, and verify size errors never offer irrelevant permission buttons. Large attachments use extension-context transfer; the source-tab serialization fallback remains capped at 25 MiB to avoid oversized Chrome messages. No live browser test for 250 MiB files is claimed.
