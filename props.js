const db = require('./db');

async function getProperty(key) {
  const res = await db.query('SELECT valor FROM props WHERE clave = $1', [key]);
  return res.rows[0]?.valor || null;
}

async function setProperty(key, value) {
  const exists = await db.query('SELECT 1 FROM props WHERE clave = $1', [key]);
  if (exists.rowCount > 0) {
    await db.query('UPDATE props SET valor = $2 WHERE clave = $1', [key, value]);
  } else {
    await db.query('INSERT INTO props (clave, valor) VALUES ($1, $2)', [key, value]);
  }
}

module.exports = { getProperty, setProperty };