import { randomBytes, scrypt as rawScrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(rawScrypt);
export const token = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password, salt = token()) { return { salt, passwordHash: (await scrypt(password, salt, 64)).toString('hex') }; }
export async function verifyPassword(password, user) { const actual = Buffer.from((await hashPassword(password, user?.salt || 'invalid-user-salt')).passwordHash, 'hex'); const expected = Buffer.from(user?.passwordHash || '00'.repeat(64), 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected) && !!user; }
