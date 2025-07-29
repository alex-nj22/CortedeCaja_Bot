const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
console.log('Connecting to DB:', process.env.DATABASE_URL);
module.exports = pool;