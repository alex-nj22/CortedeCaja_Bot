const fetch = require('node-fetch');

async function notificarCorteEnTelegram(dataCorte, idCorte) {
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  let msj = `🧾 Corte ID: ${idCorte}\n\n*Movimiento:*\n${dataCorte.movimiento?.slice(0, 1200) || "Sin datos"}`;
  const reply_markup = {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `CONFIRMAR|${idCorte}` },
        { text: "❌ Descartar", callback_data: `DESCARTAR|${idCorte}` }
      ]
    ]
  };
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msj,
      parse_mode: "Markdown",
      reply_markup
    })
  });
}

module.exports = { notificarCorteEnTelegram };