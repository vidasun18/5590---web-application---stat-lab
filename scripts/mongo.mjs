import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { root, config } from '../server/config.js';
const { MongoClient } = mongoose.mongo;
export async function ping(uri = config.mongoUri) { const c = new MongoClient(uri, { serverSelectionTimeoutMS: 800 }); try { await c.connect(); await c.db().command({ ping: 1 }); return true; } catch { return false; } finally { await c.close(); } }
function executable() {
  if (process.env.MONGOD_PATH && existsSync(process.env.MONGOD_PATH)) return process.env.MONGOD_PATH;
  const base = 'C:/Program Files/MongoDB/Server';
  if (process.platform === 'win32' && existsSync(base)) { for (const version of readdirSync(base).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) { const file = path.join(base, version, 'bin/mongod.exe'); if (existsSync(file)) return file; } }
  return 'mongod';
}
export async function startMongo() {
  if (await ping()) { console.log('Local MongoDB is already available.'); return null; }
  const uri = new URL(config.mongoUri), port = Number(process.env.MONGO_PORT || 27027);
  if (!['127.0.0.1', 'localhost'].includes(uri.hostname) || Number(uri.port || 27017) !== port) throw new Error('Configured database is unavailable. For the isolated demo use mongodb://127.0.0.1:27027/statlab_4307 and MONGO_PORT=27027.');
  const data = path.join(root, 'data/db'), runtime = path.join(root, '.runtime'); mkdirSync(data, { recursive: true }); mkdirSync(runtime, { recursive: true });
  console.log(`Starting isolated MongoDB on 127.0.0.1:${port}\nDatabase files: ${data}`);
  const child = spawn(executable(), ['--dbpath', data, '--port', String(port), '--bind_ip', '127.0.0.1', '--logpath', path.join(runtime, 'mongodb.log'), '--logappend'], { cwd: root, windowsHide: true, stdio: 'ignore' });
  let failure; child.on('error', e => { failure = e; }); child.on('exit', code => { if (code !== 0) failure = new Error(`mongod exited with code ${code}. See .runtime/mongodb.log.`); });
  for (let i = 0; i < 45; i++) { if (failure) throw failure; if (await ping()) { writeFileSync(path.join(runtime, 'mongodb.pid'), String(child.pid)); console.log('MongoDB is ready.'); return child; } await new Promise(resolve => setTimeout(resolve, 400)); }
  child.kill(); throw new Error('MongoDB did not become ready. Check .runtime/mongodb.log.');
}
