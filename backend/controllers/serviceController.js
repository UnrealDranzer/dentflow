const { pool } = require('../config/database');

// Get all services for a clinic
const getAllServices = async (req, res) => {
  try {
    const { active_only = true } = req.query;
    const clinic_id = req.clinic.clinic_id;

    let query = 'SELECT * FROM services WHERE clinic_id = $1';
    const params = [clinic_id];

    if (active_only === 'true') {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY service_name';

    const { rows: services } = await pool.query(query, params);

    res.json({
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services.'
    });
  }
};

// Get single service
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const { rows: services } = await pool.query(
      'SELECT * FROM services WHERE service_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    res.json({
      success: true,
      data: { service: services[0] }
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service.'
    });
  }
};

// Create new service
const createService = async (req, res) => {
  try {
    const { service_name, description, duration_minutes, price, color_code } = req.body;
    const clinic_id = req.clinic.clinic_id;

    // Check if service with same name exists
    const { rows: existingServices } = await pool.query(
      'SELECT service_id FROM services WHERE clinic_id = $1 AND service_name = $2',
      [clinic_id, service_name]
    );

    if (existingServices.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Service with this name already exists.'
      });
    }

    const { rows: result } = await pool.query(
      `INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING service_id`,
      [clinic_id, service_name, description, duration_minutes, price, color_code || '#3B82F6']
    );

    const service_id = result[0].service_id;

    const { rows: services } = await pool.query(
      'SELECT * FROM services WHERE service_id = $1',
      [service_id]
    );

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: { service: services[0] }
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create service.'
    });
  }
};

// Update service
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, description, duration_minutes, price, color_code, is_active } = req.body;
    const clinic_id = req.clinic.clinic_id;

    // Check if service exists
    const { rows: existingServices } = await pool.query(
      'SELECT service_id FROM services WHERE service_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );

    if (existingServices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    // Check name uniqueness if changed
    if (service_name) {
      const { rows: nameCheck } = await pool.query(
        'SELECT service_id FROM services WHERE clinic_id = $1 AND service_name = $2 AND service_id != $3',
        [clinic_id, service_name, id]
      );

      if (nameCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Another service with this name already exists.'
        });
      }
    }

    const updates = [];
    const values = [];

    if (service_name) { updates.push('service_name = ?'); values.push(service_name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (duration_minutes) { updates.push('duration_minutes = ?'); values.push(duration_minutes); }
    if (price !== undefined) { updates.push('price = ?'); values.push(price); }
    if (color_code) { updates.push('color_code = ?'); values.push(color_code); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    values.push(id, clinic_id);

    // Convert ? to $1, $2, etc.
    const postgresUpdates = updates.map((u, i) => u.replace('?', `$${i + 1}`));
    const finalIdPlaceholder = `$${values.length - 1}`;
    const finalClinicIdPlaceholder = `$${values.length}`;

    await pool.query(
      `UPDATE services SET ${postgresUpdates.join(', ')} WHERE service_id = ${finalIdPlaceholder} AND clinic_id = ${finalClinicIdPlaceholder}`,
      values
    );

    const { rows: services } = await pool.query(
      'SELECT * FROM services WHERE service_id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service: services[0] }
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update service.'
    });
  }
};

// Delete service (soft delete by setting is_active to false)
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    // Check if service has future appointments
    const { rows: appointments } = await pool.query(
      `SELECT appointment_id FROM appointments 
       WHERE service_id = $1 AND clinic_id = $2
       AND appointment_date >= CURRENT_DATE 
       AND status IN ('scheduled', 'confirmed')`,
      [id, clinic_id]
    );

    if (appointments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete service with scheduled appointments. Please cancel or reschedule appointments first.'
      });
    }

    // Soft delete - set is_active to false
    const result = await pool.query(
      'UPDATE services SET is_active = false WHERE service_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service.'
    });
  }
};

// Get popular services
const getPopularServices = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { limit = 5 } = req.query;

    const { rows: services } = await pool.query(
      `SELECT s.service_id, s.service_name, s.price, COUNT(a.appointment_id) as booking_count
       FROM services s
       LEFT JOIN appointments a ON s.service_id = a.service_id AND a.status = 'completed'
       WHERE s.clinic_id = $1
       GROUP BY s.service_id
       ORDER BY booking_count DESC
       LIMIT $2`,
      [clinic_id, parseInt(limit)]
    );

    res.json({
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Get popular services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular services.'
    });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getPopularServices
};
