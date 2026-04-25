// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT ua.*, s.role FROM UserAccount ua JOIN Staff s ON ua.staff_id = s.staff_id WHERE ua.username = $1 AND ua.is_active = TRUE',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check failed attempts lockout
    if (user.failed_attempts >= 5) {
      return res.status(403).json({ message: 'Account locked. Contact administrator.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await pool.query(
        'UPDATE UserAccount SET failed_attempts = failed_attempts + 1 WHERE user_id = $1',
        [user.user_id]
      );
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Reset failed attempts and update last login
    await pool.query(
      'UPDATE UserAccount SET failed_attempts = 0, last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role, staff_id: user.staff_id },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role } });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/register (Admin only - creates a staff user account)
router.post('/register', async (req, res) => {
  const { staff_id, username, password } = req.body;

  if (!staff_id || !username || !password) {
    return res.status(400).json({ message: 'staff_id, username, and password are required' });
  }

  if (username.length < 5) {
    return res.status(400).json({ message: 'Username must be at least 5 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO UserAccount (staff_id, username, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username',
      [staff_id, username, hash]
    );

    res.status(201).json({ message: 'Account created', user: result.rows[0] });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username already taken' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/register-staff — self-registration (creates staff + user account)
router.post('/register-staff', async (req, res) => {
  const { first_name, surname, phone, email, role, username, password } = req.body;

  if (!first_name || !surname || !phone || !email || !role || !username || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (username.length < 5) {
    return res.status(400).json({ message: 'Username must be at least 5 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const validRoles = ['Admin', 'Doctor', 'Pharmacist', 'Nurse', 'Receptionist'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create staff record
    const staffRes = await client.query(
      `INSERT INTO Staff (phone, email, role) VALUES ($1, $2, $3) RETURNING staff_id`,
      [phone, email, role]
    );
    const staff_id = staffRes.rows[0].staff_id;

    // If Doctor, create doctor record too
    if (role === 'Doctor') {
      await client.query(
        `INSERT INTO Doctor (staff_id, specialization, license_number) VALUES ($1, 'General Practitioner', $2)`,
        [staff_id, `TMP-${Date.now()}`]
      );
    }
    if (role === 'Pharmacist') {
      await client.query(
        `INSERT INTO Pharmacist (staff_id, license_number) VALUES ($1, $2)`,
        [staff_id, `PH-${Date.now()}`]
      );
    }

    // Hash password and create user account
    const hash = await bcrypt.hash(password, 12);
    const userRes = await client.query(
      `INSERT INTO UserAccount (staff_id, username, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username`,
      [staff_id, username, hash]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Account created successfully',
      user: { user_id: userRes.rows[0].user_id, username: userRes.rows[0].username, role }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Username, phone, or email already exists' });
    }
    console.error('Register-staff error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
