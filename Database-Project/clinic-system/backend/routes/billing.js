// backend/routes/billing.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/billing
router.get('/', authenticateToken, async (req, res) => {
  const { patient_id, status } = req.query;
  let query = `
    SELECT i.*, p.first_name || ' ' || p.surname AS patient_name,
           (i.total_amount * 0.15) AS tax_amount
    FROM Invoice i
    JOIN Patient p ON i.patient_id = p.patient_id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (patient_id) { query += ` AND i.patient_id = $${idx++}`; params.push(patient_id); }
  if (status)     { query += ` AND i.payment_status = $${idx++}`; params.push(status); }
  query += ' ORDER BY i.dateofbilling DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/billing/summary — monthly revenue
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        EXTRACT(YEAR FROM dateofbilling) AS year,
        EXTRACT(MONTH FROM dateofbilling) AS month,
        payment_method,
        COUNT(*) AS invoice_count,
        SUM(total_amount) AS total_revenue,
        SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END) AS paid_amount,
        SUM(CASE WHEN payment_status != 'Paid' THEN total_amount ELSE 0 END) AS outstanding
       FROM Invoice
       GROUP BY year, month, payment_method
       ORDER BY year DESC, month DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/billing/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Invoice WHERE invoice_id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/billing — create invoice
router.post('/', authenticateToken, authorizeRoles('Admin', 'Receptionist'), async (req, res) => {
  const { patient_id, total_amount, payment_method, payment_status, issued_by } = req.body;

  if (!patient_id || total_amount === undefined || !issued_by) {
    return res.status(400).json({ message: 'patient_id, total_amount, issued_by required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Invoice (patient_id, total_amount, payment_method, payment_status, issued_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [patient_id, total_amount, payment_method || 'Cash', payment_status || 'Unpaid', issued_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/billing/:id — update payment status
router.patch('/:id', authenticateToken, authorizeRoles('Admin', 'Receptionist'), async (req, res) => {
  const { payment_status, payment_method } = req.body;
  try {
    const result = await pool.query(
      `UPDATE Invoice SET 
        payment_status = COALESCE($1, payment_status),
        payment_method = COALESCE($2, payment_method)
       WHERE invoice_id = $3 RETURNING *`,
      [payment_status, payment_method, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/billing/:id
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM Invoice WHERE invoice_id = $1 RETURNING invoice_id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
