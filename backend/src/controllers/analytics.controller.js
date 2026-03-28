import { query } from '../config/db.js';

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const clinicId = req.clinicId;

    const [patientsRec, statsRec, todayRec, upcomingRec, newPatientsRec] = await Promise.all([
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
                p.name as patient_name, u.name as doctor_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         LEFT JOIN doctors u ON a.dentist_id = u.id
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
      ),
      query(
        `SELECT COUNT(*) FROM patients 
         WHERE clinic_id = $1 AND created_at >= date_trunc('month', NOW())`,
        [clinicId]
      )
    ]);

    const stats = statsRec.rows[0];

    res.json({
      success: true,
      data: {
        totalPatients: parseInt(patientsRec.rows[0].count, 10) || 0,
        new_patients_this_month: parseInt(newPatientsRec.rows[0].count, 10) || 0,
        today: {
          total_appointments: parseInt(todayRec.rows.length, 10) || 0,
          scheduled: parseInt(todayRec.rows.filter(r => r.status === 'scheduled').length, 10) || 0,
          completed: parseInt(todayRec.rows.filter(r => r.status === 'completed').length, 10) || 0,
          cancelled: 0
        },
        monthlyStats: {
          total: parseInt(stats.total, 10) || 0,
          completed: parseInt(stats.completed, 10) || 0,
          no_shows: parseInt(stats.no_shows, 10) || 0,
          revenue: parseFloat(stats.revenue) || 0
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
    
    const [byStatus, byDay, byService] = await Promise.all([
      // Status breakdown
      query(
        `SELECT status, COUNT(*) as count 
         FROM appointments 
         WHERE clinic_id = $1 
         GROUP BY status`, 
        [clinicId]
      ),
      // Appointments by day (last 14 days)
      query(
        `SELECT scheduled_at::date as appointment_date, 
                COUNT(*) as count,
                COUNT(*) FILTER (WHERE status = 'completed') as completed
         FROM appointments
         WHERE clinic_id = $1 AND scheduled_at >= CURRENT_DATE - INTERVAL '14 days'
         GROUP BY appointment_date
         ORDER BY appointment_date ASC`,
        [clinicId]
      ),
      // Appointments by service
      query(
        `SELECT COALESCE(s.name, a.type, 'Consultation') as service_name, 
                COUNT(*) as count
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         WHERE a.clinic_id = $1
         GROUP BY service_name
         ORDER BY count DESC
         LIMIT 10`,
        [clinicId]
      )
    ]);

    res.json({ 
      success: true, 
      data: { 
        by_status: byStatus.rows,
        by_day: byDay.rows,
        by_service: byService.rows
      } 
    });
  } catch (error) {
    next(error);
  }
};

export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const clinicId = req.clinicId;

    const [byPeriod, byService] = await Promise.all([
      // Revenue trend (last 6 months)
      query(
        `SELECT to_char(date_trunc('month', scheduled_at), 'Mon YYYY') as period,
                SUM(amount) as revenue
         FROM appointments
         WHERE clinic_id = $1 AND status = 'completed'
           AND scheduled_at >= CURRENT_DATE - INTERVAL '6 months'
         GROUP BY date_trunc('month', scheduled_at)
         ORDER BY date_trunc('month', scheduled_at) ASC`,
        [clinicId]
      ),
      // Revenue by service
      query(
        `SELECT COALESCE(s.name, a.type, 'Consultation') as service_name, 
                SUM(a.amount) as revenue
         FROM appointments a
         LEFT JOIN services s ON a.service_id = s.id
         WHERE a.clinic_id = $1 AND a.status = 'completed'
         GROUP BY service_name
         ORDER BY revenue DESC
         LIMIT 10`,
        [clinicId]
      )
    ]);

    res.json({ 
      success: true, 
      data: { 
        revenue_by_period: byPeriod.rows,
        revenue_by_service: byService.rows
      } 
    });
  } catch (error) {
    next(error);
  }
};
