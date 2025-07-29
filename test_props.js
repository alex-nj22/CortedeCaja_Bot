// test_props.js
const { setProperty, getProperty } = require('./props');

(async () => {
  // Guarda un valor de prueba
  await setProperty('testKey', 'testValue');

  // Lee el valor guardado
  const value = await getProperty('testKey');
  console.log('Valor leído:', value);
})();