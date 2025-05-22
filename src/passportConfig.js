const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./database');
const config = require('./config');

// Definir constantes para los roles
const ROLE_USER = 1;
const ROLE_PARTNER = 2;
const ROLE_ADMIN = 3;

passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleAuth.clientID,
      clientSecret: config.googleAuth.clientSecret,
      callbackURL: config.googleAuth.callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const connection = await pool.getConnection();

        const [existingUser] = await connection.query(
          'SELECT * FROM Usuario WHERE google_id = ?',
          [profile.id]
        );

        let user;
        if (existingUser.length > 0) {
          user = existingUser[0];
        } else {
          // Dividir el nombre completo en partes
          const nameParts = profile.displayName.split(' ');
          const nombre = nameParts[0] || '';
          const apellido_pa = nameParts[1] || '';
          const apellido_ma = nameParts.slice(2).join(' ') || '';

          const [result] = await connection.query(
            'INSERT INTO Usuario (google_id, nombre, apellido_pa, apellido_ma, correo_electronico, google_foto, rol_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              profile.id,
              nombre,
              apellido_pa,
              apellido_ma,
              profile.emails[0].value,
              profile.photos[0].value,
              1 // Asignar un rol por defecto, puedes cambiarlo según tu lógica
            ]
          );

          user = {
            usuario_id: result.insertId,
            google_id: profile.id,
            nombre,
            apellido_pa,
            apellido_ma,
            correo_electronico: profile.emails[0].value,
            google_foto: profile.photos[0].value,
            rol_id: ROLE_USER
          };
        }

        connection.release();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.usuario_id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM Usuario WHERE usuario_id = ?',
      [id]
    );
    connection.release();

    if (rows.length === 0) return done(new Error('User not found'), null);
    return done(null, rows[0]);
  } catch (error) {
    return done(error, null);
  }
});

module.exports = passport;
