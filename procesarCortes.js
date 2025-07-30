const db = require('./db');
const { getProperty, setProperty } = require('./props');
const { iniciarSesion } = require('./login');
const { notificarCorteEnTelegram } = require('./telegram');
const fetch = require('node-fetch');

function extraerDatosDeMovimiento(mov, idCorte) {
  const datos = {};
  // Corte Tipo
  let m = mov.match(/CORTE TIPO:\s*([^\n]+)/i);
  datos.corte_tipo = m ? m[1].trim() : "";

  // Empleado/Responsable
  m = mov.match(/EMPLEADO:\s*([^\n]+)/);
  datos.responsable = m ? m[1].trim() : "";

  // Fecha y hora
  m = mov.match(/FECHA:\s*(\d{2}-\d{2}-\d{4})\s*HORA:\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
  datos.fecha = m ? m[1].replace(/-/g, "/") : "";
  datos.hora = m ? m[2] : "";

  // Ingresos
  m = mov.match(/\(\+\)INGRESOS \$:\s*([\d\.,]+)/);
  datos.ingresos = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Venta
  m = mov.match(/\(\+\) VENTA \$:\s*([\d\.,]+)/);
  datos.venta = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Subtotal
  m = mov.match(/SUBTOTAL \$:\s*([\d\.,]+)/);
  datos.subtotal = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Vales
  m = mov.match(/VALES \$:\s*([\d\.,]+)/);
  datos.vales = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Total caja
  m = mov.match(/TOTAL CAJA \$:\s*([\d\.,]+)/);
  datos.total_caja = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Retención
  m = mov.match(/RETENCION \$:\s*([\d\.,]+)/);
  datos.retencion = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Devoluciones
  m = mov.match(/DEVOLUCIONES\$:\s*([\d\.,]+)/);
  datos.devoluciones = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Efectivo
  m = mov.match(/EFECTIVO \$:\s*([\d\.,]+)/);
  datos.efectivo = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Tarjeta
  m = mov.match(/PAGOS CON TARJETA[\s\S]+?TOTAL\s+([\d\.,]+)/);
  datos.tarjeta = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Crédito
  m = mov.match(/VENTAS AL CREDITO[\s\S]+?TOTAL\s+([\d\.,]+)/);
  datos.credito = m ? parseFloat(m[1].replace(",", "")) : 0;

  // Diferencia
  if (!isNaN(datos.efectivo) && !isNaN(datos.total_caja)) {
    const diff = +(datos.efectivo - datos.total_caja).toFixed(2);
    datos.diferencia = Math.abs(diff) < 0.01 ? 0 : diff;
  } else {
    datos.diferencia = "";
  }

  // $ Facturas
  m = mov.match(/FACTURAS:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
  datos.facturas = m ? parseFloat(m[1].replace(",", "")) : "";

  // $ Crédito Fiscal
  m = mov.match(/FISCALES:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
  datos.credito_fiscal = m ? parseFloat(m[1].replace(",", "")) : "";

  // Facturas cantidad
  m = mov.match(/FACTURAS:\s+\d+\s+\d+\s+(\d+)/);
  datos.facturas_cantidad = m ? parseInt(m[1], 10) : "";

  // Crédito Fiscal cantidad
  m = mov.match(/FISCALES:\s+\d+\s+\d+\s+(\d+)/);
  datos.credito_fiscal_cantidad = m ? parseInt(m[1], 10) : "";

  // Final (campo lógico: Z en tipo)
  datos.final = datos.corte_tipo && datos.corte_tipo.match(/z/i) ? "Si" : "";

  // Razón, corregido (dejar en blanco; los llena el bot)
  datos.razon = "";
  datos.corregido = "";

  datos.id_corte = idCorte;
  return datos;
}


async function procesarSiguientesCortesCaja() {
  console.log('⏳ [procesarSiguientesCortesCaja] INICIO');
  let ultimoID = parseInt(await getProperty('ultimoIdCorteProcesado'), 10) || 1800; // Ajusta tu inicial si es necesario
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
    // --- ADAPTADO: extrae los datos con el parser, y guarda cada campo ---
    const datos = extraerDatosDeMovimiento(dataCorte.movimiento, idCorte);

    await db.query(`
      INSERT INTO cortes_caja (
        id_corte, corte_tipo, fecha, hora, ingresos, venta, subtotal, vales,
        total_caja, retencion, devoluciones, efectivo, tarjeta, credito, diferencia,
        facturas, credito_fiscal, facturas_cantidad, credito_fiscal_cantidad,
        final, razon, corregido, responsable, sucursal, datos, fecha_creacion, estado
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26
      )
      ON CONFLICT (id_corte, sucursal) DO NOTHING
    `, [
      datos.id_corte, datos.corte_tipo, datos.fecha, datos.hora, datos.ingresos, datos.venta, datos.subtotal, datos.vales,
      datos.total_caja, datos.retencion, datos.devoluciones, datos.efectivo, datos.tarjeta, datos.credito, datos.diferencia,
      datos.facturas, datos.credito_fiscal, datos.facturas_cantidad, datos.credito_fiscal_cantidad,
      datos.final, datos.razon, datos.corregido, datos.responsable, sucursalValida, JSON.stringify(dataCorte), new Date(), 'pendiente'
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