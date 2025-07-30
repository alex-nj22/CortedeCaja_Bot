// Utilidad para convertir fecha "14/07/2025" → "2025-07-14"
function convertirFechaAISO(ddmmaaaa) {
  if (!ddmmaaaa || typeof ddmmaaaa !== "string") return null;
  const partes = ddmmaaaa.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

// Funciones para limpiar y convertir números
function limpiarEntero(valor) {
  if (valor === "" || valor === undefined || valor === null || isNaN(valor)) return null;
  return parseInt(valor, 10);
}
function limpiarDecimal(valor) {
  if (valor === "" || valor === undefined || valor === null || isNaN(valor)) return null;
  return parseFloat(valor);
}

// Parser de movimiento
function extraerDatosDeMovimiento(mov, idCorte) {
  const datos = {};
  let m;

  m = mov.match(/CORTE TIPO:\s*([^\n]+)/i);
  datos.tipo = m ? m[1].trim() : "";

  m = mov.match(/EMPLEADO:\s*([^\n]+)/);
  datos.cajero = m ? m[1].trim() : "";

  m = mov.match(/FECHA:\s*(\d{2}-\d{2}-\d{4})\s*HORA:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  datos.fecha = m ? m[1].replace(/-/g, "/") : "";
  datos.hora = m ? m[2] : "";

  m = mov.match(/\(\+\)INGRESOS \$:\s*([\d\.,]+)/);
  datos.ingresos = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/\(\+\) VENTA \$:\s*([\d\.,]+)/);
  datos.venta = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/SUBTOTAL \$:\s*([\d\.,]+)/);
  datos.subtotal = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/VALES \$:\s*([\d\.,]+)/);
  datos.vales = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/TOTAL CAJA \$:\s*([\d\.,]+)/);
  datos.total_caja = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/RETENCION \$:\s*([\d\.,]+)/);
  datos.retención = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/DEVOLUCIONES\$:\s*([\d\.,]+)/);
  datos.devoluciónes = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/EFECTIVO \$:\s*([\d\.,]+)/);
  datos.efectivo = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/PAGOS CON TARJETA[\s\S]+?TOTAL\s+([\d\.,]+)/);
  datos.tarjeta = limpiarDecimal(m ? m[1].replace(",", "") : "");

  m = mov.match(/VENTAS AL CREDITO[\s\S]+?TOTAL\s+([\d\.,]+)/);
  datos.credito = limpiarDecimal(m ? m[1].replace(",", "") : "");

  if (!isNaN(datos.efectivo) && !isNaN(datos.total_caja)) {
    const diff = +(datos.efectivo - datos.total_caja).toFixed(2);
    datos.diferencia = Math.abs(diff) < 0.01 ? 0 : diff;
  } else {
    datos.diferencia = null;
  }

  m = mov.match(/FACTURAS:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
  datos.facturas_monto = limpiarDecimal(m ? m[1] : "");

  m = mov.match(/FISCALES:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
  datos.credito_fiscal_monto = limpiarDecimal(m ? m[1] : "");

  m = mov.match(/FACTURAS:\s+\d+\s+\d+\s+(\d+)/);
  datos.facturas_cantidad = limpiarEntero(m ? m[1] : "");

  m = mov.match(/FISCALES:\s+\d+\s+\d+\s+(\d+)/);
  datos.credito_fiscal_cantidad = limpiarEntero(m ? m[1] : "");

  datos.final = (datos.tipo && datos.tipo.match(/z/i)) ? true : false;

  datos.razon = false;
  datos.corregido = false;
  datos.responsable = datos.cajero || "";
  datos.id_corte = idCorte;

  // Convertir fecha a formato ISO (Postgres)
  datos.fecha = convertirFechaAISO(datos.fecha);

  return datos;
}

// ----------- FUNCIÓN PRINCIPAL --------------

const db = require('./db');
const { getProperty, setProperty } = require('./props');
const { iniciarSesion } = require('./login');
const { notificarCorteEnTelegram } = require('./telegram');
const fetch = require('node-fetch');

async function procesarSiguientesCortesCaja() {
  console.log('⏳ [procesarSiguientesCortesCaja] INICIO');
  let ultimoID = parseInt(await getProperty('ultimoIdCorteProcesado'), 10) || 1800;
  let idCorte = ultimoID + 1;

  const sessionCookie = await iniciarSesion();
  if (!sessionCookie) {
    console.log('❌ [LOGIN] No se pudo iniciar sesión');
    return;
  }

  let valido = false, dataCorte = null;
  let sucursalValida = null;
  const SUCURSALES = [1, 2, 3, 4, 5, 7];

  for (let sucursal of SUCURSALES) {
    try {
      const response = await fetch("https://clientesdte.oss.com.sv/farma_salud/corte_caja_diario.php", {
        method: 'POST',
        headers: {
          'Cookie': sessionCookie,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
          process: 'imprimir',
          id_corte: idCorte,
          id_sucursal_dom: sucursal
        }),
      });
      const texto = await response.text();
      try { dataCorte = JSON.parse(texto); } catch { dataCorte = null; }
      if (dataCorte && dataCorte.movimiento && dataCorte.movimiento.length > 30) {
        valido = true;
        sucursalValida = sucursal;
        break;
      }
    } catch (e) {
      console.error(`❌ [FETCH] Sucursal ${sucursal} Corte ${idCorte}:`, e);
    }
  }

  if (valido) {
    const datos = extraerDatosDeMovimiento(dataCorte.movimiento, idCorte);
    datos.fecha = convertirFechaAISO(datos.fecha);
    console.log('[DEBUG] Fecha convertida:', datos.fecha);

    await db.query(`
      INSERT INTO cortes_caja (
        id_corte, sucursal, tipo, fecha, hora, cajero, ingresos, venta, subtotal, vales,
        total_caja, retención, devoluciónes, efectivo, tarjeta, credito, diferencia,
        facturas_monto, credito_fiscal_monto, facturas_cantidad, credito_fiscal_cantidad,
        final, razon, corregido, responsable
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25
      ) ON CONFLICT (id_corte, sucursal) DO NOTHING
    `, [
      datos.id_corte, sucursalValida, datos.tipo, datos.fecha, datos.hora, datos.cajero, datos.ingresos, datos.venta, datos.subtotal, datos.vales,
      datos.total_caja, datos.retención, datos.devoluciónes, datos.efectivo, datos.tarjeta, datos.credito, datos.diferencia,
      datos.facturas_monto, datos.credito_fiscal_monto, datos.facturas_cantidad, datos.credito_fiscal_cantidad,
      datos.final, datos.razon, datos.corregido, datos.responsable
    ]);
    await setProperty('ultimoIdCorteProcesado', idCorte);
    await notificarCorteEnTelegram(dataCorte, idCorte);
    console.log(`✅ [CORRECTO] Procesado corte válido: ${idCorte} sucursal ${sucursalValida}`);
  } else {
    console.log(`🛑 [NO VÁLIDO] Corte ${idCorte} no es válido (no se actualiza últimoId)`);
  }

  console.log('⚡ [procesarSiguientesCortesCaja] FIN');
}

module.exports = { procesarSiguientesCortesCaja };