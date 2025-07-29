const db = require('./db');

async function obtenerEmpleadosSucursal(sucursal) {
  const res = await db.query('SELECT * FROM empleados WHERE sucursal = $1', [sucursal]);
  return res.rows;
}

module.exports = { obtenerEmpleadosSucursal };