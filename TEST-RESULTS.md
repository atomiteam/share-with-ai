# Validation — 0.3.1

26 automated tests pass with Node 24 and Python 3.12:

- Jira paginated comments, attachment metadata, /jira context path and REST v2 fallback.
- GitLab nested project encoding and project-relative upload links.
- GitHub public API credential behavior and attachment discovery.
- Azure DevOps continuation tokens and attached-file relations.
- Partial comment retrieval preserves data and reports the failure.
- API failure falls back to explicitly labeled visible-page capture.
- ZIP binary, empty file and Unicode round trips through Python's independent ZIP reader, including CRC verification.
- ZIP traversal and duplicate path rejection; provider detection; offline HTML escaping and CSP.

JavaScript syntax checks pass for all runtime modules; manifest JSON is valid.

Additional 0.2 checks cover real Response streams for TXT and binary bytes, HTTP/login-page failures, size limits, visible attachment discovery including extensionless download links, and the entire automatic export control flow with mocked Chrome APIs. The automatic-flow test independently opens the generated ZIP using Python and checks the exact TXT and binary contents. A second flow test verifies that attachment failures prevent saving, unless explicitly overridden.

## Remaining verification

A headless browser smoke test was prepared but could not run: this environment had no Chromium executable, and the browser download returned invalid archive content. No browser-rendering, extension-action/activeTab grant, browser attachment transfer, clipboard, AI handoff or Chrome download UI pass is claimed. The collector tests use mocked API responses and a minimal DOM stub, not live provider instances. Visible-page selectors have not been validated against authenticated vendor UIs. Live SSO/cookie behavior and customer-specific layouts require testing after loading the unpacked extension.

Recommended first check: load unpacked in Chrome, open a non-sensitive Jira ticket containing one comment and one small attachment, click TicketPack, review the capture mode, export, extract, and inspect ticket.html plus export-report.json. Check AI handoff using a non-sensitive fixture first.

0.3 adds regression checks for a 1 KB JSON error disguised as MP4, size mismatch and empty video, full-range retry, persistent partial response rejection, and byte-preserving MP4 transfer. The MP4 fixture validates transfer and format checks, not playable media decoding. No live ticket/video test is claimed.

0.3.1 regression tests cover serialized network rejection, null source results, binary source-tab transfer, and normalized nonredirecting Jira Cloud URLs with preserved size metadata. All 26 tests pass; authenticated Jira Cloud video downloads remain unverified here.
