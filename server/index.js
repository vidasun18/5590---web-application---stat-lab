import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDatabase } from './models.js';
import { createApp } from './app.js';
try {
  await connectDatabase(config.mongoUri);
  const server = createApp().listen(config.port, config.host, () => console.log(`StatLab MERN: http://${config.host}:${config.port}\nMongoDB: ${config.mongoUri}`));
  server.on('error', error => { console.error(error.message); process.exit(1); });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (stopping) return; stopping = true; server.close(async () => { await mongoose.disconnect(); process.exit(0); }); setTimeout(() => process.exit(1), 8000).unref(); });
} catch (error) { console.error(`Cannot start StatLab: ${error.message}\nUse npm start to launch the project-local MongoDB instance.`); process.exit(1); }
