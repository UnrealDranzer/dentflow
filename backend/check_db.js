import 'dotenv/config';
import { query } from './src/config/db.js';

async function checkClinic() {
  try {
    const res = await query('SELECT id, name, booking_slug, is_active FROM clinics', []);
    console.log('Clinics:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

checkClinic();
