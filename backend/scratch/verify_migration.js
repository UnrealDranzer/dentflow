import 'dotenv/config';
import { query } from '../src/config/db.js';

const result = await query(
  "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'appointments' AND column_name IN ('reminder_sent', 'reminder_sent_at') ORDER BY column_name"
);

console.log('✅ Columns verified:');
result.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type} (default: ${row.column_default})`));
process.exit(0);
