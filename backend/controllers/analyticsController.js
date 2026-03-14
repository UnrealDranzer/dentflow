const { pool } = require('../config/database');

// Get dashboard overview
const getDashboardOverview = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;

    // Today's appointments
    const { rows: todayAppointments } = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM appointments 
       WHERE clinic_id = $1 AND appointment_date = CURRENT_DATE`,
      [clinic_id]
    );

    // Upcoming appointments (next 7 days)
    const { rows: upcomingAppointments } = await pool.query(
      `SELECT COUNT(*) as total
       FROM appointments 
       WHERE clinic_id = $1 
         AND appointment_date > CURRENT_DATE
         AND appointment_date <= CURRENT_DATE + INTERVAL '7 days'
         AND status IN ('scheduled', 'confirmed')`,
      [clinic_id]
    );

    // New patients this month
    const { rows: newPatients } = await pool.query(
      `SELECT COUNT(*) as total
       FROM patients 
       WHERE clinic_id = $1 
         AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [clinic_id]
    );

    // Total patients
    const { rows: totalPatients } = await pool.query(
      'SELECT COUNT(*) as total FROM patients WHERE clinic_id = $1',
      [clinic_id]
    );

    // Monthly revenue (completed appointments)
    const { rows: monthlyRevenue } = await pool.query(
      `SELECT COALESCE(SUM(s.price), 0) as total
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 
         AND a.status = 'completed'
         AND EXTRACT(MONTH FROM a.appointment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM a.appointment_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [clinic_id]
    );

    // Recent appointments
    const { rows: recentAppointments } = await pool.query(
      `SELECT a.*, p.name as patient_name, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [clinic_id]
    );

    res.json({
      success: true,
      data: {
        today: {
          total_appointments: todayAppointments[0].total,
          scheduled: todayAppointments[0].scheduled,
          completed: todayAppointments[0].completed,
          cancelled: todayAppointments[0].cancelled
        },
        upcoming_appointments: upcomingAppointments[0].total,
        new_patients_this_month: newPatients[0].total,
        total_patients: totalPatients[0].total,
        monthly_revenue: monthlyRevenue[0].total,
        recent_appointments: recentAppointments
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview.'
    });
  }
};

// Get appointment statistics
const getAppointmentStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const clinic_id = req.clinic.clinic_id;

    const startDate = start_date || new Date(new Date().setDate(1)).toISOString().split('T')[0]; // First day of current month
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Appointments by status
    const { rows: statusStats } = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM appointments 
       WHERE clinic_id = $1 AND appointment_date BETWEEN $2 AND $3
       GROUP BY status`,
      [clinic_id, startDate, endDate]
    );

    // Appointments by day
    const { rows: dailyStats } = await pool.query(
      `SELECT appointment_date, COUNT(*) as count,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM appointments 
       WHERE clinic_id = $1 AND appointment_date BETWEEN $2 AND $3
       GROUP BY appointment_date
       ORDER BY appointment_date`,
      [clinic_id, startDate, endDate]
    );

    // Appointments by service
    const { rows: serviceStats } = await pool.query(
      `SELECT s.service_name, COUNT(a.appointment_id) as count
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND a.appointment_date BETWEEN $2 AND $3
       GROUP BY s.service_id, s.service_name
       ORDER BY count DESC`,
      [clinic_id, startDate, endDate]
    );

    res.json({
      success: true,
      data: {
        date_range: { start: startDate, end: endDate },
        by_status: statusStats,
        by_day: dailyStats,
        by_service: serviceStats
      }
    });
  } catch (error) {
    console.error('Get appointment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statistics.'
    });
  }
};

// Get revenue analytics
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query; // week, month, year
    const clinic_id = req.clinic.clinic_id;

    let dateFilter;
    let groupBy;

    switch (period) {
      case 'week':
        dateFilter = "appointment_date >= CURRENT_DATE - INTERVAL '7 days'";
        groupBy = 'appointment_date';
        break;
      case 'year':
        dateFilter = "appointment_date >= CURRENT_DATE - INTERVAL '1 year'";
        groupBy = "TO_CHAR(appointment_date, 'YYYY-MM')";
        break;
      case 'month':
      default:
        dateFilter = "appointment_date >= CURRENT_DATE - INTERVAL '30 days'";
        groupBy = 'appointment_date';
    }

    // Revenue by period
    const { rows: revenueData } = await pool.query(
      `SELECT 
        ${period === 'year' ? "TO_CHAR(appointment_date, 'YYYY-MM') as period" : "appointment_date as period"},
        COALESCE(SUM(s.price), 0) as revenue,
        COUNT(a.appointment_id) as appointments
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND ${dateFilter} AND a.status = 'completed'
       GROUP BY ${period === 'year' ? "TO_CHAR(appointment_date, 'YYYY-MM')" : groupBy}
       ORDER BY period`,
      [clinic_id]
    );

    // Total revenue
    const { rows: totalRevenue } = await pool.query(
      `SELECT COALESCE(SUM(s.price), 0) as total
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND ${dateFilter} AND a.status = 'completed'`,
      [clinic_id]
    );

    // Revenue by service
    const { rows: revenueByService } = await pool.query(
      `SELECT s.service_name, COALESCE(SUM(s.price), 0) as revenue, COUNT(*) as count
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND ${dateFilter} AND a.status = 'completed'
       GROUP BY s.service_id, s.service_name
       ORDER BY revenue DESC`,
      [clinic_id]
    );

    res.json({
      success: true,
      data: {
        period,
        total_revenue: totalRevenue[0].total,
        revenue_by_period: revenueData,
        revenue_by_service: revenueByService
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics.'
    });
  }
};

// Get patient analytics
const getPatientAnalytics = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;

    // New vs Returning patients
    const { rows: patientTypeStats } = await pool.query(
      `SELECT 
        CASE 
          WHEN total_visits = 1 THEN 'new'
          WHEN total_visits > 1 THEN 'returning'
          ELSE 'new'
        END as patient_type,
        COUNT(*) as count
       FROM patients
       WHERE clinic_id = $1
       GROUP BY patient_type`,
      [clinic_id]
    );

    // Patients by month
    const { rows: monthlyPatients } = await pool.query(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as new_patients
       FROM patients
       WHERE clinic_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY month
       ORDER BY month`,
      [clinic_id]
    );

    // Top patients by visits
    const { rows: topPatients } = await pool.query(
      `SELECT patient_id, name, phone, total_visits, total_spent
       FROM patients
       WHERE clinic_id = $1
       ORDER BY total_visits DESC
       LIMIT 10`,
      [clinic_id]
    );

    res.json({
      success: true,
      data: {
        patient_types: patientTypeStats,
        monthly_new_patients: monthlyPatients,
        top_patients: topPatients
      }
    });
  } catch (error) {
    console.error('Get patient analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient analytics.'
    });
  }
};

module.exports = {
  getDashboardOverview,
  getAppointmentStats,
  getRevenueAnalytics,
  getPatientAnalytics
};
