import { Router } from 'express';
import {
  getAppointments,
  getTodayAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment
} from '../controllers/appointments.controller.js';
import { validate, appointmentSchema, appointmentUpdateSchema } from '../middleware/validate.js';

const router = Router();

router.get('/', getAppointments);
router.get('/today', getTodayAppointments);
router.post('/', validate(appointmentSchema), createAppointment);
router.patch('/:id', validate(appointmentUpdateSchema), updateAppointment);
router.delete('/:id', cancelAppointment);

export default router;
