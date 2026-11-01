# Verification record

Verified locally on **1 November 2026** on this Windows computer.

## Automated checks

- `npm.cmd run build`: production React build succeeded with Vite; 43 modules transformed.
- `npm.cmd run check`: 13 server, launcher and test JavaScript files passed syntax checks.
- `npm.cmd test`: **29 tests passed, 0 failed, 0 skipped** against the actual local MongoDB process on port 27027.

The calculation tests cover the original reference experiment, interpolation conventions, corrected skewness and kurtosis, multimodal/no-mode cases, single observations, zero spread, nonpositive mean domains, weighted/missing data, correlation, tied ranks, regression, outliers, frequency expansion, interval estimates, invalid settings and numerical limits.

The API integration suite creates two separate accounts in a temporary process-specific test database. It verifies authentication and CSRF rejection, case-insensitive account uniqueness, HttpOnly sessions, dataset validation/search, owner isolation, server-calculated snapshots, stale-revision conflicts, historical snapshots, preserved manual parameters, parameter scope, duplication, paired comparison, CSV import/export safety, real PDF output, cascade cleanup, password/session invalidation and database reconnect persistence. Empty default settings are explicitly checked after a snapshot is stored and read back.

Only the specifically named `statlab_4307_test_<PID>` test database is dropped after tests. The seeded presentation database remains in place.

## Application and browser checks

- Started the exact **START DEMO.cmd** Windows entry point successfully.
- Confirmed `/` returns HTTP 200 and `/api/health` reports database `statlab_4307` on `127.0.0.1:27027`.
- Logged in using the **Open demo workspace** button.
- Created a numerical dataset through the React editor, calculated the reference results, saved a snapshot and added a numerical custom parameter through its dialog.
- Confirmed the reference mean of 30, population variance of 200 and sample variance of 250.
- Confirmed Plotly chart rendering and the chart controls.
- Compared **Experiment 01** and **Frequency example** through the UI; their means were 30 and 21 and population variances were 200 and 49.
- Checked browser error/warning logs during these workflows: none reported.
- Inspected the normal desktop layout and the mobile layout at a 390-pixel viewport override. The mobile document fit without page-wide horizontal overflow. Restored the default viewport afterward.
- Restarted the full MongoDB/application stack and reopened the retained reference analysis and its parameter.
- Exported a reference PDF and rendered every final page with Poppler. Verified the three-page layout, histogram, values, manual parameter, methodology, default settings and page numbering visually.

Temporary browser-test data was removed using its exact owned dataset identifier. The delivered demo workspace contains **five datasets, one saved reference analysis and one manual parameter**. Restarting preserves changes made during a later presentation.

## Isolation

The new application's files, dependencies, database data and logs are all under `4307 test`. The pre-existing Git status entries outside that folder were unchanged. The original Python/SQLite application and the installed MongoDB Windows service were not modified.

## Verification limits

The normal production presentation launcher was tested on this computer. Cloud hosting, another machine, LAN access, email services and a separate MongoDB installation were not tested or configured. The development hot-reload command is provided for editing; the demonstrated path is the compiled React app served by Express on port 4307.
