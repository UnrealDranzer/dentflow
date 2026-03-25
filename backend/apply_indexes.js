import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to database.');
    
    console.log('Creating index: idx_appointments_clinic_scheduled...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_clinic_scheduled ON appointments(clinic_id, scheduled_at)');
    
    console.log('Indexes applied successfully.');
  } catch (err) {
    console.error('Error applying indexes:', err);
  } finally {
    await client.end();
  }
}

run();
