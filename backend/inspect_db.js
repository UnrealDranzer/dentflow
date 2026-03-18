require('dotenv').config({ path: './.env' });
const { pool } = require('./config/database');

async function testQuery() {
  try {
    const query = `INSERT INTO patients
      (clinic_id, name, phone, email, date_of_birth, gender, address, city, state,
       postal_code, medical_history, allergies, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING patient_id`;
    
    const values = [
      1, 'Test Patient', '1234567890', 'test@example.com', null, 
      'male', '123 Test St', 'Test City', 'Test State',
      '12345', 'No history', 'None', 'Some notes'
    ];

    console.log("Testing INSERT query...");
    await pool.query('BEGIN');
    try {
      const res = await pool.query(query, values);
      console.log("SUCCESS! Result:", res.rows[0]);
    } catch (err) {
      console.error("FAILURE! Error Code:", err.code);
      console.error("Error Message:", err.message);
      console.error("Error Position:", err.position);
      
      // If it's undefined_column, list the columns to verify
      if (err.code === '42703') {
        console.log("\nVerifying columns directly...");
        const columns = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'patients'
        `);
        console.log("Actual columns in DB:", columns.rows.map(r => r.column_name).join(', '));
      }
    }
    await pool.query('ROLLBACK');
    process.exit(0);
  } catch (err) {
    console.error("Script failed:", err);
    process.exit(1);
  }
}

testQuery();
