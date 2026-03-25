import { query } from '../config/db.js';

export const getDashboard = async (req, res, next) => {
  try {
    const [todayRes, statsRes, upcomingRes, recentPatientsRes] = await Promise.all([
      // Today's appointments
      query(
        `SELECT a.*, p.name as patient_name, u.name as dentist_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         LEFT JOIN users u ON a.dentist_id = u.id
         WHERE a.clinic_id = $1
           AND a.scheduled_at::date = CURRENT_DATE
           AND a.status != 'cancelled'
         ORDER BY a.scheduled_at ASC`,
        [req.clinicId]
      ),

      // Monthly stats
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed')  AS completed_count,
           COUNT(*) FILTER (WHERE status = 'no_show')    AS no_show_count,
           COUNT(*) FILTER (WHERE scheduled_at > NOW())  AS upcoming_count,
           COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) AS revenue_sum,
           (SELECT COUNT(*) FROM patients WHERE clinic_id = $1) AS total_patients
         FROM appointments
         WHERE clinic_id = $1
           AND date_trunc('month', scheduled_at) = date_trunc('month', CURRENT_DATE)`,
        [req.clinicId]
      ),

      // Upcoming 7 days
      query(
        `SELECT a.*, p.name as patient_name, u.name as dentist_name
         FROM appointments a
         JOIN patients p ON a.patient_id = p.id
         LEFT JOIN users u ON a.dentist_id = u.id
         WHERE a.clinic_id = $1
           AND a.scheduled_at > NOW()
           AND a.scheduled_at <= NOW() + interval '7 days'
           AND a.status NOT IN ('cancelled', 'no_show')
         ORDER BY a.scheduled_at ASC LIMIT 10`,
        [req.clinicId]
      ),

      // Recent patients
      query(
        `SELECT * FROM patients WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [req.clinicId]
      ),
    ]);

    const s = statsRes.rows[0];

    res.json({
      success: true,
      data: {
        today_appointments: todayRes.rows,
        upcoming_appointments: upcomingRes.rows,
        recent_patients: recentPatientsRes.rows,
        stats: {
          today_count:    todayRes.rows.length,
          completed:      parseInt(s.completed_count || 0, 10),
          no_show:        parseInt(s.no_show_count   || 0, 10),
          upcoming:       parseInt(s.upcoming_count  || 0, 10),
          revenue:        parseFloat(s.revenue_sum   || 0),
          total_patients: parseInt(s.total_patients  || 0, 10),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
