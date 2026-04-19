import 'dotenv/config';
import { query } from './src/config/db.js';

async function migrate() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value BOOLEAN NOT NULL DEFAULT true
      );
    `);
    
    await query(`
      INSERT INTO settings (key, value) VALUES ('billing_enabled', true) ON CONFLICT (key) DO NOTHING;
    `);

    console.log('Settings table and billing_enabled toggler initialized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
