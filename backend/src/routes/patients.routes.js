import { Router } from 'express';
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient
} from '../controllers/patients.controller.js';
import { validate, patientSchema } from '../middleware/validate.js';
import { requireRole } from '../middleware/authenticate.js';

const router = Router();

router.get('/', getPatients);
router.get('/:id', getPatient);
router.post('/', validate(patientSchema), createPatient);
router.put('/:id', validate(patientSchema), updatePatient);
router.delete('/:id', requireRole('admin', 'receptionist'), deletePatient);

export default router;
