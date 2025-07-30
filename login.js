const fetch = require('node-fetch');

async function iniciarSesion() {
  try {
    const payload = new URLSearchParams({
      username: "documentop.supervisor",
      password: "documento9999",
      m: "1"
    });
    const response = await fetch("https://clientesdte.oss.com.sv/farma_salud/login.php", {
      method: "POST",
      body: payload,
      redirect: 'manual'
    });
    const cookies = response.headers.raw()['set-cookie'];
    if (!cookies) return null;
    const cookie = cookies.find(c => c.includes('PHPSESSID='));
    if (!cookie) return null;
    return cookie.match(/PHPSESSID=[^;]+/)[0];
  } catch (e) {
    console.error("❌ [login.js] Error en iniciarSesion:", e);
    return null;
  }
}

module.exports = { iniciarSesion };