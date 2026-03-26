import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

async function testSlots() {
  try {
    console.log('--- Logging In ---');
    const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@dentflow.com',
      password: 'Admin@1234'
    });
    
    if (!loginRes.data.success) {
      console.error('Login failed');
      return;
    }
    
    const token = loginRes.data.data.token;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    console.log('--- Getting Services ---');
    const servicesRes = await axios.get(`${API_BASE_URL}/services`, config);
    const service = servicesRes.data.data.services[0];
    
    if (!service) {
      console.error('No services found');
      return;
    }
    console.log('Using Service:', service.service_name, 'ID:', service.id);

    console.log('\n--- Getting Available Slots ---');
    const date = '2026-03-27'; // Friday
    const slotsRes = await axios.get(`${API_BASE_URL}/appointments/available-slots`, {
      params: { date, service_id: service.id },
      ...config
    });
    
    console.log('Slots Result:', JSON.stringify(slotsRes.data, null, 2));
  } catch (err) {
    console.error('Error:', err.response?.status, err.response?.data || err.message);
  }
}

testSlots();
