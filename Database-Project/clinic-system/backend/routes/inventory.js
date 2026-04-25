// backend/routes/inventory.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/inventory
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM Inventory ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/inventory/alerts — low stock or expiring soon
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, 
        CASE 
          WHEN stock_quant = 0 THEN 'Out of Stock'
          WHEN stock_quant <= reorder_level THEN 'Reorder Needed'
          ELSE 'In Stock'
        END AS alert_status
       FROM Inventory 
       WHERE stock_quant <= reorder_level OR expiry_date < CURRENT_DATE + INTERVAL '30 days'
       ORDER BY stock_quant ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory
router.post('/', authenticateToken, authorizeRoles('Admin', 'Pharmacist'), async (req, res) => {
  const { name, stock_quant, reorder_level, unit_price, expiry_date, supplier_info } = req.body;

  if (!name || stock_quant === undefined || reorder_level === undefined) {
    return res.status(400).json({ message: 'name, stock_quant, reorder_level required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO Inventory (name, stock_quant, reorder_level, unit_price, expiry_date, supplier_info)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, stock_quant, reorder_level, unit_price || null, expiry_date || null,
       supplier_info ? JSON.stringify({ info: supplier_info }) : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/inventory/:id/restock
router.patch('/:id/restock', authenticateToken, authorizeRoles('Admin', 'Pharmacist'), async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || isNaN(quantity)) return res.status(400).json({ message: 'quantity required' });

  try {
    const result = await pool.query(
      `UPDATE Inventory SET stock_quant = stock_quant + $1, last_restock_date = CURRENT_DATE 
       WHERE item_id = $2 RETURNING *`,
      [quantity, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/inventory/:id
router.patch('/:id', authenticateToken, authorizeRoles('Admin', 'Pharmacist'), async (req, res) => {
  const { stock_quant, reorder_level, expiry_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE Inventory SET stock_quant=COALESCE($1,stock_quant), reorder_level=COALESCE($2,reorder_level),
       expiry_date=COALESCE($3,expiry_date) WHERE item_id=$4 RETURNING *`,
      [stock_quant, reorder_level, expiry_date, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM Inventory WHERE item_id = $1 RETURNING item_id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
