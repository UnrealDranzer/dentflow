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
         WHERE clinic_id=$1 AND scheduled_at >= date_trunc('month', NOW())`,
        [clinicId]
      ),
      query(
        `SELECT a.id, a.id as appointment_id, a.clinic_id, a.patient_id, a.dentist_id,
                a.scheduled_at, a.duration_mins, a.status, a.type, a.notes, 
                a.treatment_done, a.amount, a.created_at,
                p.name as patient_name,
                COALESCE(u.name, d.name, 'Unassigned') as doctor_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users u ON u.id = a.dentist_id
         LEFT JOIN doctors d ON d.id = a.dentist_id
         WHERE a.clinic_id = $1 
           AND a.scheduled_at >= CURRENT_DATE
           AND a.scheduled_at < CURRENT_DATE + INTERVAL '1 day'
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

    const stats = statsRec.rows[0];

    res.json({
      success: true,
      data: {
        totalPatients: parseInt(patientsRec.rows[0].count || 0, 10),
        monthlyStats: {
          total: parseInt(stats.total || 0, 10),
          completed: parseInt(stats.completed || 0, 10),
          no_shows: parseInt(stats.no_shows || 0, 10),
          revenue: parseFloat(stats.revenue || 0),
          total_appointments: parseInt(stats.total || 0, 10) // Standardization for frontend
        },
        todayAppointments: todayRec.rows.map(r => ({
          ...r,
          id: String(r.id || ''),
          appointment_id: String(r.id || '')
        })),
        upcomingCount: parseInt(upcomingRec.rows[0].count || 0, 10)
      }
    });
  } catch (error) {
    next(error);
  }
};
