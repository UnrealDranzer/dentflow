require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to Neon PostgreSQL");
    client.release();
  } catch (error) {
    console.error("❌ Database connection error:", error);
  }
}

module.exports = { pool, testConnection };