const mysql = require("mysql2/promise");

const pool = mysql.createPool(process.env.DATABASE_URL);

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error);
  }
};

module.exports = { pool, testConnection };
