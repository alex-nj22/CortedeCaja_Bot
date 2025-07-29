const express = require('express');
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = 'AQUI_TU_TOKEN';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const app = express();
app.use(express.json());

// Endpoint para Webhook de Telegram
app.post('/webhook', async (req, res) => {
    const body = req.body;

    // Responde de inmediato a Telegram para no perder updates
    res.sendStatus(200);

    if (!body || !body.callback_query) return;

    const cb = body.callback_query;
    const accion = cb.data;

    // Responde a los botones
    if (cb && cb.message && accion) {
        // Responde el botón para liberar el UI
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: cb.id })
        });

        // Respuesta de prueba (puedes mejorarla luego)
        await fetch(`${TELEGRAM_API}/editMessageText`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: cb.message.chat.id,
                message_id: cb.message.message_id,
                text: `Acción recibida: ${accion}`
            })
        });
    }
});

// Healthcheck
app.get('/', (req, res) => {
    res.send('Bot Corte de Caja OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});