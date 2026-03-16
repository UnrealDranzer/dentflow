const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL is not set in environment variables.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    console.log("Connecting to PostgreSQL database...");
    await client.connect();

    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    console.log(`Reading schema file from: ${schemaPath}`);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Dropping existing tables to ensure clean migration...");
    await client.query(`
      DROP TABLE IF EXISTS appointment_history CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS appointments CASCADE;
      DROP TABLE IF EXISTS doctor_leaves CASCADE;
      DROP TABLE IF EXISTS doctor_availability CASCADE;
      DROP TABLE IF EXISTS patients CASCADE;
      DROP TABLE IF EXISTS services CASCADE;
      DROP TABLE IF EXISTS doctors CASCADE;
      DROP TABLE IF EXISTS clinics CASCADE;
    `);

    console.log("Executing schema SQL...");
    // The pg driver can handle multiple statements if passed as a single string
    await client.query(sql);

    console.log("✅ Schema migration completed successfully.");

  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await client.end();
    console.log("Database connection closed.");
  }
}

migrate();
