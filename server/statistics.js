import { readFileSync } from 'node:fs';
export const metrics = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
export const conventions = JSON.parse(readFileSync(new URL('./conventions.json', import.meta.url), 'utf8'));
export class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function number(value) {
  if (!['string', 'number'].includes(typeof value) || (typeof value === 'string' && !value.trim())) throw new InputError('Enter a finite numerical value.');
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 1e100 || (n !== 0 && Math.abs(n) < 1e-100)) throw new InputError('Nonzero numerical values must have magnitudes between 1e-100 and 1e100.');
  return n;
}
export function parseText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1000000) throw new InputError('Enter numerical observations (at most 1 MB).');
  if (text.split(',').some(p => !p.trim())) throw new InputError('A comma-delimited value is missing.');
  const values = text.trim().split(/[,\s]+/).map(number);
  if (values.length > 10000) throw new InputError('At most 10,000 observations are allowed.');
  return values;
}
export function groupedValues(data) {
  if (data.columns.length !== (data.kind === 'frequency' ? 2 : 3)) throw new InputError('Frequency data needs value/frequency; intervals need lower/upper/frequency.');
  const values = []; let previous = -Infinity;
  for (const row of data.rows) {
    const nums = row.map(number); const frequency = nums.at(-1);
    if (!Number.isInteger(frequency) || frequency < 0 || frequency > 10000 || values.length + frequency > 10000) throw new InputError('Frequencies must be nonnegative integers; total frequency is limited to 10,000.');
    let value = nums[0];
    if (data.kind === 'interval') {
      if (nums[0] >= nums[1] || nums[0] < previous) throw new InputError('Intervals must be ordered and nonoverlapping, with lower < upper.');
      previous = nums[1]; value = nums[0] + (nums[1] - nums[0]) / 2;
    }
    for (let i = 0; i < frequency; i++) values.push(value);
  }
  if (!values.length) throw new InputError('At least one positive frequency is required.');
  return values;
}
export function validateDataset(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new InputError('A dataset object is required.');
  const kind = data.kind ?? 'raw';
  if (!['raw', 'frequency', 'interval'].includes(kind)) throw new InputError('Dataset kind must be raw, frequency, or interval.');
  if (!Array.isArray(data.columns) || data.columns.length < 1 || data.columns.length > 32 || data.columns.some(c => typeof c !== 'string' || !c.trim() || c.length > 80)) throw new InputError('Provide 1–32 column names, each 1–80 characters.');
  const columns = data.columns.map(c => c.trim());
  if (new Set(columns).size !== columns.length) throw new InputError('Column names must be unique.');
  if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length > 10000 || data.rows.length * columns.length > 100000) throw new InputError('Provide 1–10,000 rows and at most 100,000 cells.');
  const rows = data.rows.map((row, i) => {
    if (!Array.isArray(row) || row.length !== columns.length) throw new InputError(`Row ${i + 1} does not match the column count.`);
    return row.map(v => {
      if (v === null || v === '') return null;
      if (typeof v === 'string') { if (v.length > 500) throw new InputError('Cells must be at most 500 characters.'); return v.trim() || null; }
      return number(v);
    });
  });
  const output = { kind, columns, rows };
  if (kind !== 'raw') groupedValues(output);
  return output;
}
export function sourceData(payload) { return payload.text !== undefined ? { kind: 'raw', columns: ['Value'], rows: parseText(payload.text).map(v => [v]) } : validateDataset(payload.data); }
export function sum(values) { let total = 0, correction = 0; for (const v of values) { const next = total + v; correction += Math.abs(total) >= Math.abs(v) ? (total - next) + v : (v - next) + total; total = next; } return total + correction; }
export function quantile(ordered, p) { p = number(p); if (p < 0 || p > 100) throw new InputError('Percentiles must be between 0 and 100.'); const h = (ordered.length - 1) * p / 100, j = Math.floor(h); return ordered[j] + (h - j) * (ordered[Math.min(j + 1, ordered.length - 1)] - ordered[j]); }
function ranks(values) { const sorted = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), result = []; for (let i = 0; i < sorted.length;) { let j = i + 1; while (j < sorted.length && sorted[j][0] === sorted[i][0]) j++; for (let k = i; k < j; k++) result[sorted[k][1]] = (i + j + 1) / 2; i = j; } return result; }
function paired(x, y) {
  const n = x.length, mx = sum(x) / n, my = sum(y) / n;
  const sx = Math.sqrt(sum(x.map(v => (v - mx) ** 2)) / n), sy = Math.sqrt(sum(y.map(v => (v - my) ** 2)) / n);
  const r = n > 1 && sx > 0 && sy > 0 ? Math.max(-1, Math.min(1, sum(x.map((v, i) => ((v - mx) / sx) * ((y[i] - my) / sy))) / n)) : null;
  const slope = n > 1 && sx > 0 ? sum(x.map((v, i) => ((v - mx) / sx) * (y[i] - my))) / n / sx : null;
  return [r, slope === null ? null : { slope, intercept: my - slope * mx, r_squared: r === null ? null : r * r }];
}
export function calculate(source, settings = {}) {
  const data = validateDataset(source);
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new InputError('Calculation settings must be an object.');
  const column = settings.column ?? 0, ycolumn = settings.y_column ?? null, missing = settings.missing ?? 'reject';
  if (!Number.isInteger(column) || column < 0 || column >= data.columns.length) throw new InputError('Select a valid numerical column.');
  if (ycolumn !== null && (!Number.isInteger(ycolumn) || ycolumn < 0 || ycolumn >= data.columns.length || ycolumn === column)) throw new InputError('Select a different valid second column.');
  if (!['reject', 'drop'].includes(missing)) throw new InputError('Missing policy must be reject or drop.');
  if (data.kind !== 'raw' && (ycolumn !== null || settings.weights != null)) throw new InputError('Paired and weighted analysis require raw data.');
  let values = [], ys = [], included = [], excluded = 0;
  if (data.kind !== 'raw') values = groupedValues(data);
  else data.rows.forEach((row, i) => {
    if (row[column] === null || (ycolumn !== null && row[ycolumn] === null)) { if (missing === 'reject') throw new InputError(`Row ${i + 1} has a missing selected value. Correct it or choose Drop missing rows.`); excluded++; return; }
    values.push(number(row[column])); if (ycolumn !== null) ys.push(number(row[ycolumn])); included.push(i);
  });
  if (!values.length) throw new InputError('No numerical observations remain.');
  const n = values.length, ordered = [...values].sort((a, b) => a - b), mean = sum(values) / n, median = quantile(ordered, 50);
  const pv = sum(values.map(v => (v - mean) ** 2)) / n, ps = Math.sqrt(pv), sv = n > 1 ? pv * n / (n - 1) : null, ss = sv === null ? null : Math.sqrt(sv);
  const q1 = quantile(ordered, 25), q3 = quantile(ordered, 75), iqr = q3 - q1, counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  const maxFrequency = Math.max(...counts.values()), z = ps > 0 ? values.map(v => (v - mean) / ps) : null;
  const percentiles = settings.percentiles ?? [5, 25, 50, 75, 95];
  if (!Array.isArray(percentiles) || !percentiles.length || percentiles.length > 100) throw new InputError('Choose 1–100 percentiles.');
  let cumulative = 0;
  const frequency = [...counts].sort((a, b) => a[0] - b[0]).map(([value, f]) => ({ value, frequency: f, relative: f / n, cumulative: cumulative += f }));
  const positive = ordered[0] > 0;
  const results = {
    count: n, sum: sum(values), minimum: ordered[0], maximum: ordered.at(-1), range: ordered.at(-1) - ordered[0], mean, median,
    mode: maxFrequency > 1 ? [...counts].filter(([, f]) => f === maxFrequency).map(([v]) => v).sort((a,b)=>a-b) : null,
    midrange: (ordered[0] + ordered.at(-1)) / 2, population_variance: pv, sample_variance: sv, population_std: ps, sample_std: ss,
    mean_absolute_deviation: sum(values.map(v => Math.abs(v - mean))) / n,
    median_absolute_deviation: quantile(values.map(v => Math.abs(v - median)).sort((a, b) => a - b), 50),
    iqr, coefficient_of_variation: ss !== null && mean !== 0 ? 100 * ss / Math.abs(mean) : null, q1, q2: median, q3,
    percentiles: Object.fromEntries(percentiles.map(p => [String(number(p)), quantile(ordered, p)])),
    deciles: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [(i + 1) * 10, quantile(ordered, (i + 1) * 10)])),
    zscores: z, five_number_summary: [ordered[0], q1, median, q3, ordered.at(-1)],
    skewness: n >= 3 && z ? Math.sqrt(n * (n - 1)) / (n - 2) * sum(z.map(v => v ** 3)) / n : null,
    excess_kurtosis: n >= 4 && z ? (n - 1) / ((n - 2) * (n - 3)) * ((n + 1) * (sum(z.map(v => v ** 4)) / n - 3) + 6) : null,
    standard_error: ss === null ? null : ss / Math.sqrt(n),
    iqr_outliers: values.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr), z_outliers: z ? values.filter((v, i) => Math.abs(z[i]) > 3) : null,
    frequency, geometric_mean: positive ? Math.exp(sum(values.map(Math.log)) / n) : null,
    harmonic_mean: positive ? n / sum(values.map(v => 1 / v)) : null,
    weighted_mean: null, pearson: null, spearman: null, regression: null,
  };
  if (settings.weights != null) {
    if (!Array.isArray(settings.weights) || settings.weights.length !== data.rows.length) throw new InputError('Supply one weight for every source row, including dropped rows.');
    const all = settings.weights.map(number); if (all.some(w => w < 0)) throw new InputError('Weights must be nonnegative.');
    const weights = included.map(i => all[i]), total = sum(weights); if (total <= 0) throw new InputError('Included weights must have a positive sum.');
    results.weighted_mean = sum(values.map((v, i) => v * (weights[i] / total)));
  }
  if (ycolumn !== null) { [results.pearson, results.regression] = paired(values, ys); [results.spearman] = paired(ranks(values), ranks(ys)); }
  const selected = settings.statistics ?? Object.keys(metrics);
  if (!Array.isArray(selected) || !selected.length || selected.some(k => typeof k !== 'string' || !Object.hasOwn(metrics, k))) throw new InputError('Select at least one supported statistic.');
  const issues = {};
  for (const key of selected) {
    if (typeof results[key] === 'number' && !Number.isFinite(results[key])) { results[key] = null; issues[key] = 'Result exceeds finite floating-point range.'; }
    if (results[key] === null && !issues[key]) issues[key] = key === 'mode' ? 'No mode: every observation occurs once.' : metrics[key].description;
  }
  return { results: Object.fromEntries(selected.map(k => [k, results[k]])), issues, catalog: Object.fromEntries(selected.map(k => [k, metrics[k]])), algorithm_version: 'mern-1.0.0', conventions, settings,
    summary: { count: n, excluded_rows: excluded, column: data.columns[column], y_column: ycolumn === null ? null : data.columns[ycolumn], estimated: data.kind === 'interval', kind: data.kind },
    chart_data: { values, y: ys, frequency, five_number_summary: results.five_number_summary } };
}
