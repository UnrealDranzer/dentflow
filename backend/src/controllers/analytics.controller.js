import { query } from '../config/db.js';

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const clinicId = req.clinicId;

    const [patientsRec, statsRec, todayRec, upcomingRec] = await Promise.all([
      query('SELECT COUNT(*) FROM patients WHERE clinic_id = $1', [clinicId]),
      query(
        `SELECT COUNT(*) as total,
                COUNT(*) FILTER (WHERE status='completed') as completed,
                COUNT(*) FILTER (WHERE status='no_show') as no_shows,
                COALESCE(SUM(amount) FILTER (WHERE status='completed'),0) as revenue
         FROM appointments 
         WHERE clinic_id=$1 AND scheduled_at >= date_trunc('month',NOW())`,
        [clinicId]
      ),
      query(
        `SELECT a.id as appointment_id, a.clinic_id, a.patient_id, a.dentist_id,
                a.scheduled_at, a.duration_mins, a.status, a.type, a.notes, 
                a.treatment_done, a.amount, a.created_at,
                p.name as patient_name,
                COALESCE(
                  (SELECT u.name FROM users u WHERE u.id = a.dentist_id LIMIT 1),
                  (SELECT d.name FROM doctors d WHERE d.id = a.dentist_id LIMIT 1),
                  'Unassigned'
                ) as doctor_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.clinic_id = $1 
           AND a.scheduled_at::date = CURRENT_DATE
           AND a.status != 'cancelled'
         ORDER BY a.scheduled_at ASC`,
        [clinicId]
      ),
      query(
        `SELECT COUNT(*) FROM appointments 
         WHERE clinic_id=$1 AND scheduled_at > NOW() 
         AND scheduled_at < NOW() + INTERVAL '7 days'
         AND status NOT IN ('cancelled','no_show')`,
        [clinicId]
      )
    ]);

    // SYSTEM-WIDE NORMALIZATION: { success: true, data: { ... } }
    res.json({
      success: true,
      data: {
        totalPatients: parseInt(patientsRec.rows[0].count, 10) || 0,
        stats: {
          today: {
            total_appointments: parseInt(todayRec.rows.length, 10) || 0,
            scheduled: parseInt(todayRec.rows.filter(r => r.status === 'scheduled').length, 10) || 0,
            completed: parseInt(todayRec.rows.filter(r => r.status === 'completed').length, 10) || 0,
            cancelled: 0 // Controller filters out cancelled
          },
          monthlyStats: {
            total: parseInt(statsRec.rows[0].total, 10) || 0,
            completed: parseInt(statsRec.rows[0].completed, 10) || 0,
            no_shows: parseInt(statsRec.rows[0].no_shows, 10) || 0,
            revenue: parseFloat(statsRec.rows[0].revenue) || 0
          }
        },
        todayAppointments: todayRec.rows || [],
        upcomingCount: parseInt(upcomingRec.rows[0].count, 10) || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentStats = async (req, res, next) => {
  try {
    const clinicId = req.clinicId;
    const stats = await query(
      `SELECT status, COUNT(*) as count
       FROM appointments
       WHERE clinic_id = $1
       GROUP BY status`,
      [clinicId]
    );
    res.json({ success: true, data: { stats: stats.rows } });
  } catch (error) {
    next(error);
  }
};

export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const clinicId = req.clinicId;
    const revenue = await query(
      `SELECT date_trunc('month', scheduled_at) as month,
              SUM(amount) as total
       FROM appointments
       WHERE clinic_id = $1 AND status = 'completed'
       GROUP BY month
       ORDER BY month DESC
       LIMIT 6`,
      [clinicId]
    );
    res.json({ success: true, data: { revenue: revenue.rows } });
  } catch (error) {
    next(error);
  }
};
