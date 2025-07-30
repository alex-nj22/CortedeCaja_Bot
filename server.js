const express = require('express');
const bodyParser = require('body-parser');
const { procesarSiguientesCortesCaja } = require('./procesarCortes');
const db = require('./db');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
app.use(bodyParser.json());

// CRON: Ejecutar cada 3 minutos entre 7am y 10:20pm
cron.schedule('*/3 7-22 * * *', async () => {
  console.log('⏰ Ejecutando procesamiento automático de cortes (7:00-22:59)...');
  await procesarSiguientesCortesCaja();
}, { timezone: "America/El_Salvador" });

// Endpoint manual para debugging
app.get('/procesar', async (req, res) => {
  await procesarSiguientesCortesCaja();
  res.send('Procesamiento ejecutado');
});

// Webhook para Telegram (procesar botones)
app.post('/telegram', async (req, res) => {
  try {
    const body = req.body;
    if (!body || !body.callback_query) return res.status(200).json({ status: "no_callback_query" });

    const cb = body.callback_query;
    const accion = cb.data;
    if (accion.startsWith('CONFIRMAR|') || accion.startsWith('DESCARTAR|')) {
      const [tipo, idCorte] = accion.split('|');
      // Actualiza el estado del corte en la base de datos
      await db.query(
        `UPDATE cortes_caja SET estado = $1, fecha_confirmacion = NOW()
         WHERE id_corte = $2`,
        [tipo === "CONFIRMAR" ? "confirmado" : "descartado", idCorte]
      );
      // Edita el mensaje original en Telegram
      const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: tipo === "CONFIRMAR"
            ? `✅ Corte ID ${idCorte} confirmado!`
            : `❌ Corte ID ${idCorte} descartado.`,
          parse_mode: "Markdown"
        })
      });
    }
    // Responde a Telegram para liberar el círculo de carga
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: cb.id })
    });
    res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("❌ Error procesando callback de Telegram:", e);
    res.status(200).json({ status: "error", error: e.toString() });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en puerto ${PORT}`);
});