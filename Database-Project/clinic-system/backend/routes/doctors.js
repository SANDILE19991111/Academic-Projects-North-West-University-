// backend/routes/doctors.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/doctors
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.doctor_id, d.staff_id, d.specialization, d.license_number,
              s.phone, s.email, s.schedule
       FROM Doctor d JOIN Staff s ON d.staff_id = s.staff_id
       WHERE s.active = TRUE
       ORDER BY d.doctor_id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, s.phone, s.email, s.schedule, s.role 
       FROM Doctor d JOIN Staff s ON d.staff_id = s.staff_id 
       WHERE d.doctor_id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Doctor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/doctors/:id/availability
router.get('/:id/availability', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM DoctorAvailability WHERE doctor_id = $1 AND available_date >= CURRENT_DATE ORDER BY available_date, start_time`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/doctors — create staff + doctor
router.post('/', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  const { phone, email, specialization, license_number, schedule } = req.body;

  if (!phone || !email || !specialization || !license_number) {
    return res.status(400).json({ message: 'phone, email, specialization, license_number required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const staffRes = await client.query(
      `INSERT INTO Staff (phone, email, schedule, role) VALUES ($1,$2,$3,'Doctor') RETURNING staff_id`,
      [phone, email, schedule || null]
    );

    const doctorRes = await client.query(
      `INSERT INTO Doctor (staff_id, specialization, license_number) VALUES ($1,$2,$3) RETURNING *`,
      [staffRes.rows[0].staff_id, specialization, license_number]
    );

    await client.query('COMMIT');
    res.status(201).json(doctorRes.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ message: 'License number or email already exists' });
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

// POST /api/doctors/:id/availability — add availability slot
router.post('/:id/availability', authenticateToken, async (req, res) => {
  const { available_date, start_time, end_time } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO DoctorAvailability (doctor_id, available_date, start_time, end_time)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, available_date, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/doctors/:id
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE Staff SET active = FALSE WHERE staff_id = (SELECT staff_id FROM Doctor WHERE doctor_id = $1) RETURNING staff_id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Doctor not found' });
    res.json({ message: 'Doctor deactivated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
