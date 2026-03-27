import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function verifyFixes() {
  try {
    console.log('--- Testing Public Clinic Endpoint ---');
    const clinicRes = await axios.get(`${API_BASE_URL}/public/clinic/test`);
    console.log('Public Clinic Status:', clinicRes.status);
    console.log('Public Clinic Data:', JSON.stringify(clinicRes.data.data.clinic, null, 2));

    if (clinicRes.data.success) {
      const clinicId = clinicRes.data.data.clinic.id;
      const serviceId = clinicRes.data.data.services[0]?.id;
      
      console.log('\n--- Testing Available Slots Endpoint ---');
      // Note: This might need authentication if it's not the public slots endpoint
      // Using the one I just added to appointments.routes.js which might be protected
      // But I'll try it anyway. If it fails with 401, I'll know it exists.
      try {
        const date = new Date().toISOString().split('T')[0];
        const slotsRes = await axios.get(`${API_BASE_URL}/appointments/available-slots`, {
          params: { date, service_id: serviceId }
        });
        console.log('Slots Status:', slotsRes.status);
        console.log('Slots Count:', slotsRes.data.data.slots.length);
      } catch (err) {
        console.log('Slots Error (Expected if protected):', err.response?.status || err.message);
      }
    }
  } catch (err) {
    console.error('Final Error:', err.response?.status, err.response?.data || err.message);
  }
}

verifyFixes();
