require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool(process.env.DATABASE_URL);

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