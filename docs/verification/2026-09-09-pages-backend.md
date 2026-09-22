# GitHub Pages / Sites split verification — September 9, 2026

Tracker: P6-14, **In progress**. The remaining access/setup step does not block
the existing Functional MVP.

## Published artifacts

- Compiled frontend: `damarindraab/f11`, `main`, commit
  `bb56a57` (normal SSH push succeeded).
- Backend: existing public Sites application, version 20, source
  `074172b40e7c4f6d31fc8a556693cb64b20caeaf`; deployment succeeded.
- Sites root: HTTP 200. Pages root: initially 404; now HTTP 200 after user activation.
- No access-policy change was needed; the Sites application was already public.

## Passed checks

- Repository and web typechecks; 138 tests across 26 files; lint with warnings
  and no errors. Static Pages and Sites Worker production builds succeed.
- Static index references resolve inside the release and use `/f11/`.
  Output consists of HTML, JS, CSS and the existing social image; no source
  maps or environment files. An in-memory scan found no configured private
  secret/token/password values in the static output.
- Built Worker and public Sites preflights: draft-challenges POST, runs/submit
  POST, saved-xi GET/PUT, opponents/nearby POST, asynchronous-matches GET/POST.
  Each returns 204 and allows exactly `https://damarindraab.github.io` with
  Authorization/Content-Type and the appropriate method.
- Public Sites malformed JSON returns 400 with readable CORS headers from the
  Pages origin; the same request from the Sites origin retains its 400 behavior.
  An unapproved origin receives 403.
- Existing trusted-ranking smoke executed against the hosted backend with
  `Origin: https://damarindraab.github.io` injected into game API calls, asserting
  CORS headers on each response. Legal replay, numeric Game Record configuration,
  duplicate idempotency, tampered actions/config rejection, unsupported-version
  rejection, server-owned private receipts, Statistic and Leaderboard readback
  all passed. No player tokens or private configuration were printed.

## Pages activation follow-up

The user enabled Pages. The root and referenced JS/CSS now return HTTP 200.
A browser guest signed in, received a Sites-issued draft, completed eleven
picks, and verified a 42-point result with leaderboard readback. The browser
also displayed a Cloud Save warning before and after drafting; diagnosis is
in progress, so P6-14 remains open.

A temporary local diagnostic build reproduced the warning as an Axios Network
Error without an HTTP response. A Node check with a fresh guest reached Cloud
Save and received the expected missing-record 404. Cloud Save preflights allowed
both Pages and Sites origins. This narrows the remaining issue to the browser
request path; the root cause is not established. Temporary instrumentation was
removed and was never uploaded. No further GitHub setting is indicated.
