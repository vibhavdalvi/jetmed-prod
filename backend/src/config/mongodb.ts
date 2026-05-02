import mongoose from 'mongoose';
import config from './index.js';

/** Register all Mongoose models (side-effect imports). */
import '../models/index.js';
import '../mongo/activityLog.model.js';

export const isMongoConfigured = (): boolean => Boolean(config.mongodb.uri?.trim());

const MONGO_RETRIES = Number(process.env.MONGO_CONNECT_RETRIES || '15');
const MONGO_DELAY_MS = Number(process.env.MONGO_CONNECT_DELAY_MS || '2000');

export const connectMongoDB = async (): Promise<void> => {
  if (!config.mongodb.uri?.trim()) {
    console.error('MONGODB_URI is not set and MongoDB is not disabled. Set MONGODB_URI for MERN stack.');
    process.exit(1);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MONGO_RETRIES; attempt++) {
    try {
      await mongoose.connect(config.mongodb.uri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 15000,
      });
      console.log('✅ MongoDB connected successfully');
      return;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `⏳ MongoDB connect attempt ${attempt}/${MONGO_RETRIES} failed (${msg}). Retrying in ${MONGO_DELAY_MS}ms…`
      );
      if (attempt < MONGO_RETRIES) {
        await new Promise((r) => setTimeout(r, MONGO_DELAY_MS));
      }
    }
  }

  console.error('\n❌ FATAL: Could not connect to MongoDB. Set MONGODB_URI (e.g. Atlas) or run local mongod.\n');
  if (lastError) console.error(lastError);
  process.exit(1);
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  if (process.env.MONGODB_VERBOSE === 'true') {
    console.log('MongoDB disconnected');
  }
});

export default mongoose;
