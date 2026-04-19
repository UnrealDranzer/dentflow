import 'dotenv/config';
import { query } from '../src/config/db.js';

async function checkUser() {
  try {
    const email = 'adarsh.ram.30@gmail.com';
    const res = await query('SELECT email FROM users WHERE email = $1', [email]);
    if (res.rows.length > 0) {
      console.log('User exists in database:', res.rows[0].email);
    } else {
      console.log('User DOES NOT exist in database.');
    }
  } catch (err) {
    console.error('Error checking user:', err);
  } finally {
    process.exit(0);
  }
}
checkUser();
