const mysql = require("mysql2/promise");

const connectionString = process.env.DATABASE_URL;

const pool = mysql.createPool({
  uri: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
}

module.exports = { pool, testConnection };