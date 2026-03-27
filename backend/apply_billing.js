import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    const sql = `
      -- Phase 3: Billing and Payments
      CREATE TABLE IF NOT EXISTS payments (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        razorpay_order_id   TEXT UNIQUE NOT NULL,
        razorpay_payment_id TEXT,
        razorpay_signature  TEXT,
        amount              NUMERIC(10,2) NOT NULL,
        currency            TEXT DEFAULT 'INR',
        status              TEXT DEFAULT 'created', -- created, paid, failed
        plan                TEXT NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON payments(clinic_id);
      CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(razorpay_order_id);
    `;

    await client.query(sql);
    console.log('✅ Payments table created successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
