// backend/routes/patients.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/patients — list all patients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT patient_id, first_name, surname, dateofbirth, cell_no, email, insurance_info, allergies, notification, created_at FROM Patient ORDER BY surname ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/patients/:id — single patient with address
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const patientRes = await pool.query('SELECT * FROM Patient WHERE patient_id = $1', [id]);
    if (patientRes.rows.length === 0) return res.status(404).json({ message: 'Patient not found' });

    const addrRes = await pool.query('SELECT * FROM Address WHERE patient_id = $1', [id]);
    const patient = patientRes.rows[0];
    patient.address = addrRes.rows[0] || null;

    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/patients — register new patient
router.post('/', authenticateToken, async (req, res) => {
  const { first_name, surname, dateofbirth, cell_no, email, medical_history, allergies, contact_info, insurance_info, notification } = req.body;

  if (!first_name || !surname || !dateofbirth || !cell_no) {
    return res.status(400).json({ message: 'first_name, surname, dateofbirth, cell_no are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Patient (first_name, surname, dateofbirth, cell_no, email, medical_history, allergies, contact_info, insurance_info, notification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [first_name, surname, dateofbirth, cell_no, email || null, medical_history || null,
       allergies || null, contact_info || null, insurance_info || null, notification ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Cell number or email already registered' });
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/patients/:id — update patient
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { first_name, surname, dateofbirth, cell_no, email, medical_history, allergies, insurance_info, notification } = req.body;

  try {
    const result = await pool.query(
      `UPDATE Patient SET first_name=$1, surname=$2, dateofbirth=$3, cell_no=$4, email=$5,
       medical_history=$6, allergies=$7, insurance_info=$8, notification=$9, updated_at=CURRENT_TIMESTAMP
       WHERE patient_id=$10 RETURNING *`,
      [first_name, surname, dateofbirth, cell_no, email, medical_history, allergies, insurance_info, notification, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Patient not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Receptionist'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM Patient WHERE patient_id = $1 RETURNING patient_id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted', patient_id: result.rows[0].patient_id });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
