const fetch = require('node-fetch');
require('dotenv').config();

const BOT_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

async function notificarCorteEnTelegram(datos, chatId) {
  let diferencia = datos.diferencia || 0;
  let msj = `🧾 *Corte* *${datos.sucursal}:* \n\n${datos.fecha} ${datos.hora}\n\n*Diferencia:* `;
  msj += (!diferencia || Math.abs(diferencia) < 0.01) ?
    "_Exacto, felicidades!_" :
    `*${diferencia > 0 ? "+$" : "$"}${diferencia.toFixed(2)}*`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `CONFIRMAR|${datos.sucursal}|${datos.idCorte}` },
        { text: "❌ Descartar", callback_data: `DESCARTAR|${datos.sucursal}|${datos.idCorte}` }
      ]
    ]
  };

  await fetch(`${BOT_URL}/sendMessage`, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: msj,
      parse_mode: "Markdown",
      reply_markup
    })
  });
}

module.exports = { notificarCorteEnTelegram };