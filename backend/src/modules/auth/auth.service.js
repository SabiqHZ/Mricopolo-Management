const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');

async function login(identifier, password) {
  const result = await pool.query(
    `SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1`,
    [identifier]
  );
  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );

  return { token, user: { id: user.id, username: user.username, email: user.email } };
}

module.exports = { login };