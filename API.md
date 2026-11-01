# MERN API

Base URL: `http://127.0.0.1:4307/api`. Responses are JSON except successful file exports. Errors use `{ "error": "message" }`. IDs are MongoDB ObjectId strings.

First call **GET /me**. Keep its cookies, then send the returned `csrf_token` as the `X-CSRF-Token` header on every POST, PUT and DELETE, including registration and login. The browser UI handles this automatically. A 403 refreshes the token; retry the action after reviewing the error. Session cookies are HttpOnly and SameSite=Strict.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Live database ping, database name/host/port and stack |
| GET | `/me` | Current user or null and CSRF token |
| POST | `/signup` | `{ username, email, password }` |
| POST | `/login` | `{ identifier, password, remember? }` |
| POST | `/logout` | Delete current session |
| POST | `/profile/password` | `{ current_password, new_password }`; invalidates all sessions |
| GET | `/datasets` | List owned datasets; `search`, `sort=updated|created|name` |
| POST | `/datasets` | `{ name, description?, text }` or `{ name, description?, data }` |
| GET | `/datasets/:id` | Dataset, data, parameters and analysis count |
| PUT | `/datasets/:id` | Update with required current `revision`; stale values return 409 |
| DELETE | `/datasets/:id` | Dataset and associated analyses/parameters |
| POST | `/datasets/:id/duplicate` | Copy data and dataset-scoped parameters |
| POST | `/import/csv` | Multipart `file`, `header=true|false`, `delimiter`; validates and previews |
| GET | `/statistics/catalog` | All 36 metric definitions |
| POST | `/statistics/preview` | `{ text or data, settings? }`; transient calculation |
| POST | `/statistics/calculate` | `{ dataset_id, settings? }`; current calculation and revision |
| POST | `/datasets/compare` | `{ selections: [{ dataset_id, settings? }, ...] }`, 2–6 datasets |
| GET | `/analyses` | Saved analysis summaries with historical status |
| POST | `/analyses` | `{ name, dataset_id, dataset_revision, settings? }` |
| GET | `/analyses/:id` | Immutable snapshot and calculation; latest relevant parameters |
| DELETE | `/analyses/:id` | Delete snapshot; release its parameters to dataset scope |
| POST | `/analyses/:id/duplicate` | Copy snapshot and scoped parameters |
| GET | `/datasets/:id/parameters` | Dataset's custom parameters |
| POST | `/datasets/:id/parameters` | Add a custom parameter |
| PUT | `/parameters/:id` | Update a custom parameter |
| DELETE | `/parameters/:id` | Delete a custom parameter |
| GET | `/datasets/:id/export` | UTF-8 dataset CSV |
| GET | `/analyses/:id/export?format=csv` | Statistics, manual parameters and methodology CSV |
| GET | `/analyses/:id/export?format=pdf` | Saved analysis PDF with histogram |

All routes after logout in this table require authentication. Every resource lookup checks ownership; foreign or malformed identifiers return 404.

Dataset example:

```json
{
  "name": "Paired measurements",
  "description": "Trial observations",
  "data": {
    "kind": "raw",
    "columns": ["X", "Y"],
    "rows": [[1, 3], [2, 5], [3, 7]]
  }
}
```

Kinds are `raw`, `frequency` (value, frequency) and `interval` (lower, upper, frequency). Missing cells use null. Raw text columns are retained, but selected analysis columns must be numerical. CSV import previews data and does not automatically save a dataset.

Calculation settings example:

```json
{
  "column": 0,
  "y_column": 1,
  "missing": "drop",
  "percentiles": [5, 25, 50, 75, 95],
  "weights": [1, 2, 1],
  "statistics": ["count", "mean", "sample_variance", "pearson", "spearman", "regression", "weighted_mean"]
}
```

Column indices are zero-based. Omit `statistics` for all metrics. Weights require raw data and one entry per source row, including rows dropped under the missing policy. The calculation response includes results, explanations for undefined values, metric definitions, settings, conventions, summary, engine version and chart data.

Parameter example:

```json
{
  "name": "Experimental Error",
  "value": 2.5,
  "unit": "%",
  "formula": "Independent estimate",
  "description": "Measured separately",
  "analysis_id": null
}
```

Value may be a finite number or nonempty text. A supplied analysis ID must belong to the same dataset and owner. Updating an existing parameter uses the complete payload.
