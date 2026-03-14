const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// Always try to load env locally for development runs.
// This is safe in production because providers (Railway/Render) inject env vars already.
// We explicitly try common locations so starting the server from repo root still works.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Add it to backend/.env for local dev or set it in your hosting provider env vars."
      );
    }
    const client = await pool.connect();
    console.log("✅ Connected to Neon PostgreSQL");
    client.release();
  } catch (error) {
    console.error("❌ Database connection error:", error);
  }
}

module.exports = { pool, testConnection };