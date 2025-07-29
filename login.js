const fetch = require('node-fetch');

async function iniciarSesion(credenciales) {
  const urlLogin = 'https://clientesdte.oss.com.sv/farma_salud/login.php';

  const payload = new URLSearchParams();
  payload.append('username', credenciales.username);  // <--- CORRECTO
  payload.append('password', credenciales.password);  // <--- CORRECTO
  payload.append('m', '1');

  const res = await fetch(urlLogin, {
    method: 'POST',
    body: payload,
    redirect: 'manual'
  });

  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No se recibieron cookies de sesión');
  const sessionCookie = setCookie.match(/PHPSESSID=[^;]+/)[0];
  return sessionCookie;
}

module.exports = { iniciarSesion };