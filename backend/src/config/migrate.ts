/**
 * Create/update tables from Sequelize models (no force — does not drop data).
 * Run against production once: DATABASE_URL=... npx tsx src/config/migrate.ts
 */
import sequelize from './postgres.js';
import '../models/index.js';

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('🔌 Connected; syncing schema (alter: true)...');
    await sequelize.sync({ alter: true });
    console.log('✅ Schema sync complete');
    process.exit(0);
  } catch (e) {
    console.error('❌ Migrate failed:', e);
    process.exit(1);
  }
};

void run();
