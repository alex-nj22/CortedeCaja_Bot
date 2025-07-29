const fetch = require('node-fetch');
const { getProperty, setProperty } = require('./props');
const db = require('./db'); // ← Necesitas tener un archivo db.js configurado correctamente
const { URLSearchParams } = require('url');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const LOGIN_URL = "https://clientesdte.oss.com.sv/farma_salud/login.php";
const CORTE_URL = "https://clientesdte.oss.com.sv/farma_salud/corte_caja_diario.php";
const SUCURSALES = [1, 2, 3, 4, 5, 7];

async function iniciarSesion() {
  try {
    const payload = new URLSearchParams({
      username: "documentop.supervisor",
      password: "documento9999",
      m: "1"
    });
    const response = await fetch(LOGIN_URL, {
      method: "POST",
      body: payload,
      redirect: 'manual'
    });
    const rawCookies = response.headers.raw()['set-cookie'];
    if (!rawCookies) return null;
    const cookie = rawCookies.find(c => c.includes('PHPSESSID='));
    if (!cookie) return null;
    return cookie.match(/PHPSESSID=[^;]+/)[0];
  } catch (e) {
    console.error("❌ Error en iniciarSesion:", e);
    return null;
  }
}

async function obtenerCortePorSucursal(idCorte, sessionCookie) {
  for (let sucursal of SUCURSALES) {
    const payload = new URLSearchParams({
      process: "imprimir",
      id_corte: idCorte,
      id_sucursal_dom: sucursal
    });
    try {
      const res = await fetch(CORTE_URL, {
        method: "POST",
        body: payload,
        headers: {
          "Cookie": sessionCookie,
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch (err) {
        console.log(`❌ Error parseando JSON Sucursal ${sucursal}, Corte ${idCorte}:`, err);
        continue;
      }
      if (data && data.movimiento && data.movimiento.length > 30) {
        console.log(`✅ Corte válido en sucursal ${sucursal} para ID ${idCorte}`);
        return { data, sucursal };
      }
    } catch (e) {
      console.error(`❌ Error solicitando sucursal ${sucursal}, corte ${idCorte}:`, e);
    }
  }
  console.log(`⏳ Corte ${idCorte} no válido en ninguna sucursal.`);
  return null;
}

// ---- ADAPTA ESTA FUNCIÓN para tu tabla y columnas ----
async function guardarCorteEnBD(idCorte, sucursal, datos) {
  // Ejemplo: tabla 'cortes_caja' con columnas id_corte, sucursal, movimiento, fecha_proceso
  try {
    await db.query(
      `INSERT INTO cortes_caja (id_corte, sucursal, movimiento, fecha_proceso)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id_corte, sucursal) DO NOTHING`,
      [idCorte, sucursal, datos.movimiento]
    );
    console.log(`🟢 Corte ID ${idCorte} guardado en la BD para sucursal ${sucursal}`);
  } catch (err) {
    console.error(`❌ Error guardando corte en BD:`, err);
  }
}

// ---- ENVÍA MENSAJE A TELEGRAM ----
async function notificarCorteEnTelegram(sucursal, idCorte, datos) {
  if (!TELEGRAM_TOKEN) return;
  let diferencia = calcularDiferencia(datos.movimiento);
  let msj = `🧾 *Corte* *${sucursal}:*\n\nID: ${idCorte}\n\n*Diferencia:* ${diferencia}\n\n¿Confirmar o descartar?`;
  const reply_markup = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `CONFIRMAR|${sucursal}|${idCorte}` },
        { text: "❌ Descartar", callback_data: `DESCARTAR|${sucursal}|${idCorte}` }
      ]
    ]
  };
  try {
    await fetch(`${BOT_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID, // o tu chat fijo
        text: msj,
        parse_mode: "Markdown",
        reply_markup
      })
    });
    console.log("📤 Notificación enviada a Telegram.");
  } catch (e) {
    console.error("❌ Error enviando Telegram:", e);
  }
}

// ---- EXTRAE DIFERENCIA DEL MOVIMIENTO ----
function calcularDiferencia(movimiento) {
  // Puedes hacer regex como en Apps Script para sacar la diferencia
  if (!movimiento) return "N/A";
  let m = movimiento.match(/EFECTIVO \$:\s*([\d\.,]+)/);
  let efectivo = m ? parseFloat(m[1].replace(",", "")) : 0;
  m = movimiento.match(/TOTAL CAJA \$:\s*([\d\.,]+)/);
  let totalCaja = m ? parseFloat(m[1].replace(",", "")) : 0;
  let diff = efectivo && totalCaja ? efectivo - totalCaja : 0;
  return (diff === 0 ? "Exacto" : (diff > 0 ? "+" : "") + diff.toFixed(2));
}

// ---- CICLO PRINCIPAL ----
async function procesarSiguientesCortesCaja() {
  const hora = new Date().getHours();
  if (hora < 7 || hora > 22) return;

  let ultimoID = Number(await getProperty('ultimoIdCorteProcesado')) || 0;
  let idProcesado = ultimoID;
  let procesados = 0;
  let n = 1; // Puedes aumentar n para procesar varios por ejecución

  const sessionCookie = await iniciarSesion();
  if (!sessionCookie) {
    console.error("No se pudo iniciar sesión.");
    return;
  }

  for (let i = 1; i <= n; i++) {
    const idCorte = idProcesado + 1;
    const corte = await obtenerCortePorSucursal(idCorte, sessionCookie);

    if (corte) {
      await guardarCorteEnBD(idCorte, corte.sucursal, corte.data);
      await notificarCorteEnTelegram(corte.sucursal, idCorte, corte.data);
      await setProperty('ultimoIdCorteProcesado', idCorte);
      idProcesado = idCorte;
      procesados++;
      console.log(`✅ Procesado ID ${idCorte} (OK)`);
    } else {
      console.log(`⏳ Procesado ID ${idCorte} (NO DATA/INVALIDO)`);
      if (i === 1) {
        console.log("🛑 Primer ID sin datos, deteniendo el proceso.");
        break;
      }
    }
  }
  console.log(`🔵 Último ID procesado en propiedad: ${await getProperty('ultimoIdCorteProcesado')}. Total nuevos guardados: ${procesados}`);
}

// Ejecuta el proceso si este archivo se corre directamente:
if (require.main === module) {
  procesarSiguientesCortesCaja();
}

module.exports = { procesarSiguientesCortesCaja };