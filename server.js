const express = require('express');
const bodyParser = require('body-parser');
const { procesarSiguientesCortesCaja } = require('./procesarCortes'); // exporta la función en procesarCortes.js
const db = require('./db');

const app = express();
app.use(bodyParser.json());

const fetch = require('node-fetch');

// Webhook para Telegram: Maneja botones inline (callback_query)
app.post('/telegram', async (req, res) => {
  try {
    const body = req.body;

    if (!body || !body.callback_query) {
      return res.status(200).json({ status: "no_callback_query" });
    }

    const cb = body.callback_query;
    const accion = cb.data;

    // Aquí puedes procesar acciones como CONFIRMAR|sucursal|idCorte o DESCARTAR|sucursal|idCorte
    if (accion.startsWith('CONFIRMAR|') || accion.startsWith('DESCARTAR|')) {
      const [tipo, sucursal, idCorte] = accion.split('|');
      // --- Aquí agregarías tu lógica de confirmación/descartar ---
      // Guarda la confirmación o descarte en la base de datos
      try {
        await db.query(
          `UPDATE cortes_caja SET estado = $1, fecha_confirmacion = NOW()
           WHERE id_corte = $2 AND sucursal = $3`,
          [tipo === "CONFIRMAR" ? "confirmado" : "descartado", idCorte, sucursal]
        );
        console.log(`[BD] Corte ${idCorte} de ${sucursal} actualizado a ${tipo}`);
      } catch (err) {
        console.error(`[BD] Error actualizando corte:`, err);
      }
      // Por ejemplo, actualizar el registro en BD (puedes usar una función guardarConfirmacion)
      console.log(`[TELEGRAM] ${tipo} recibido para sucursal ${sucursal}, corte ${idCorte}`);

      // Puedes enviar una edición del mensaje a Telegram si quieres dar feedback visual:
      const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
      const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
      let texto;
      if (tipo === "CONFIRMAR") {
        texto = `✅ Corte *${sucursal}* ID *${idCorte}* confirmado!`;
      } else {
        texto = `❌ Corte *${sucursal}* ID *${idCorte}* descartado.`;
      }
      // Edita el mensaje original
      await fetch(`${BOT_URL}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
          text: texto,
          parse_mode: "Markdown"
        })
      });
    }

    // Responde al callback para liberar el círculo de carga de Telegram
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const BOT_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    await fetch(`${BOT_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: cb.id
      })
    });

    res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("❌ Error procesando callback de Telegram:", e);
    res.status(200).json({ status: "error", error: e.toString() });
  }
});

// Endpoint manual para lanzar cortes (opcional, puedes borrar si no usas)
app.get('/procesar', async (req, res) => {
  await procesarSiguientesCortesCaja();
  res.send('Procesamiento ejecutado');
});

const cron = require('node-cron');

// Ejecutar procesamiento automático cada 3 minutos, solo en horario permitido
cron.schedule('*/3 7-22 * * *', async () => {
  console.log('⏰ Ejecutando procesamiento automático de cortes (7:00-22:59)...');
  await procesarSiguientesCortesCaja();
}, {
  timezone: "America/El_Salvador"
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en puerto ${PORT}`);
});