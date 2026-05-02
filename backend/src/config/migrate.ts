/**
 * Ensure MongoDB indexes (run in CI or once after deploy: npm run migrate)
 */
import mongoose from 'mongoose';
import config from './index.js';
import '../models/index.js';
import '../mongo/activityLog.model.js';

const run = async () => {
  if (!config.mongodb.uri?.trim()) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(config.mongodb.uri, { serverSelectionTimeoutMS: 15000 });
    console.log('🔌 Connected; syncing indexes...');
    const models = mongoose.modelNames();
    for (const name of models) {
      await mongoose.model(name).syncIndexes();
    }
    console.log('✅ Index sync complete');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('❌ Migrate failed:', e);
    process.exit(1);
  }
};

void run();
