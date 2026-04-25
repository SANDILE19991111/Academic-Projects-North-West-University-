// backend/routes/appointments.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/appointments — list with optional filters
router.get('/', authenticateToken, async (req, res) => {
  const { status, date, patient_id, doctor_id } = req.query;

  let query = `
    SELECT a.*, 
           p.first_name || ' ' || p.surname AS patient_name,
           s.email AS doctor_email
    FROM Appointment a
    JOIN Patient p ON a.patient_id = p.patient_id
    JOIN Doctor d ON a.doctor_id = d.doctor_id
    JOIN Staff s ON d.staff_id = s.staff_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (status) { query += ` AND a.status = $${idx++}`; params.push(status); }
  if (date)   { query += ` AND DATE(a.datetime) = $${idx++}`; params.push(date); }
  if (patient_id) { query += ` AND a.patient_id = $${idx++}`; params.push(patient_id); }
  if (doctor_id)  { query += ` AND a.doctor_id = $${idx++}`; params.push(doctor_id); }

  query += ' ORDER BY a.datetime ASC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Appointment WHERE appointment_id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/appointments — book appointment
router.post('/', authenticateToken, async (req, res) => {
  const { patient_id, doctor_id, datetime, consultation_notes, status } = req.body;

  if (!patient_id || !doctor_id || !datetime) {
    return res.status(400).json({ message: 'patient_id, doctor_id, datetime are required' });
  }

  // Check doctor availability
  try {
    const conflict = await pool.query(
      `SELECT appointment_id FROM Appointment 
       WHERE doctor_id = $1 
       AND ABS(EXTRACT(EPOCH FROM (datetime - $2::timestamp))) < 1800
       AND status NOT IN ('Cancelled', 'NoShow')`,
      [doctor_id, datetime]
    );

    if (conflict.rows.length > 0) {
      return res.status(409).json({ message: 'Doctor has a conflicting appointment at this time' });
    }

    const result = await pool.query(
      `INSERT INTO Appointment (patient_id, doctor_id, datetime, consultation_notes, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patient_id, doctor_id, datetime, consultation_notes || null, status || 'Scheduled']
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/appointments/:id — update status or notes
router.patch('/:id', authenticateToken, async (req, res) => {
  const { status, consultation_notes } = req.body;
  try {
    const fields = [];
    const params = [];
    let idx = 1;

    if (status) { fields.push(`status = $${idx++}`); params.push(status); }
    if (consultation_notes !== undefined) { fields.push(`consultation_notes = $${idx++}`); params.push(consultation_notes); }

    if (!fields.length) return res.status(400).json({ message: 'No fields to update' });

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE Appointment SET ${fields.join(', ')} WHERE appointment_id = $${idx} RETURNING *`,
      params
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/appointments/:id — cancel
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE Appointment SET status = 'Cancelled' WHERE appointment_id = $1 RETURNING appointment_id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
