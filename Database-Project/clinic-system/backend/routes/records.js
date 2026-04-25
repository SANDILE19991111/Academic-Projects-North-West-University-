// backend/routes/records.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/records — with optional patient_id filter
router.get('/', authenticateToken, async (req, res) => {
  const { patient_id } = req.query;
  try {
    const query = patient_id
      ? 'SELECT * FROM Medical_Record WHERE patient_id = $1 ORDER BY time_stamp DESC'
      : 'SELECT * FROM Medical_Record ORDER BY time_stamp DESC LIMIT 100';
    const params = patient_id ? [patient_id] : [];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/records/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const recordRes = await pool.query('SELECT * FROM Medical_Record WHERE record_id = $1', [req.params.id]);
    if (!recordRes.rows.length) return res.status(404).json({ message: 'Record not found' });

    const prescRes = await pool.query('SELECT * FROM Prescription WHERE record_id = $1', [req.params.id]);
    const record = recordRes.rows[0];
    record.prescriptions = prescRes.rows;

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/records — create medical record
router.post('/', authenticateToken, authorizeRoles('Admin', 'Doctor', 'Nurse'), async (req, res) => {
  const { patient_id, doctor_id, diagnosis, treatment_plan, lab_results, consultation_notes } = req.body;

  if (!patient_id || !doctor_id || !diagnosis) {
    return res.status(400).json({ message: 'patient_id, doctor_id, diagnosis required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Medical_Record (patient_id, doctor_id, diagnosis, treatment_plan, lab_results, consultation_notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [patient_id, doctor_id, diagnosis, treatment_plan || null, lab_results || null, consultation_notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/records/:id/prescriptions — add prescription to record
router.post('/:id/prescriptions', authenticateToken, authorizeRoles('Admin', 'Doctor'), async (req, res) => {
  const { medication, dosage, frequency, instructions, last_updated_by } = req.body;

  if (!medication || !dosage || !frequency || !last_updated_by) {
    return res.status(400).json({ message: 'medication, dosage, frequency, last_updated_by required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Prescription (record_id, medication, dosage, frequency, instructions, status, last_updated_by)
       VALUES ($1,$2,$3,$4,$5,'Pending',$6) RETURNING *`,
      [req.params.id, medication, dosage, frequency, instructions || null, last_updated_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/records/prescriptions/:id — update prescription status
router.patch('/prescriptions/:id', authenticateToken, async (req, res) => {
  const { status, dispensed_at } = req.body;
  try {
    const result = await pool.query(
      `UPDATE Prescription SET status=$1, dispensed_at=$2 WHERE prescription_id=$3 RETURNING *`,
      [status, dispensed_at || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Prescription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
