const fs = require('fs');
const path = require('path');
const { pool } = require('./backend/config/db');
require('dotenv').config();

async function initDB() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database:', process.env.PGDATABASE || 'dynasched_db');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(sql);
    console.log('Schema tables, views, indexes, and triggers initialized successfully.');

    // Seed default team members if users table is empty
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO users (name, email, password, role) VALUES
          ('Nitin', 'nitin892684@gmail.com', 'password123', 'Team Lead'),
          ('Ashish Rautela', 'ashishrautela190@gmail.com', 'password123', 'Developer'),
          ('Rishi Raj Thakuri', 'rishithakuri2006@gmail.com', 'password123', 'Developer'),
          ('Sahil Negi', 'sahilnegipw@gmail.com', 'password123', 'Developer');
      `);
      console.log('Seeded default team members.');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initDB();
}

module.exports = { initDB };
