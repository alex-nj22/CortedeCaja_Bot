// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { enviarCorte, procesarUpdateTelegram } = require('./index'); // Ajusta si tu función está en otro archivo

const app = express();
app.use(bodyParser.json());

// Endpoint para recibir eventos de Telegram
app.post('/telegram', async (req, res) => {
  await procesarUpdateTelegram(req.body);
  res.sendStatus(200);
});

// Tarea automática cada 3 minutos, solo en horario permitido (7am-10pm)
cron.schedule('*/3 7-22 * * *', async () => {
  console.log("Enviando corte automático...");
  await enviarCorte();
}, {
  timezone: "America/El_Salvador" // Cambia según tu zona, verifica aquí: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Servidor Express escuchando en puerto', PORT);
});