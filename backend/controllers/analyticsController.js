const { pool } = require('../config/database');

// Get dashboard overview
const getDashboardOverview = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;

    // Today's appointments
    const [todayAppointments] = await pool.execute(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM appointments 
       WHERE clinic_id = ? AND appointment_date = CURRENT_DATE()`,
      [clinic_id]
    );

    // Upcoming appointments (next 7 days)
    const [upcomingAppointments] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM appointments 
       WHERE clinic_id = ? 
         AND appointment_date > CURRENT_DATE()
         AND appointment_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)
         AND status IN ('scheduled', 'confirmed')`,
      [clinic_id]
    );

    // New patients this month
    const [newPatients] = await pool.execute(
      `SELECT COUNT(*) as total
       FROM patients 
       WHERE clinic_id = ? 
         AND MONTH(created_at) = MONTH(CURRENT_DATE())
         AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
      [clinic_id]
    );

    // Total patients
    const [totalPatients] = await pool.execute(
      'SELECT COUNT(*) as total FROM patients WHERE clinic_id = ?',
      [clinic_id]
    );

    // Monthly revenue (completed appointments)
    const [monthlyRevenue] = await pool.execute(
      `SELECT COALESCE(SUM(s.price), 0) as total
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ? 
         AND a.status = 'completed'
         AND MONTH(a.appointment_date) = MONTH(CURRENT_DATE())
         AND YEAR(a.appointment_date) = YEAR(CURRENT_DATE())`,
      [clinic_id]
    );

    // Recent appointments
    const [recentAppointments] = await pool.execute(
      `SELECT a.*, p.name as patient_name, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ?
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
    const [statusStats] = await pool.execute(
      `SELECT status, COUNT(*) as count
       FROM appointments 
       WHERE clinic_id = ? AND appointment_date BETWEEN ? AND ?
       GROUP BY status`,
      [clinic_id, startDate, endDate]
    );

    // Appointments by day
    const [dailyStats] = await pool.execute(
      `SELECT appointment_date, COUNT(*) as count,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM appointments 
       WHERE clinic_id = ? AND appointment_date BETWEEN ? AND ?
       GROUP BY appointment_date
       ORDER BY appointment_date`,
      [clinic_id, startDate, endDate]
    );

    // Appointments by service
    const [serviceStats] = await pool.execute(
      `SELECT s.service_name, COUNT(a.appointment_id) as count
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ? AND a.appointment_date BETWEEN ? AND ?
       GROUP BY s.service_id
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
        dateFilter = 'appointment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)';
        groupBy = 'appointment_date';
        break;
      case 'year':
        dateFilter = 'appointment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 YEAR)';
        groupBy = 'YEAR(appointment_date), MONTH(appointment_date)';
        break;
      case 'month':
      default:
        dateFilter = 'appointment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)';
        groupBy = 'appointment_date';
    }

    // Revenue by period
    const [revenueData] = await pool.execute(
      `SELECT 
        ${period === 'year' ? 'DATE_FORMAT(appointment_date, "%Y-%m") as period' : 'appointment_date as period'},
        COALESCE(SUM(s.price), 0) as revenue,
        COUNT(a.appointment_id) as appointments
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ? AND ${dateFilter} AND a.status = 'completed'
       GROUP BY ${groupBy}
       ORDER BY period`,
      [clinic_id]
    );

    // Total revenue
    const [totalRevenue] = await pool.execute(
      `SELECT COALESCE(SUM(s.price), 0) as total
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ? AND ${dateFilter} AND a.status = 'completed'`,
      [clinic_id]
    );

    // Revenue by service
    const [revenueByService] = await pool.execute(
      `SELECT s.service_name, COALESCE(SUM(s.price), 0) as revenue, COUNT(*) as count
       FROM appointments a
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = ? AND ${dateFilter} AND a.status = 'completed'
       GROUP BY s.service_id
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
    const [patientTypeStats] = await pool.execute(
      `SELECT 
        CASE 
          WHEN total_visits = 1 THEN 'new'
          WHEN total_visits > 1 THEN 'returning'
          ELSE 'new'
        END as patient_type,
        COUNT(*) as count
       FROM patients
       WHERE clinic_id = ?
       GROUP BY patient_type`,
      [clinic_id]
    );

    // Patients by month
    const [monthlyPatients] = await pool.execute(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as new_patients
       FROM patients
       WHERE clinic_id = ? AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month`,
      [clinic_id]
    );

    // Top patients by visits
    const [topPatients] = await pool.execute(
      `SELECT patient_id, name, phone, total_visits, total_spent
       FROM patients
       WHERE clinic_id = ?
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
