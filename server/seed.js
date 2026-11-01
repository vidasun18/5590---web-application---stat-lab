import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDatabase, User, Dataset, Analysis, Parameter } from './models.js';
import { hashPassword } from './security.js';
import { calculate } from './statistics.js';
export async function seedDemo() {
  const existing = await User.findOne({ usernameKey: 'demo' });
  if (existing) { console.log('Demo account already exists; saved work was preserved.'); return; }
  const user = await User.create({ username: 'demo', usernameKey: 'demo', email: 'demo@statlab.local', ...await hashPassword('Demo4307!') });
  const samples = [
    { name: 'Experiment 01', description: 'Reference measurements. Mean = 30; population variance = 200; sample variance = 250.', data: { kind: 'raw', columns: ['Value'], rows: [10, 20, 30, 40, 50].map(v => [v]) } },
    { name: 'Study hours & exam scores', description: 'Paired observations for correlation and linear regression.', data: { kind: 'raw', columns: ['Study hours', 'Exam score'], rows: [[1, 42], [2, 48], [3, 55], [4, 59], [5, 66], [6, 74], [7, 79], [8, 85], [9, 91], [10, 96]] } },
    { name: 'Manufacturing measurements', description: 'Quality control readings in millimetres. Explore the distribution and check for outliers.', data: { kind: 'raw', columns: ['Diameter (mm)'], rows: [9.8, 10.1, 10, 9.9, 10.2, 10, 10.1, 9.8, 10, 10.2, 9.9, 10.1, 10, 9.9, 12.5].map(v => [v]) } },
    { name: 'Frequency example', description: 'Exact observations represented with value frequencies.', data: { kind: 'frequency', columns: ['Value', 'Frequency'], rows: [[10, 2], [20, 5], [30, 3]] } },
    { name: 'Grouped class intervals', description: 'Midpoint estimates from ordered intervals. Results are explicitly marked estimated.', data: { kind: 'interval', columns: ['Lower', 'Upper', 'Frequency'], rows: [[10, 20, 2], [20, 30, 3], [30, 40, 4], [40, 50, 1]] } },
  ];
  for (const sample of samples) {
    const d = await Dataset.create({ ...sample, owner: user._id });
    if (sample.name === 'Experiment 01') {
      await Analysis.create({ owner: user._id, dataset: d._id, name: 'Experiment 01 · reference analysis', dataset_revision: 1, snapshot: sample, calculation: calculate(sample.data) });
      await Parameter.create({ owner: user._id, dataset: d._id, analysis: null, name: 'Experimental Error', value: 2.5, unit: '%', formula: 'Independent experimental estimate', description: 'Manual parameter; preserved when statistical results are recalculated.' });
    }
  }
  console.log('Created demo account and five sample datasets.');
}
try { await connectDatabase(config.mongoUri); await seedDemo(); } catch (e) { console.error(e.message); process.exitCode = 1; } finally { await mongoose.disconnect(); }
