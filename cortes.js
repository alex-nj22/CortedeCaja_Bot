const db = require('./db');

function ddmmyyyyToISO(fecha) {
  if (!fecha) return null;
  const [dd, mm, yyyy] = fecha.split(/[-/]/);
  return `${yyyy}-${mm}-${dd}`;
}

// Parseo igual que en Apps Script, adaptado a Node.js
function extraerDatosDeMovimiento(mov, idCorte, idSucursalDom) {
  let m;
  const datos = {};

  // Corte Tipo
  m = mov.match(/CORTE TIPO:\s*([^\n]+)/i);
  datos.corteTipo = m ? m[1].trim() : "";

  // Sucursal (opcional)
  m = mov.match(/FARMACIA [^\n]+/);
  datos.sucursal = m ? m[0].trim() : "";

  // Empleado/Cajero
  m = mov.match(/EMPLEADO:\s*([^\n]+)/);
  datos.cajero = m ? m[1].trim() : "";

  // Fecha y hora
 m = mov.match(/FECHA:\s*(\d{2}[-/]\d{2}[-/]\d{4})\s*HORA:\s*([^\n]+)/i);
  datos.fecha = m ? ddmmyyyyToISO(m[1]) : null;
  datos.hora = m ? m[2].trim() : "";
  
  // Corte de caja (tradicional)
  if (datos.corteTipo && datos.corteTipo.match(/corte de caja/i)) {
    // Caja y turno
    m = mov.match(/CAJA\s*:\s*(\d+)\s+TURNO:\s*(\d+)/);
    datos.caja = m ? m[1] : "";
    datos.turno = m ? m[2] : "";

    // Saldo inicial
    m = mov.match(/SALDO INICIAL \$:\s*([\d\.,]+)/);
    datos.saldoInicial = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Saldo caja chica
    m = mov.match(/SALDO CAJA CHICA \$:\s*([\d\.,]+)/);
    datos.saldoCajaChica = m ? parseFloat(m[1].replace(",", "")) : 0;
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
    datos.totalCaja = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Retención
    m = mov.match(/RETENCION \$:\s*([\d\.,]+)/);
    datos.retencion = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Devoluciones
    m = mov.match(/DEVOLUCIONES\$:\s*([\d\.,]+)/);
    datos.devoluciones = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Efectivo
    m = mov.match(/EFECTIVO \$:\s*([\d\.,]+)/);
    datos.efectivo = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Pagos con tarjeta (total)
    m = mov.match(/PAGOS CON TARJETA[\s\S]+?TOTAL\s+([\d\.,]+)/);
    datos.tarjeta = m ? parseFloat(m[1].replace(",", "")) : 0;
    // Ventas al crédito (total)
    m = mov.match(/VENTAS AL CREDITO[\s\S]+?TOTAL\s+([\d\.,]+)/);
    datos.credito = m ? parseFloat(m[1].replace(",", "")) : 0;

    // Campos de corte Z, vacíos
    datos.facturasMonto = null;
    datos.creditoFiscalMonto = null;
    datos.facturasCantidad = null;
    datos.creditoFiscalCantidad = null;

  } else if (datos.corteTipo && datos.corteTipo.match(/z/i)) {
    // Corte Z
    m = mov.match(/FACTURAS:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
    datos.facturasMonto = m ? parseFloat(m[1].replace(",", "")) : 0;
    m = mov.match(/FISCALES:\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
    datos.creditoFiscalMonto = m ? parseFloat(m[1].replace(",", "")) : 0;
    m = mov.match(/FACTURAS:\s+\d+\s+\d+\s+(\d+)/);
    datos.facturasCantidad = m ? parseInt(m[1], 10) : 0;
    m = mov.match(/FISCALES:\s+\d+\s+\d+\s+(\d+)/);
    datos.creditoFiscalCantidad = m ? parseInt(m[1], 10) : 0;
    m = mov.match(/TOTAL \$\s*:\s*[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)/);
    datos.totalCaja = m ? parseFloat(m[1].replace(",", "")) : 0;

    datos.ingresos = null;
    datos.venta = null;
    datos.subtotal = null;
    datos.vales = null;
    datos.retencion = null;
    datos.devoluciones = null;
    datos.efectivo = null;
    datos.tarjeta = null;
    datos.credito = null;
  }

  // Diferencia calculada (puedes ajustar esto)
  if (datos.efectivo !== null && datos.totalCaja !== null && !isNaN(datos.efectivo) && !isNaN(datos.totalCaja)) {
    let diff = Math.round((datos.efectivo - datos.totalCaja) * 100) / 100;
    datos.diferencia = Math.abs(diff) < 0.01 ? 0 : diff;
  } else {
    datos.diferencia = null;
  }

  datos.idCorte = idCorte;
  datos.idSucursalDom = idSucursalDom;
  return datos;
}

// Guarda corte en la base de datos
async function guardarCorteEnDB(datos) {
  const query = `
    INSERT INTO cortes_caja (
      id_corte, sucursal, tipo, fecha, hora, cajero,
      ingresos, venta, subtotal, vales, total_caja,
      retencion, devoluciones, efectivo, tarjeta, credito, diferencia,
      facturas_monto, credito_fiscal_monto, facturas_cantidad, credito_fiscal_cantidad,
      final, razon, corregido, responsable
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15, $16, $17,
      $18, $19, $20, $21,
      $22, $23, $24, $25
    )
    ON CONFLICT (id_corte) DO NOTHING
  `;
  const values = [
    datos.idCorte,                       // id_corte
    datos.sucursal || "",                // sucursal (extraído por regex)
    datos.corteTipo || datos.tipo || "", // tipo
    datos.fecha || "",                   // fecha
    datos.hora || "",                    // hora
    datos.cajero || "",                  // cajero
    datos.ingresos,
    datos.venta,
    datos.subtotal,
    datos.vales,
    datos.totalCaja,
    datos.retencion,
    datos.devoluciones,
    datos.efectivo,
    datos.tarjeta,
    datos.credito,
    datos.diferencia,
    datos.facturasMonto,
    datos.creditoFiscalMonto,
    datos.facturasCantidad,
    datos.creditoFiscalCantidad,
    datos.final || null,
    datos.razon || null,
    datos.corregido || null,
    datos.responsable || null,
  ];
  await db.query(query, values);
}

module.exports = { extraerDatosDeMovimiento, guardarCorteEnDB };