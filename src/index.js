// index.js
require('dotenv').config();
const app = require('./app');
const config = require('./config');

const PORT = config.app.port;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
