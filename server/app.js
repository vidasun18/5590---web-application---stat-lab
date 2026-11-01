import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config, root } from './config.js';
import { User, Session, Dataset, Analysis, Parameter } from './models.js';
import { token, digest, hashPassword, verifyPassword } from './security.js';
import { InputError, sourceData, validateDataset, calculate, metrics, groupedValues, number } from './statistics.js';
import { csv, reportCsv, reportPdf } from './reports.js';

const cookie = { httpOnly: true, sameSite: 'strict', path: '/' };
const sessionCookie = 'statlab4307_session', csrfCookie = 'statlab4307_csrf';
const clean = (value, maximum, required = false) => { if (typeof value !== 'string' || value.length > maximum || (required && !value.trim())) throw new InputError(`Enter ${required ? '1' : '0'}–${maximum} characters.`); return value.trim(); };
const password = value => { if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new InputError('Password must contain 8–128 characters.'); return value; };
const id = value => { if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw new InputError('Resource not found.', 404); return value; };
const userJson = user => user ? { id: String(user._id), username: user.username, email: user.email } : null;
const parameterJson = p => ({ id: String(p._id), dataset_id: String(p.dataset), analysis_id: p.analysis ? String(p.analysis) : null, name: p.name, value: p.value, unit: p.unit, formula: p.formula, description: p.description, created_at: p.created_at, updated_at: p.updated_at });
const datasetJson = async (d, full = true) => ({ id: String(d._id), name: d.name, description: d.description, revision: d.revision, kind: d.data.kind, columns: d.data.columns, row_count: d.data.rows.length, observation_count: d.data.kind === 'raw' ? d.data.rows.length : groupedValues(d.data).length, analysis_count: await Analysis.countDocuments({ dataset: d._id, owner: d.owner }), created_at: d.created_at, updated_at: d.updated_at, ...(full ? { data: d.data, parameters: (await Parameter.find({ dataset: d._id, owner: d.owner }).lean()).map(parameterJson) } : {}) });
const analysisJson = async (a, full = true) => {
  const d = await Dataset.findOne({ _id: a.dataset, owner: a.owner }).lean();
  return { id: String(a._id), name: a.name, dataset_id: String(a.dataset), dataset_name: d?.name || a.snapshot.name, dataset_revision: a.dataset_revision, historical: !d || d.revision !== a.dataset_revision, summary: a.calculation.summary, created_at: a.created_at, ...(full ? { calculation: a.calculation, snapshot: a.snapshot, parameters: (await Parameter.find({ owner: a.owner, dataset: a.dataset, $or: [{ analysis: null }, { analysis: a._id }] }).lean()).map(parameterJson) } : {}) };
};
export function createApp() {
  const app = express(); app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'], workerSrc: ["'self'", 'blob:'], connectSrc: ["'self'"], upgradeInsecureRequests: null } }, crossOriginEmbedderPolicy: false }));
  app.use(express.json({ limit: '2mb' }), cookieParser());
  app.get('/api/health', async (req, res) => { await mongoose.connection.db.admin().ping(); res.json({ status: 'ok', stack: 'MongoDB / Express / React / Node.js', database: mongoose.connection.name, database_host: mongoose.connection.host, database_port: mongoose.connection.port }); });
  app.use('/api', async (req, res, next) => {
    let csrf = req.cookies[csrfCookie]; if (!/^[a-f0-9]{64}$/.test(csrf || '')) { csrf = token(); res.cookie(csrfCookie, csrf, cookie); } req.csrf = csrf;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers['x-csrf-token'] !== csrf) throw new InputError('CSRF token expired. Refresh the page and retry.', 403);
      if (req.headers.origin && ![`http://127.0.0.1:${config.port}`, `http://localhost:${config.port}`, 'http://127.0.0.1:5307', 'http://localhost:5307'].includes(req.headers.origin)) throw new InputError('Request origin is not allowed.', 403);
    }
    if (req.cookies[sessionCookie]) {
      const session = await Session.findOne({ tokenHash: digest(req.cookies[sessionCookie]), expiresAt: { $gt: new Date() } }).lean();
      if (session) req.user = await User.findById(session.user).lean();
    }
    next();
  });
  const attempts = rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many account attempts. Try again in 15 minutes.' } });
  app.get('/api/me', (req, res) => res.json({ user: userJson(req.user), csrf_token: req.csrf }));
  app.post('/api/signup', attempts, async (req, res) => {
    const username = clean(req.body.username, 32, true), email = clean(req.body.email, 254, true).toLowerCase();
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) throw new InputError('Username must contain 3–32 letters, numbers, or underscores.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError('Enter a valid email address.');
    await User.create({ username, usernameKey: username.toLowerCase(), email, ...await hashPassword(password(req.body.password)) }); res.status(201).json({ ok: true });
  });
  app.post('/api/login', attempts, async (req, res) => {
    const identifier = clean(req.body.identifier, 254, true).toLowerCase();
    if (typeof req.body.password !== 'string' || req.body.password.length > 128) throw new InputError('Enter your password.');
    const user = await User.findOne({ $or: [{ usernameKey: identifier }, { email: identifier }] }).lean();
    if (!await verifyPassword(req.body.password, user)) throw new InputError('Incorrect username, email, or password.', 401);
    const value = token(), lifetime = (req.body.remember === true ? 30 * 24 : 12) * 3600000;
    if (req.cookies[sessionCookie]) await Session.deleteOne({ tokenHash: digest(req.cookies[sessionCookie]) });
    await Session.create({ tokenHash: digest(value), user: user._id, expiresAt: new Date(Date.now() + lifetime) });
    res.cookie(sessionCookie, value, { ...cookie, ...(req.body.remember === true ? { maxAge: lifetime } : {}) }); res.json({ user: userJson(user), csrf_token: req.csrf });
  });
  app.post('/api/logout', async (req, res) => { if (req.cookies[sessionCookie]) await Session.deleteOne({ tokenHash: digest(req.cookies[sessionCookie]) }); res.clearCookie(sessionCookie, cookie).json({ ok: true }); });
  app.use('/api', (req, res, next) => { if (!req.user) throw new InputError('Sign in to your workspace.', 401); next(); });
  const owned = async (Model, identifier, user) => { const record = await Model.findOne({ _id: id(identifier), owner: user._id }).lean(); if (!record) throw new InputError('Resource not found.', 404); return record; };
  app.post('/api/profile/password', async (req, res) => { if (typeof req.body.current_password !== 'string' || req.body.current_password.length > 128 || !await verifyPassword(req.body.current_password, req.user)) throw new InputError('Current password is incorrect.', 401); await User.updateOne({ _id: req.user._id }, await hashPassword(password(req.body.new_password))); await Session.deleteMany({ user: req.user._id }); res.clearCookie(sessionCookie, cookie).json({ ok: true }); });
  app.get('/api/datasets', async (req, res) => { let records = await Dataset.find({ owner: req.user._id }).sort({ updated_at: -1 }).lean(); if (req.query.search) records = records.filter(d => `${d.name} ${d.description}`.toLowerCase().includes(String(req.query.search).toLowerCase())); if (req.query.sort === 'name') records.sort((a, b) => a.name.localeCompare(b.name)); if (req.query.sort === 'created') records.sort((a, b) => b.created_at - a.created_at); res.json({ datasets: await Promise.all(records.map(d => datasetJson(d, false))) }); });
  app.post('/api/datasets', async (req, res) => { const d = await Dataset.create({ owner: req.user._id, name: clean(req.body.name, 120, true), description: clean(req.body.description ?? '', 2000), data: sourceData(req.body) }); res.status(201).json({ dataset: await datasetJson(d.toObject()) }); });
  app.get('/api/datasets/:id', async (req, res) => res.json({ dataset: await datasetJson(await owned(Dataset, req.params.id, req.user)) }));
  app.put('/api/datasets/:id', async (req, res) => {
    const existing = await owned(Dataset, req.params.id, req.user), data = req.body.data !== undefined || req.body.text !== undefined ? sourceData(req.body) : existing.data;
    const changed = JSON.stringify(data) !== JSON.stringify(existing.data);
    const updated = await Dataset.findOneAndUpdate({ _id: existing._id, owner: req.user._id, revision: req.body.revision }, { $set: { name: clean(req.body.name, 120, true), description: clean(req.body.description ?? '', 2000), data }, $inc: { revision: changed ? 1 : 0 } }, { returnDocument: 'after' }).lean();
    if (!updated) throw new InputError('This dataset changed. Reload before saving.', 409); res.json({ dataset: await datasetJson(updated) });
  });
  app.delete('/api/datasets/:id', async (req, res) => { const d = await owned(Dataset, req.params.id, req.user); await Analysis.deleteMany({ dataset: d._id, owner: req.user._id }); await Parameter.deleteMany({ dataset: d._id, owner: req.user._id }); await Dataset.deleteOne({ _id: d._id, owner: req.user._id }); res.json({ ok: true }); });
  app.post('/api/datasets/:id/duplicate', async (req, res) => { const d = await owned(Dataset, req.params.id, req.user), copy = await Dataset.create({ owner: req.user._id, name: d.name.slice(0, 110) + ' (copy)', description: d.description, data: d.data }); const params = await Parameter.find({ dataset: d._id, owner: req.user._id, analysis: null }).lean(); for (const p of params) { const { _id, created_at, updated_at, ...rest } = p; await Parameter.create({ ...rest, dataset: copy._id }); } res.status(201).json({ dataset: await datasetJson(copy.toObject()) }); });
  app.post('/api/import/csv', multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single('file'), (req, res) => {
    if (!req.file) throw new InputError('Choose a UTF-8 CSV file.'); const delimiter = req.body.delimiter || ','; if (![',', ';', '\t'].includes(delimiter)) throw new InputError('Unsupported CSV delimiter.');
    const rows = parse(new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer), { bom: true, delimiter, skip_empty_lines: true, relax_column_count: false });
    const columns = req.body.header !== 'false' ? rows.shift() : Array.from({ length: rows[0]?.length || 0 }, (_, i) => `Column ${i + 1}`);
    const data = validateDataset({ kind: 'raw', columns, rows }); res.json({ data, preview: data.rows.slice(0, 20), row_count: data.rows.length });
  });
  app.get('/api/statistics/catalog', (req, res) => res.json({ metrics }));
  app.post('/api/statistics/preview', (req, res) => res.json({ calculation: calculate(sourceData(req.body), req.body.settings) }));
  app.post('/api/statistics/calculate', async (req, res) => { const d = await owned(Dataset, req.body.dataset_id, req.user); res.json({ calculation: calculate(d.data, req.body.settings), dataset_revision: d.revision }); });
  app.post('/api/datasets/compare', async (req, res) => {
    if (!Array.isArray(req.body.selections) || req.body.selections.length < 2 || req.body.selections.length > 6) throw new InputError('Choose two to six datasets.');
    const comparisons = []; for (const s of req.body.selections) { if (!s || typeof s !== 'object') throw new InputError('Invalid comparison selection.'); const d = await owned(Dataset, s.dataset_id, req.user); comparisons.push({ dataset_id: String(d._id), name: d.name, revision: d.revision, calculation: calculate(d.data, s.settings) }); } res.json({ comparisons });
  });
  app.get('/api/analyses', async (req, res) => res.json({ analyses: await Promise.all((await Analysis.find({ owner: req.user._id }).sort({ created_at: -1 }).lean()).map(a => analysisJson(a, false))) }));
  app.post('/api/analyses', async (req, res) => { const d = await owned(Dataset, req.body.dataset_id, req.user); if (d.revision !== req.body.dataset_revision) throw new InputError('The dataset changed. Recalculate before saving.', 409); const a = await Analysis.create({ owner: req.user._id, dataset: d._id, name: clean(req.body.name, 120, true), dataset_revision: d.revision, snapshot: { name: d.name, description: d.description, data: d.data }, calculation: calculate(d.data, req.body.settings) }); res.status(201).json({ analysis: await analysisJson(a.toObject()) }); });
  app.get('/api/analyses/:id', async (req, res) => res.json({ analysis: await analysisJson(await owned(Analysis, req.params.id, req.user)) }));
  app.delete('/api/analyses/:id', async (req, res) => { const a = await owned(Analysis, req.params.id, req.user); await Parameter.updateMany({ analysis: a._id, owner: req.user._id }, { $set: { analysis: null } }); await Analysis.deleteOne({ _id: a._id, owner: req.user._id }); res.json({ ok: true }); });
  app.post('/api/analyses/:id/duplicate', async (req, res) => { const a = await owned(Analysis, req.params.id, req.user); const { _id, created_at, updated_at, ...rest } = a; const copy = await Analysis.create({ ...rest, name: a.name.slice(0, 110) + ' (copy)' }); for (const p of await Parameter.find({ owner: req.user._id, analysis: a._id }).lean()) { const { _id, created_at, updated_at, ...values } = p; await Parameter.create({ ...values, analysis: copy._id }); } res.status(201).json({ analysis: await analysisJson(copy.toObject()) }); });
  async function parameterValues(body, d, user) { let value = body.value; if (typeof value === 'string') value = clean(value, 1000, true); else value = number(value); const analysis = body.analysis_id ? (await owned(Analysis, body.analysis_id, user)) : null; if (analysis && String(analysis.dataset) !== String(d._id)) throw new InputError('The analysis must belong to this dataset.'); return { name: clean(body.name, 120, true), value, unit: clean(body.unit ?? '', 40), formula: clean(body.formula ?? '', 500), description: clean(body.description ?? '', 2000), analysis: analysis?._id || null }; }
  app.get('/api/datasets/:id/parameters', async (req, res) => { const d = await owned(Dataset, req.params.id, req.user); res.json({ parameters: (await Parameter.find({ dataset: d._id, owner: req.user._id }).lean()).map(parameterJson) }); });
  app.post('/api/datasets/:id/parameters', async (req, res) => { const d = await owned(Dataset, req.params.id, req.user); const p = await Parameter.create({ owner: req.user._id, dataset: d._id, ...await parameterValues(req.body, d, req.user) }); res.status(201).json({ parameter: parameterJson(p) }); });
  app.put('/api/parameters/:id', async (req, res) => { const p = await owned(Parameter, req.params.id, req.user), d = await owned(Dataset, String(p.dataset), req.user); const updated = await Parameter.findByIdAndUpdate(p._id, { $set: await parameterValues(req.body, d, req.user) }, { returnDocument: 'after' }); res.json({ parameter: parameterJson(updated) }); });
  app.delete('/api/parameters/:id', async (req, res) => { const p = await owned(Parameter, req.params.id, req.user); await Parameter.deleteOne({ _id: p._id, owner: req.user._id }); res.json({ ok: true }); });
  app.get('/api/datasets/:id/export', async (req, res) => { const d = await owned(Dataset, req.params.id, req.user); res.type('csv').attachment('statlab-dataset.csv').send(csv([d.data.columns, ...d.data.rows])); });
  app.get('/api/analyses/:id/export', async (req, res) => { const a = await analysisJson(await owned(Analysis, req.params.id, req.user)); if (req.query.format === 'pdf') reportPdf(res, a, req.user.username); else res.type('csv').attachment('statlab-analysis.csv').send(reportCsv(a)); });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  const dist = path.join(root, 'client', 'dist');
  if (existsSync(dist)) { app.use(express.static(dist)); app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html'))); }
  app.use((error, req, res, next) => { if (res.headersSent) return next(error); const status = error.code === 11000 ? 409 : error.status || (['MulterError', 'CsvError', 'TypeError', 'ValidationError', 'CastError'].includes(error.name) ? 400 : 500); if (status === 500) console.error(error); res.status(status).json({ error: error.code === 11000 ? 'That username or email is already registered.' : status === 500 ? 'The request could not be completed.' : error.message }); });
  return app;
}

