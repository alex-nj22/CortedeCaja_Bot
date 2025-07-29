// index.js
require('dotenv').config();
const fetch = require('node-fetch');
const { iniciarSesion } = require('./login');
const { getProperty, setProperty } = require('./props');
const { guardarCorteEnDB, extraerDatosDeMovimiento } = require('./cortes');
const { notificarCorteEnTelegram } = require('./telegram');

const posiblesSucursales = [1, 2, 3, 4, 5, 7];
const CHAT_ID_DEFAULT = process.env.CHAT_ID_DEFAULT || '-1002622059684';
const BATCH_SIZE = 6; // Procesar 6 en paralelo

// Lógica principal exportada como función
async function procesarCortes() {
  try {
    // 1. LOGIN
    const sessionCookie = await iniciarSesion({
      username: process.env.FARMA_USER || "documentop.supervisor",
      password: process.env.FARMA_PASS || "documento9999"
    });
    if (!sessionCookie) throw new Error("No se pudo iniciar sesión en Farma Salud.");
    console.log("✅ Cookie obtenida.");

    // 2. Recupera el último ID procesado, o empieza por el 1800 si nunca has procesado
    let ultimoID = Number(await getProperty('ultimoIdCorteProcesado')) || 1800;
    const lotes = 1; // Cuántos lotes quieres procesar (puedes cambiarlo)
    let procesadosEnEstaEjecucion = 0;

    for (let lote = 0; lote < lotes; lote++) {
      // Prepara los siguientes 6 ID de corte a procesar en paralelo
      const ids = Array.from({ length: BATCH_SIZE }, (_, k) => ultimoID + 1 + k);

      // Procesa cada ID de corte en paralelo
      const resultados = await Promise.allSettled(
        ids.map(async idCorte => {
          for (const idSucursal of posiblesSucursales) {
            const url = "https://clientesdte.oss.com.sv/farma_salud/corte_caja_diario.php";
            const payload = new URLSearchParams({
              process: "imprimir",
              id_corte: idCorte,
              id_sucursal_dom: idSucursal
            });
            let response, texto, data;
            try {
              response = await fetch(url, {
                method: "POST",
                body: payload,
                headers: {
                  "Cookie": sessionCookie,
                  "X-Requested-With": "XMLHttpRequest"
                }
              });
              texto = await response.text();
              data = JSON.parse(texto);
            } catch (e) {
              console.error(`❌ Error al consultar sucursal ${idSucursal} para corte ${idCorte}:`, e.message);
              continue;
            }
            if (data && data.movimiento && data.movimiento.length > 30) {
              const datos = extraerDatosDeMovimiento(data.movimiento, idCorte, idSucursal);
              await guardarCorteEnDB(datos);
              await notificarCorteEnTelegram(datos, CHAT_ID_DEFAULT);
              console.log(`✅ Corte ${idCorte} (${idSucursal}) guardado y notificado.`);
              return true;
            }
          }
          // Si ninguna sucursal tuvo datos válidos:
          console.log(`⏳ ID ${idCorte} sin datos válidos (posible fin de registros).`);
          return false;
        })
      );

      // Determina el máximo ID exitoso en este lote
      let maxExitoso = ultimoID;
      resultados.forEach((result, idx) => {
        const idCorte = ids[idx];
        if (result.status === 'fulfilled' && result.value === true) {
          if (idCorte > maxExitoso) maxExitoso = idCorte;
        }
      });

      if (maxExitoso > ultimoID) {
        await setProperty('ultimoIdCorteProcesado', maxExitoso);
        procesadosEnEstaEjecucion += (maxExitoso - (ultimoID - BATCH_SIZE));
        ultimoID = maxExitoso;
      } else {
        // Si ninguno del lote fue exitoso, probablemente llegaste al final de los registros
        console.log("No se encontró ningún corte válido en este lote, deteniendo el procesamiento.");
        break;
      }
    }

    console.log(`🔵 Último ID procesado: ${ultimoID}`);
    console.log(`Total procesados en esta ejecución: ${procesadosEnEstaEjecucion}`);

  } catch (e) {
    console.error("❌ Error en el procesamiento general:", e);
  }
}

// Permite ejecución manual
if (require.main === module) {
  procesarCortes();
}

module.exports = { procesarCortes };