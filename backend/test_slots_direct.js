import 'dotenv/config';
import { getAvailableSlots } from './src/controllers/appointments.controller.js';

async function testDirect() {
  const req = {
    query: {
      date: '2026-03-27', // Friday
      service_id: '861a382e-9d2c-4903-888d-71286c75c88c', // A valid service UUID if exists
      doctor_id: 'any'
    },
    clinicId: 'd8be81e3-614e-447f-9af1-e98791ba5ff0' // Clinic "1234"
  };

  const res = {
    status: (code) => {
      console.log('Status:', code);
      return res;
    },
    json: (data) => {
      console.log('JSON Output:', JSON.stringify(data, null, 2));
      return res;
    }
  };

  const next = (err) => {
    console.error('Next called with error:', err);
  };

  try {
    console.log('--- Testing getAvailableSlots Directly ---');
    // First, let's get a real service ID from the DB to be sure
    import('./src/config/db.js').then(async (db) => {
      const svcRes = await db.query('SELECT id FROM services WHERE clinic_id = $1 LIMIT 1', [req.clinicId]);
      if (svcRes.rows.length > 0) {
        req.query.service_id = svcRes.rows[0].id;
        console.log('Using Service ID:', req.query.service_id);
        await getAvailableSlots(req, res, next);
      } else {
        console.error('No services found for this clinic');
      }
      process.exit(0);
    });
  } catch (err) {
    console.error('Execution Error:', err);
    process.exit(1);
  }
}

testDirect();
