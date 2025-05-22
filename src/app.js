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

const app = express();

// Middlewares

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your_secret_key', // Mejor usar variable de entorno
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

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

// Ruta base simple
app.get('/', (req, res) => {
  res.send('¡Bienvenido! Autenticación con Google funcionando.');
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

module.exports = app;
