const db = require('./db');

async function getProperty(key) {
  try {
    const res = await db.query('SELECT valor FROM props WHERE clave = $1', [key]);
    const value = res.rows[0]?.valor || null;
    console.log(`[getProperty] clave: ${key}, valor: ${value}`);
    return value;
  } catch (e) {
    console.error(`[getProperty] Error leyendo clave "${key}":`, e);
    return null;
  }
}

async function setProperty(key, value) {
  try {
    await db.query(`
      INSERT INTO props (clave, valor)
      VALUES ($1, $2)
      ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
    `, [key, value]);
    console.log(`[setProperty] Guardado: ${key} = ${value}`);
  } catch (e) {
    console.error(`[setProperty] Error guardando clave "${key}":`, e);
  }
}

module.exports = { getProperty, setProperty };