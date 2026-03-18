const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("CRITICAL STARTUP ERROR: DATABASE_URL environment variable is missing.");
}

// Simple and correct SSL handling for Neon/Render production
const sslConfig = { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

/**
 * Detailed connection test for production logging
 */
async function testConnection() {
  try {
    const client = await pool.connect();
    const { rows } = await client.query("SELECT NOW() AS now");
    console.log(`✅ Connected to Neon PostgreSQL at: ${rows[0].now}`);
    client.release();
    return true;
  } catch (err) {
    console.error("❌ DATABASE CONNECTION ERROR DETAILS:");
    console.error(`- Name: ${err.name}`);
    console.error(`- Message: ${err.message}`);
    console.error(`- Code: ${err.code || 'N/A'}`);
    console.error(`- Stack: ${err.stack}`);
    console.error("- Full Error:", err);
    return false;
  }
}

// Export strictly what was requested
module.exports = { 
  pool, 
  query: (text, params) => pool.query(text, params),
  testConnection 
};