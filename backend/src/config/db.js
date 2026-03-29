import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});


pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (duration > 500) {
    logger.warn('Slow query detected', { text, duration, rows: res.rowCount });
  }
  
  return res;
};

export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const checkDbConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    return { status: 'healthy', time: res.rows[0].now };
  } catch (err) {
    logger.error('Database connection failed', err);
    throw err;
  }
};

export default pool;
