import { Sequelize } from 'sequelize';
import config from './index.js';

/** Railway/Docker often start the API before Postgres accepts connections — retry before exiting */
const PG_CONNECT_RETRIES = Number(process.env.POSTGRES_CONNECT_RETRIES || '20');
const PG_CONNECT_DELAY_MS = Number(process.env.POSTGRES_CONNECT_DELAY_MS || '2000');

const commonDefine = {
  timestamps: true,
  underscored: true,
  freezeTableName: true,
} as const;

function createSequelize(): Sequelize {
  const url = config.postgres.databaseUrl;

  const base = {
    dialect: config.postgres.dialect,
    logging: config.postgres.logging,
    pool: config.postgres.pool,
    define: { ...commonDefine },
  } as const;

  if (url) {
    return new Sequelize(url, {
      ...base,
    });
  }

  return new Sequelize(
    config.postgres.database,
    config.postgres.username,
    config.postgres.password,
    {
      ...base,
      host: config.postgres.host,
      port: config.postgres.port,
    }
  );
}

const sequelize = createSequelize();

if (config.postgres.databaseUrl) {
  console.log('📦 PostgreSQL: using DATABASE_URL');
} else {
  console.log(
    `📦 PostgreSQL: using POSTGRES_HOST=${config.postgres.host}:${config.postgres.port} (set DATABASE_URL on Railway for a single Postgres reference)`
  );
}

export const connectPostgres = async (): Promise<void> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PG_CONNECT_RETRIES; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ PostgreSQL connected successfully');

      if (config.app.env === 'development') {
        await sequelize.sync({ alter: true });
        console.log('✅ PostgreSQL models synchronized');
      }
      return;
    } catch (error) {
      lastError = error;
      const code =
        error &&
        typeof error === 'object' &&
        'parent' in error &&
        error.parent &&
        typeof error.parent === 'object' &&
        'code' in error.parent
          ? String((error.parent as { code?: string }).code)
          : '';
      const hint =
        code === 'ECONNREFUSED'
          ? ' (wrong POSTGRES_HOST/port or DB not reachable — use Railway Postgres private hostname, not localhost)'
          : '';
      console.warn(
        `⏳ PostgreSQL connect attempt ${attempt}/${PG_CONNECT_RETRIES} failed${hint}. Retrying in ${PG_CONNECT_DELAY_MS}ms…`
      );
      if (attempt < PG_CONNECT_RETRIES) {
        await new Promise((r) => setTimeout(r, PG_CONNECT_DELAY_MS));
      }
    }
  }

  console.error(
    '\n❌ FATAL: PostgreSQL unavailable after retries. The API exits here — not because of SendGrid/Firebase (those are optional).\n'
  );
  console.error(
    '   Best fix on Railway: add variable DATABASE_URL → Reference your Postgres service → DATABASE_URL (remove broken POSTGRES_* if unused).'
  );
  console.error(
    '   Or set POSTGRES_HOST to the DB private hostname (not localhost), matching PGPORT / credentials from the Postgres plugin.\n'
  );
  console.error(lastError);
  process.exit(1);
};

export default sequelize;
