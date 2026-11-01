import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4307),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27027/statlab_4307',
};
