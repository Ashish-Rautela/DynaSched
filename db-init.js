const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');
require('dotenv').config();

async function initDB() {
  const dbName = process.env.PGDATABASE || 'dynasched_db';
  const config = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
  };

  // 1. Connect to default 'postgres' database to ensure target database exists
  const rootClient = new Client({ ...config, database: 'postgres' });
  try {
    await rootClient.connect();
    const checkDb = await rootClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (checkDb.rows.length === 0) {
      await rootClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✔ Created database "${dbName}".`);
    } else {
      console.log(`✔ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    if (err.code === '28P01') {
      console.error('\n❌ Authentication failed: The PostgreSQL password in .env is incorrect.');
      console.error('Please open DynaSched/.env and set PGPASSWORD to your actual PostgreSQL password.\n');
      process.exit(1);
    }
    console.warn(`Note on database creation check: ${err.message}`);
  } finally {
    try { await rootClient.end(); } catch (_) {}
  }

  // 2. Connect to dynasched_db and apply schema
  const targetPool = new Pool({ ...config, database: dbName });
  let client;
  try {
    client = await targetPool.connect();
    console.log('✔ Connected to database:', dbName);
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(sql);
    console.log('✔ Schema tables, views, indexes, triggers, and stored procedures initialized successfully.');

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
      console.log('✔ Seeded default team members.');
    }
    console.log('\n🎉 Database initialized and ready for DynaSched!\n');
  } catch (err) {
    if (err.code === '28P01') {
      console.error('\n❌ Authentication failed: The PostgreSQL password in .env is incorrect.');
      console.error('Please open DynaSched/.env and set PGPASSWORD to your actual PostgreSQL password.\n');
    } else {
      console.error('Error initializing database:', err.message);
    }
    process.exit(1);
  } finally {
    if (client) client.release();
    await targetPool.end();
  }
}

if (require.main === module) {
  initDB();
}

module.exports = { initDB };
