// config.js
require('dotenv').config();

module.exports = {
  app: {
    port: process.env.PORT || 3000,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'tu_secreto_super_seguro',
    expiresIn: '24h',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'qwe123.$',
    database: process.env.DB_NAME || 'backend-ustay',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  },
  googleAuth: {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '',
  },
  frontendUrl: process.env.FRONTEND_URL
};
