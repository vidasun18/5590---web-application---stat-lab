# Verification record

Verified on **1 November 2026**, after removing the presentation setup.

## Automated checks

- `npm.cmd run check`: all 12 server, launcher and test JavaScript files passed syntax checks.
- `npm.cmd run build`: production React build succeeded; 43 modules transformed.
- `npm.cmd test`: **30 tests passed, 0 failed, 0 skipped**, using the real local MongoDB server on port 27027.

The statistics tests cover reference calculations, quantile interpolation, corrected skewness/kurtosis, mode handling, single observations, zero spread, nonpositive domains, weighted/missing data, correlation, tied ranks, regression, outliers, frequencies, interval estimates, invalid settings and numerical limits.

The API integration tests verify registration, incorrect-password rejection, case-insensitive account uniqueness, HttpOnly sessions, empty workspaces for new accounts, authentication and CSRF rejection, dataset validation/search, ownership isolation, server-calculated snapshots, stale-revision conflicts, historical snapshots, preserved parameters, parameter scope, duplication, comparison, CSV import/export safety, PDF output, cascade deletion, password/session invalidation and database reconnect persistence.

The API suite uses a separate process-specific `statlab_4307_test_<PID>` database and drops only that database after verification.

## Account and data cleanup

Removed the dedicated presentation account, its active session, five prepared datasets, one saved reference analysis and one custom parameter. Before and after hashes of every unrelated account, session, dataset, analysis and parameter matched. The personal account, its existing session and all four personal datasets were preserved.

The launcher no longer creates accounts or data. Registration creates empty private workspaces. The login page requires user-supplied credentials, and all editor modes start without prepared observations.

Live HTTP checks confirmed the application returns HTTP 200, database health is OK, and the served JavaScript bundle contains neither the old sign-in shortcut nor the prepared-data controls. Authentication with the removed account returns HTTP 401. Presentation helper scripts, screenshots and generated report artifacts were removed.

## Browser verification limit

A fresh browser check was attempted, but Computer Use stopped because it could not reliably determine the current browser URL on Windows. Interactive browser behavior has not been reverified after this change. The production build and automated API/statistics checks above passed.

Cloud hosting, LAN access, email services and another machine were not tested. The default application remains local to this computer.
