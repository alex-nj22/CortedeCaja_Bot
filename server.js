const db = require('./db');
const fetch = require('node-fetch');

async function procesarSiguientesCortesCaja() {
  console.log('⏳ [procesarSiguientesCortesCaja] INICIO');
  try {
    console.log('✅ [TRY] Entrando en try para obtener cortes pendientes...');
    const cortesPendientes = await db.query(`
      SELECT * FROM cortes_caja WHERE estado = 'pendiente' ORDER BY fecha_creacion LIMIT 5
    `);
    console.log('📍 [PASO] Cortes pendientes obtenidos:', cortesPendientes.rows.length);

    if (cortesPendientes.rows.length === 0) {
      console.log('⏹️ [procesarSiguientesCortesCaja] No hay trabajo pendiente. Saliendo.');
      console.log('⚡ [procesarSiguientesCortesCaja] FIN');
      return;
    }

    for (const corte of cortesPendientes.rows) {
      console.log('📍 [PASO] Procesando corte:', corte.id_corte, corte.sucursal);
      try {
        console.log('✅ [TRY] Procesando fetch para corte:', corte.id_corte);
        // Simulación de fetch o llamada a API externa
        const response = await fetch(`https://api.example.com/cortes/${corte.id_corte}`);
        const data = await response.json();
        console.log('📍 [PASO] Datos recibidos para corte:', corte.id_corte, data);

        // Actualizar el estado del corte en la base de datos
        await db.query(
          `UPDATE cortes_caja SET estado = $1, datos = $2 WHERE id_corte = $3`,
          ['procesado', JSON.stringify(data), corte.id_corte]
        );
        console.log('📍 [PASO] Corte actualizado en BD:', corte.id_corte);
      } catch (e) {
        console.error('❌ [CATCH] Error procesando corte:', corte.id_corte, e);
      }
    }
  } catch (e) {
    console.error('❌ [CATCH] Error en procesarSiguientesCortesCaja:', e);
  }
  console.log('⚡ [procesarSiguientesCortesCaja] FIN');
}

module.exports = { procesarSiguientesCortesCaja };