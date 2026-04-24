const { pool } = require('../config/database');

const getDashboardOverview = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;

    const range = req.query.range || 'monthly';
    let revenueCondition = `EXTRACT(MONTH FROM a.appointment_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM a.appointment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;
    
    if (range === 'today') {
      revenueCondition = `a.appointment_date = CURRENT_DATE`;
    } else if (range === 'yesterday') {
      revenueCondition = `a.appointment_date = CURRENT_DATE - INTERVAL '1 day'`;
    } else if (range === 'weekly') {
      revenueCondition = `a.appointment_date >= CURRENT_DATE - INTERVAL '7 days' AND a.appointment_date <= CURRENT_DATE`;
    } else if (range === 'yearly') {
      revenueCondition = `EXTRACT(YEAR FROM a.appointment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;
    }

    // Parallel execution for dashboard cards
    const queries = [
      // Today's summary
      pool.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
         FROM appointments 
         WHERE clinic_id = $1 AND appointment_date = CURRENT_DATE`,
        [clinic_id]
      ),
      // Upcoming appointments (next 7 days)
      pool.query(
        `SELECT COUNT(*) as total FROM appointments 
         WHERE clinic_id = $1 AND appointment_date > CURRENT_DATE AND appointment_date <= CURRENT_DATE + INTERVAL '7 days'
         AND status IN ('scheduled', 'confirmed')`,
        [clinic_id]
      ),
      // New patients this month
      pool.query(
        `SELECT COUNT(*) as total FROM patients 
         WHERE clinic_id = $1 AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [clinic_id]
      ),
      // Filtered revenue
      pool.query(
        `SELECT COALESCE(SUM(s.price), 0) as total FROM appointments a
         JOIN services s ON a.service_id = s.service_id
         WHERE a.clinic_id = $1 AND a.status = 'completed'
         AND ${revenueCondition}`,
        [clinic_id]
      ),
      // Recent appointments
      pool.query(
        `SELECT a.*, p.name as patient_name, s.service_name FROM appointments a
         JOIN patients p ON a.patient_id = p.patient_id
         JOIN services s ON a.service_id = s.service_id
         WHERE a.clinic_id = $1 ORDER BY a.created_at DESC LIMIT 5`,
        [clinic_id]
      )
    ];

    const [today, upcoming, patients, revenue, recent] = await Promise.all(queries);

    res.json({
      success: true,
      data: {
        today: {
          total_appointments: parseInt(today.rows[0].total),
          scheduled: parseInt(today.rows[0].scheduled || 0),
          completed: parseInt(today.rows[0].completed || 0),
          cancelled: parseInt(today.rows[0].cancelled || 0)
        },
        upcoming_appointments: parseInt(upcoming.rows[0].total),
        new_patients_this_month: parseInt(patients.rows[0].total),
        monthly_revenue: parseFloat(revenue.rows[0].total),
        recent_appointments: recent.rows
      }
    });
  } catch (error) {
    console.error('Dashboard Overview Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard overview.' });
  }
};

const getAppointmentStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const clinic_id = req.clinic.clinic_id;
    const start = start_date || new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const end = end_date || new Date().toISOString().split('T')[0];

    const { rows: statusStats } = await pool.query(
      `SELECT status, COUNT(*) as count FROM appointments 
       WHERE clinic_id = $1 AND appointment_date BETWEEN $2 AND $3 GROUP BY status`,
      [clinic_id, start, end]
    );

    const { rows: dailyStats } = await pool.query(
      `SELECT appointment_date, COUNT(*) as count, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM appointments WHERE clinic_id = $1 AND appointment_date BETWEEN $2 AND $3 GROUP BY appointment_date ORDER BY appointment_date`,
      [clinic_id, start, end]
    );

    res.json({ success: true, data: { status_stats: statusStats, daily_stats: dailyStats } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Statistics failed.' });
  }
};

const getRevenueAnalytics = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { rows: revenueData } = await pool.query(
      `SELECT s.service_name, SUM(s.price) as revenue, COUNT(*) as count
       FROM appointments a JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND a.status = 'completed' AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY s.service_name ORDER BY revenue DESC`,
      [clinic_id]
    );
    res.json({ success: true, data: { revenue_by_service: revenueData } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Revenue analytics failed.' });
  }
};

const getPatientAnalytics = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { rows: stats } = await pool.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as new_patients
       FROM patients WHERE clinic_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 months' GROUP BY month ORDER BY month`,
      [clinic_id]
    );
    res.json({ success: true, data: { monthly_new_patients: stats } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Patient analytics failed.' });
  }
};

module.exports = { getDashboardOverview, getAppointmentStats, getRevenueAnalytics, getPatientAnalytics };
