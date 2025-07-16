// app.js
const express = require('express');
const session = require('express-session');
const passport = require('./passportConfig'); // Configuración Passport
const cors = require('cors');
const config = require('./config');

// Importar rutas
const userRoutes = require('./modules/user/rutas');
const rolRoutes = require('./modules/rol/rutas');
const direccionRoutes = require('./modules/direccion/rutas');
const partnerRoutes = require('./modules/partner/rutas');
const propiedadRoutes = require('./modules/propiedad/rutas');
const cuartoRoutes = require('./modules/cuarto/rutas');
const servicioRoutes = require('./modules/servicio/rutas');
const resenaRoutes = require('./modules/resena/rutas');
const favoritoRoutes = require('./modules/favorito/rutas');
const inspeccionRoutes = require('./modules/inspeccion/rutas');
const subscripcionRoutes = require('./modules/subscripcion/rutas');
const puntosRoutes = require('./modules/puntos/rutas');

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Permitir solo el frontend
    credentials: true, // Permitir envío de cookies/sesiones
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_secret_key', // Usar variable de entorno
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }, // Cookies seguras en producción
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Rutas de autenticación con Google
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  (req, res) => {
    console.log('Callback URL configurada:', process.env.GOOGLE_CALLBACK_URL);
    console.log('Frontend URL:', process.env.FRONTEND_URL);
    console.log('Usuario recibido:', req.user);
    // Generar un token JWT (o tu lógica de token)
    const token = 'tu_logica_para_generar_token'; // Implementa tu lógica de JWT aquí
    res.redirect(`${process.env.FRONTEND_URL}/home?token=${token}`);
  }
);

// Rutas de la app
app.use('/', userRoutes);
app.use('/usuario', userRoutes);
app.use('/rol', rolRoutes);
app.use('/direccion', direccionRoutes);
app.use('/partner', partnerRoutes);
app.use('/propiedad', propiedadRoutes);
app.use('/cuarto', cuartoRoutes);
app.use('/servicio', servicioRoutes);
app.use('/resena', resenaRoutes);
app.use('/favorito', favoritoRoutes);
app.use('/inspeccion', inspeccionRoutes);
app.use('/subscripcion', subscripcionRoutes);
app.use('/puntos', puntosRoutes);

// Ruta base simple
app.get('/', (req, res) => {
  res.send('¡Bienvenido! al backend de ustay funcionando.');
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Algo salió mal!',
    error: process.env.NODE_ENV === 'development' ? err.message : {},
  });
});

module.exports = app;
