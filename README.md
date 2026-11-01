# StatLab — MERN local demonstration

This is an independent MERN version of the StatLab project. All application source, dependencies, build output, logs and MongoDB database files live in **4307 test**. The original Python/SQLite project and its existing accounts are not changed or imported.

## Start the presentation

Double-click **START DEMO.cmd** in this folder. Keep its terminal open, then visit **http://127.0.0.1:4307**.

Click **Open demo workspace**, or sign in with:

| Field | Value |
| --- | --- |
| Username | `demo` |
| Email | `demo@statlab.local` |
| Password | `Demo4307!` |

The launcher starts the isolated local MongoDB instance, creates the demo account and five sample datasets on the first run, then starts Express and serves the compiled React application. Later starts preserve saved work and do not reset the account. After the initial installation, the prepared demonstration works without internet access. Plotly and styling are served locally.

PowerShell alternative:

```powershell
cd "C:\Users\amar\Documents\devops web\4307 test"
npm.cmd start
```

Press **Ctrl+C** in that terminal to stop the demo. Confirm the batch termination prompt if Windows displays one. Closing the terminal abruptly may cause MongoDB to recover its journal on the next start; use Ctrl+C when possible.

## Local database

| Setting | Value |
| --- | --- |
| MongoDB URI | `mongodb://127.0.0.1:27027/statlab_4307` |
| Database name | `statlab_4307` |
| Database files | `data/db/` inside this folder |
| MongoDB log | `.runtime/mongodb.log` |
| App/API | `http://127.0.0.1:4307` |
| React development server | `http://127.0.0.1:5307` when using `npm.cmd run dev` |

MongoDB Community Server 8.3 is already installed on this computer. The launcher detects its executable under `C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe`. It starts a separate instance on port **27027** and stores data in this folder. The existing Windows MongoDB service is left unchanged.

To inspect the data in **MongoDB Compass**, create a connection using the URI above. For `mongosh`:

```powershell
mongosh "mongodb://127.0.0.1:27027/statlab_4307"
```

```javascript
show collections
db.users.find({}, { username: 1, email: 1 })
db.datasets.find({}, { name: 1, revision: 1 })
db.analyses.find({}, { name: 1, dataset_revision: 1 })
```

Collections: `users`, `sessions`, `datasets`, `analyses`, `parameters`. Passwords use salted scrypt hashes. Session tokens are hashed in MongoDB and sent as HttpOnly cookies; records expire with a TTL index.

Configuration is in `.env`. `.env.example` documents the defaults and optional `MONGOD_PATH` override. Keep the database and app bound to loopback for this local presentation. No Atlas account, Python server, Docker, or cloud database is needed.

## What is implemented

- React pages for registration/login, dashboard, dataset library/editor, analysis settings/results, saved history, comparisons, and account settings.
- Private accounts, remember-me sessions, logout and password changes that invalidate sessions.
- Dataset create/read/update/delete, search, sorting, rename and duplication.
- Manual observations, editable multicolumn tables, rectangular Excel paste, UTF-8 CSV preview/import, exact frequencies and ordered class intervals.
- All 36 statistics from the original metric catalogue, implemented in JavaScript: descriptive statistics, sample/population spread, type-7 quantiles, corrected skewness/kurtosis, outliers, frequency tables, weighted means, Pearson/Spearman correlation and linear regression.
- Column selection, explicit missing-value policy, percentile positions, per-row weights and metric selection.
- Immutable saved analysis snapshots with revision conflicts and historical/current labels.
- Numerical/text custom parameters, units, formulas and descriptions, associated with a dataset or a saved analysis.
- Histogram, box, line, bar, scatter/regression, frequency and cumulative charts, with PNG download.
- Dataset/statistics CSV exports, paginated PDF reports with histogram and methodology, and print layouts.
- Responsive navigation and light/dark themes. Only the theme preference uses localStorage; authoritative data stays in MongoDB.

## Suggested five-minute demonstration

See **DEMO_GUIDE.md** for a walkthrough and expected numerical results.

## Project structure

```text
4307 test/
  client/
    src/                 React components and additional styling
    public/static/       Copied StatLab branding, CSS and local Plotly
    dist/                Production React build served by Express
    vite.config.js       React build and development API proxy
  server/
    app.js               Express REST API, validation and ownership
    models.js            Mongoose schemas and indexes
    security.js          Password hashing and session token helpers
    statistics.js        JavaScript calculation engine
    catalog.json         Metric definitions copied from the original
    conventions.json    Statistical policy
    reports.js           CSV and PDF generation
    seed.js              First-run sample workspace
    index.js             Server entry point
    config.js            Local environment configuration
  scripts/
    start.mjs            MongoDB + seed + application launcher
    mongo.mjs            Isolated MongoDB instance management
    check.mjs            JavaScript syntax checks
  tests/                 Statistical and real-MongoDB API tests
  data/db/               Persistent local MongoDB files
  .runtime/              Local logs, PIDs and npm cache
  START DEMO.cmd         Windows launcher
  package.json
  package-lock.json
  .env
```

## Development and verification

Node.js **22.12 or newer** and MongoDB Community Server are required on another machine. To install dependencies there:

```powershell
npm.cmd ci --cache .runtime/npm-cache --no-fund --no-audit
npm.cmd run build
npm.cmd start
```

For React hot reload, stop the normal launcher and run:

```powershell
npm.cmd run dev
```

Open **http://127.0.0.1:5307** in development mode. Vite proxies `/api` to Express on 4307. After frontend source edits, run `npm.cmd run build` before returning to the normal presentation launcher. Backend changes require a restart.

With the demo running, use another terminal:

```powershell
npm.cmd run check
npm.cmd test
```

The API integration suite requires MongoDB on 27027. It creates a separate process-specific `statlab_4307_test_<PID>` database and removes only that test database after verification. It does not reset the demonstration database. See **VERIFICATION.md** for the checks performed.

## API and architecture

The original endpoint names and JSON shapes are retained where practical; MongoDB ObjectId strings replace SQLite integer IDs. See **API.md** and **ARCHITECTURE.md** in this folder.

## Troubleshooting

- **MongoDB executable not found:** Install MongoDB Community Server, or set `MONGOD_PATH` in `.env`. MongoDB Shell alone does not include the database server. [Official MongoDB installation documentation](https://www.mongodb.com/docs/manual/installation/).
- **Port 4307 already in use:** Check whether another copy of this demo is running and close its terminal. The launcher reports the error instead of silently switching ports.
- **MongoDB does not start:** Read `.runtime/mongodb.log`. Ensure another process is not using port 27027 or this folder's `data/db` directory. Do not delete data to solve a port conflict.
- **PowerShell blocks npm.ps1:** Use `npm.cmd`, as shown above, or double-click the launcher.
- **Original credentials do not work:** This is a separate database. Use the demo account or register a new local account.
- **Demo password changed:** The seed script intentionally preserves existing accounts. Sign in with the password you set or create another account.

Limits match the original data model: 2 MB uploads/JSON, 10,000 rows or expanded frequencies, 32 columns, 100,000 cells. Undefined statistics include explanations. Class-interval statistics are midpoint estimates. Reports use the immutable calculation snapshot and the latest saved manual parameters. This local demo does not include email verification, password reset email, sharing, or cloud hosting.
#   5 5 9 0 - - - w e b - a p p l i c a t i o n - - - s t a t - l a b  
 