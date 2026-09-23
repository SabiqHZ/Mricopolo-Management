require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

async function seed() {
  const [username, email, password] = process.argv.slice(2);
  if (!username || !email || !password) {
    console.error('Usage: node database/seed.js <username> <email> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO NOTHING
     RETURNING id`,
    [username, email, passwordHash]
  );

  if (result.rows.length === 0) {
    console.log(`User "${username}" already exists — skipped.`);
  } else {
    console.log(`Seeded user: ${username} (id ${result.rows[0].id})`);
  }
  await pool.end();
}

seed();