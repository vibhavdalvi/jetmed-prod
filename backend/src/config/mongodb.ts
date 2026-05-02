import mongoose from 'mongoose';
import config from './index.js';
import '../mongo/activityLog.model.js';

/** True when we will attempt a Mongo connection (URI resolved non-empty). */
export const isMongoConfigured = (): boolean => Boolean(config.mongodb.uri?.trim());

export const connectMongoDB = async (): Promise<void> => {
  if (!config.mongodb.uri?.trim()) {
    if (process.env.MONGODB_VERBOSE === 'true') {
      console.log('MongoDB skipped (not configured).');
    }
    return;
  }

  try {
    await mongoose.connect(config.mongodb.uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 15000,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error: unknown) {
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    if (process.env.MONGODB_VERBOSE === 'true') {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`MongoDB unavailable (${msg}); continuing without activity audit logs`);
      console.warn(
        '   Atlas: Network Access → allow 0.0.0.0/0; verify MONGODB_URI user/password.'
      );
    }
  }
};

mongoose.connection.on('error', (err) => {
  if (process.env.MONGODB_VERBOSE === 'true') {
    console.error('MongoDB connection error:', err);
  }
});

mongoose.connection.on('disconnected', () => {
  if (process.env.MONGODB_VERBOSE === 'true') {
    console.log('MongoDB disconnected');
  }
});

export default mongoose;
