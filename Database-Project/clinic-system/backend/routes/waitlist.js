// backend/routes/waitlist.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/waitlist
router.get('/', authenticateToken, async (req, res) => {
  const { doctor_id, status } = req.query;
  let query = `
    SELECT w.*, p.first_name || ' ' || p.surname AS patient_name
    FROM Waitlist w
    JOIN Patient p ON w.patient_id = p.patient_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (doctor_id) { query += ` AND w.doctor_id = $${idx++}`; params.push(doctor_id); }
  if (status)    { query += ` AND w.status = $${idx++}`; params.push(status); }
  query += ' ORDER BY w.priority ASC, w.requested_date ASC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/waitlist
router.post('/', authenticateToken, async (req, res) => {
  const { patient_id, doctor_id, requested_date, priority } = req.body;

  if (!patient_id || !doctor_id || !requested_date) {
    return res.status(400).json({ message: 'patient_id, doctor_id, requested_date required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Waitlist (patient_id, doctor_id, requested_date, priority, status)
       VALUES ($1,$2,$3,$4,'Waiting') RETURNING *`,
      [patient_id, doctor_id, requested_date, priority || 5]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/waitlist/:id
router.patch('/:id', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE Waitlist SET status=$1 WHERE waitlist_id=$2 RETURNING *`,
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/waitlist/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE Waitlist SET status='Cancelled' WHERE waitlist_id=$1 RETURNING waitlist_id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Removed from waitlist' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
