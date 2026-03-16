const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set.");
    }

    const client = await pool.connect();
    console.log("✅ Connected to Neon PostgreSQL");
    client.release();
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
  }
}

/**
 * Auto-initialize the database schema on first startup.
 * Checks if the 'clinics' table exists; if not, runs schema.sql.
 * All statements use CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING,
 * so this is fully idempotent and safe to run on every boot.
 */
async function initDB() {
  try {
    // Check if tables already exist
    const { rows } = await pool.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'clinics'
       ) AS table_exists`
    );

    if (rows[0].table_exists) {
      console.log("✅ Database tables already exist — skipping init.");
      return;
    }

    console.log("⏳ First startup: creating database tables...");

    const schemaPath = path.resolve(__dirname, "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      console.error("❌ schema.sql not found at:", schemaPath);
      return;
    }

    const sql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(sql);

    console.log("✅ Database schema created and seed data inserted.");
  } catch (error) {
    console.error("❌ Auto-init DB error:", error.message);
    // Don't crash the server — let it start so health checks work
    // and the issue can be debugged via logs
  }
}

module.exports = { pool, testConnection, initDB };