const db = require('./db');
const empleados = require('./empleados'); // debe exportar la función getEmpleadosPorSucursal
const fetch = require('node-fetch');

// Razones de descarte
const razonesDescartar = [
  "Por error en conteo.",
  "Productos pendientes de finalizar venta.",
  "Error en facturación.",
  "Otro."
];

// Utilidad para crear un teclado paginado de empleados en 2 columnas
function crearTecladoEmpleados(empleadosList, accion, idCorte) {
  const filas = [];
  for (let i = 0; i < empleadosList.length; i += 2) {
    const row = [];
    for (let j = 0; j < 2 && i + j < empleadosList.length; j++) {
      row.push({
        text: empleadosList[i + j].nombre,
        callback_data: `${accion}|${idCorte}|${empleadosList[i + j].nombre}`
      });
    }
    filas.push(row);
  }
  return filas;
}

// Utilidad para razones de descarte
function crearTecladoRazones(idCorte, responsable) {
  return razonesDescartar.map(r => ([{
    text: r,
    callback_data: `RAZON|${idCorte}|${responsable}|${r}`
  }]));
}

async function manejarCallbackTelegram(req, res) {
  try {
    const body = req.body;
    if (!body.callback_query) return res.send('Sin callback');

    const cb = body.callback_query;
    const data = cb.data.split('|');
    const [accion, idCorte, extra, extra2] = data;

    if (accion === "CONFIRMAR" || accion === "DESCARTAR") {
      // Buscar sucursal del corte en la BD
      const { rows } = await db.query('SELECT sucursal FROM cortes_caja WHERE id_corte = $1', [idCorte]);
      if (!rows.length) return res.send('No se encontró corte');
      const sucursal = rows[0].sucursal;

      // Cargar empleados
      const lista = empleados.getEmpleadosPorSucursal(sucursal);
      const reply_markup = { inline_keyboard: crearTecladoEmpleados(lista, accion === "CONFIRMAR" ? "RESP_CONFIRMAR" : "RESP_DESCARTAR", idCorte) };
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup
        })
      });
      return res.send('ok');
    }

    if (accion === "RESP_CONFIRMAR") {
      // Guardar en BD: final=true, responsable=extra
      await db.query(
        'UPDATE cortes_caja SET final = $1, responsable = $2 WHERE id_corte = $3',
        [true, extra, idCorte]
      );
      // Editar mensaje quitando botones
      const ahora = new Date();
      const fecha = ahora.toLocaleDateString('es-SV');
      const hora = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
      let texto = cb.message.text + `\n\n✅ *Confirmado por:* ${extra}\n${fecha}, ${hora}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: texto,
          parse_mode: "Markdown"
        })
      });
      return res.send('ok');
    }

    if (accion === "RESP_DESCARTAR") {
      // Mostrar razones de descarte
      const reply_markup = { inline_keyboard: crearTecladoRazones(idCorte, extra) };
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          reply_markup
        })
      });
      return res.send('ok');
    }

    if (accion === "RAZON") {
      // Guardar en BD: final=false, responsable=extra, razon=extra2
      await db.query(
        'UPDATE cortes_caja SET final = $1, responsable = $2, razon = $3 WHERE id_corte = $4',
        [false, extra, extra2, idCorte]
      );
      // Editar mensaje quitando botones
      const ahora = new Date();
      const fecha = ahora.toLocaleDateString('es-SV');
      const hora = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
      let texto = cb.message.text + `\n\n❌ *Descartado por:* ${extra}\n*Razón:* ${extra2}\n${fecha}, ${hora}`;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: texto,
          parse_mode: "Markdown"
        })
      });
      return res.send('ok');
    }

    return res.send('ok');
  } catch (err) {
    console.error("[ERROR manejarCallbackTelegram]", err);
    res.send('error');
  }
}

module.exports = { manejarCallbackTelegram };