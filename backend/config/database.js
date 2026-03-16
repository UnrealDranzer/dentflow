const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// Load environment variables from various possible paths
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

if (!process.env.DATABASE_URL) {
  console.error("❌ CRITICAL ERROR: DATABASE_URL is not defined in environment variables.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon
  },
});

/**
 * Detailed connection test for production logging
 */
async function testConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is missing.");
    }

    const client = await pool.connect();
    const { rows } = await client.query('SELECT NOW() as now');
    console.log(`✅ Connected to Neon PostgreSQL at: ${rows[0].now}`);
    client.release();
    return true;
  } catch (error) {
    console.error("❌ DATABASE CONNECTION ERROR DETAILS:");
    console.error(`- Message: ${error.message}`);
    console.error(`- Code: ${error.code || 'N/A'}`);
    console.error(`- Stack: ${error.stack}`);
    return false;
  }
}

/**
 * Auto-initialize the database schema.
 * Idempotent: checks for 'clinics' table before running schema.sql.
 */
async function initDB() {
  try {
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'clinics'
       ) AS table_exists`
    );

    if (rows[0].table_exists) {
      console.log("✅ Database schema already exists.");
      return;
    }

    console.log("⏳ Initializing database schema...");

    const schemaPath = path.resolve(__dirname, "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.error("❌ schema.sql not found at:", schemaPath);
      return;
    }

    const sql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(sql);

    console.log("✅ Database schema initialized successfully.");
  } catch (error) {
    console.error("❌ Auto-init DB error:", error.message);
    console.error(error.stack);
  }
}

module.exports = { pool, testConnection, initDB };