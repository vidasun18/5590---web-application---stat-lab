import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
process.chdir(project);
if (!existsSync(path.join(project, '.env'))) { const { copyFileSync } = await import('node:fs'); copyFileSync(path.join(project, '.env.example'), path.join(project, '.env')); }
const { config } = await import('../server/config.js');
const { startMongo } = await import('./mongo.mjs');
const children = []; let stopping = false, ownedMongo = null;
async function stop(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of [...children].reverse()) if (child !== ownedMongo && child.exitCode === null) child.kill('SIGTERM');
  if (ownedMongo && ownedMongo.exitCode === null) {
    console.log('Shutting down the project-local MongoDB instance…');
    const { default: mongoose } = await import('mongoose');
    const connection = new mongoose.mongo.MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 1500 });
    try { await connection.connect(); await connection.db('admin').command({ shutdown: 1 }); } catch {} finally { await connection.close(); }
    const exited = new Promise(resolve => ownedMongo.once('exit', resolve));
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 2500))]);
    if (ownedMongo.exitCode === null) ownedMongo.kill('SIGTERM');
  }
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
function run(args) { return new Promise((resolve, reject) => { const p = spawn(process.execPath, args, { cwd: project, stdio: 'inherit', windowsHide: true }); children.push(p); p.on('error', reject); p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${args.join(' ')} exited with ${code}.`))); }); }
try {
  const mongo = await startMongo(); if (mongo) { ownedMongo = mongo; children.push(mongo); }
  const dev = process.argv.includes('--dev');
  if (!dev && !existsSync(path.join(project, 'client/dist/index.html'))) await run(['node_modules/vite/bin/vite.js', 'build', '--config', 'client/vite.config.js']);
  if (dev) { const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'client/vite.config.js'], { cwd: project, stdio: 'inherit', windowsHide: true }); children.push(vite); vite.on('exit', () => { if (!stopping) stop(1); }); }
  const server = spawn(process.execPath, ['server/index.js'], { cwd: project, stdio: 'inherit', windowsHide: true }); children.push(server);
  server.on('error', e => { console.error(e.message); stop(1); }); server.on('exit', code => { if (!stopping) stop(code || 0); });
  mkdirSync(path.join(project, '.runtime'), { recursive: true }); writeFileSync(path.join(project, '.runtime/launcher.pid'), String(process.pid));
  console.log(`\nOpen http://127.0.0.1:${dev ? 5307 : config.port}\nSign in with your account or choose Create an account.\nKeep this terminal open. Press Ctrl+C to stop.\n`);
} catch (e) { console.error(`\n${e.message}\nInstall MongoDB Community Server locally or set MONGOD_PATH in .env. See README.md.`); stop(1); }
