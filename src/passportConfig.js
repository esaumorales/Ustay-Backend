const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./database');
const config = require('./config');

// Definir constantes para los roles
const ROLE_USER = 1;

passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleAuth.clientID,
      clientSecret: config.googleAuth.clientSecret,
      callbackURL: config.googleAuth.callbackURL,
    },
    async (accessToken, refreshToken, profile, done) => {
      let connection;
      try {
        console.log('Perfil recibido de Google:', JSON.stringify(profile, null, 2));
        connection = await pool.getConnection();
        console.log('Conexión DB obtenida para GoogleStrategy');

        const email = profile.emails?.[0]?.value;
        if (!email) {
          console.error('No se proporcionó correo electrónico en el perfil');
          return done(new Error('Correo electrónico no disponible'), null);
        }

        // Buscar primero por google_id
        const [existingUserByGoogleId] = await connection.query(
          'SELECT * FROM Usuario WHERE google_id = ?',
          [profile.id]
        );

        if (existingUserByGoogleId.length > 0) {
          console.log('Usuario encontrado por google_id:', existingUserByGoogleId[0]);
          return done(null, existingUserByGoogleId[0]);
        }

        // Buscar por correo electrónico
        const [existingUserByEmail] = await connection.query(
          'SELECT * FROM Usuario WHERE correo_electronico = ?',
          [email]
        );

        if (existingUserByEmail.length > 0) {
          console.log('Usuario existente con ese correo, actualizando google_id y foto');

          await connection.query(
            'UPDATE Usuario SET google_id = ?, google_foto = ? WHERE correo_electronico = ?',
            [profile.id, profile.photos?.[0]?.value || '', email]
          );

          const [updatedUser] = await connection.query(
            'SELECT * FROM Usuario WHERE correo_electronico = ?',
            [email]
          );

          return done(null, updatedUser[0]);
        }

        // Si no existe, crear nuevo usuario
        const nameParts = profile.displayName ? profile.displayName.split(' ') : [];
        const nombre = nameParts[0] || '';
        const apellido_pa = nameParts[1] || '';
        const apellido_ma = nameParts.length > 2 ? nameParts.slice(2).join(' ') : '';
        const photo = profile.photos?.[0]?.value || '';

        const [result] = await connection.query(
          'INSERT INTO Usuario (google_id, nombre, apellido_pa, apellido_ma, correo_electronico, google_foto, rol_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            profile.id,
            nombre,
            apellido_pa,
            apellido_ma,
            email,
            photo,
            ROLE_USER
          ]
        );

        const newUser = {
          usuario_id: result.insertId,
          google_id: profile.id,
          nombre,
          apellido_pa,
          apellido_ma,
          correo_electronico: email,
          google_foto: photo,
          rol_id: ROLE_USER
        };

        console.log('Nuevo usuario creado:', newUser);
        return done(null, newUser);

      } catch (error) {
        console.error('Error en GoogleStrategy:', error.message, error.stack);
        return done(error, null);
      } finally {
        if (connection) {
          connection.release();
          console.log('Conexión DB liberada');
        }
      }
    }
  )
);

passport.serializeUser((user, done) => {
  console.log('Serializando usuario:', user.usuario_id);
  done(null, user.usuario_id);
});

passport.deserializeUser(async (id, done) => {
  let connection;
  try {
    console.log('Deserializando usuario con ID:', id);
    connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM Usuario WHERE usuario_id = ?',
      [id]
    );
    if (rows.length === 0) {
      console.error('Usuario no encontrado para ID:', id);
      return done(new Error('User not found'), null);
    }
    console.log('Usuario deserializado:', rows[0]);
    return done(null, rows[0]);
  } catch (error) {
    console.error('Error en deserializeUser:', error.message, error.stack);
    return done(error, null);
  } finally {
    if (connection) {
      connection.release();
      console.log('Conexión DB liberada en deserializeUser');
    }
  }
});

module.exports = passport;
