require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { procesarCortes } = require('./index');
const { procesarUpdateTelegram } = require('./telegram'); // Ajusta si tu lógica de Telegram está en otro lado

const app = express();
app.use(bodyParser.json());

// Webhook de Telegram
app.post('/telegram', async (req, res) => {
  await procesarUpdateTelegram(req.body);
  res.sendStatus(200);
});

// Tarea automática cada 3 minutos (7:00 a 22:59)
const cron = require('node-cron');

// 1. Cada 3 min de 7:00 a 21:59
cron.schedule('*/3 7-21 * * *', async () => {
  console.log("⏰ Ejecutando procesamiento automático de cortes (7:00-21:59)...");
  await procesarCortes();
}, {
  timezone: "America/El_Salvador"
});

// 2. Cada 3 min de 22:00 a 22:20
cron.schedule('0-20/3 22 * * *', async () => {
  console.log("⏰ Ejecutando procesamiento automático de cortes (22:00-22:20)...");
  await procesarCortes();
}, {
  timezone: "America/El_Salvador"
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en puerto ${PORT}`);
});