import mongoose from 'mongoose';
const { Schema } = mongoose;
const options = { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false, minimize: false };
const ref = (name, required = true) => ({ type: Schema.Types.ObjectId, ref: name, required, index: true });
const user = new Schema({ username: { type: String, required: true }, usernameKey: { type: String, unique: true, required: true }, email: { type: String, unique: true, required: true }, passwordHash: { type: String, required: true }, salt: { type: String, required: true } }, options);
const session = new Schema({ tokenHash: { type: String, unique: true }, user: ref('User'), expiresAt: { type: Date, expires: 0 } }, options);
const dataset = new Schema({ owner: ref('User'), name: String, description: String, data: Schema.Types.Mixed, revision: { type: Number, default: 1 } }, options);
dataset.index({ owner: 1, updated_at: -1 });
const analysis = new Schema({ owner: ref('User'), dataset: ref('Dataset'), name: String, dataset_revision: Number, snapshot: Schema.Types.Mixed, calculation: Schema.Types.Mixed }, options);
const parameter = new Schema({ owner: ref('User'), dataset: ref('Dataset'), analysis: ref('Analysis', false), name: String, value: Schema.Types.Mixed, unit: String, formula: String, description: String }, options);
export const User = mongoose.model('User', user);
export const Session = mongoose.model('Session', session);
export const Dataset = mongoose.model('Dataset', dataset);
export const Analysis = mongoose.model('Analysis', analysis);
export const Parameter = mongoose.model('Parameter', parameter);
export async function connectDatabase(uri) { await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }); await Promise.all([User, Session, Dataset, Analysis, Parameter].map(model => model.init())); }
