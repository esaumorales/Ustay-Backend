const express = require('express');
const passport = require('passport');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../config');
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');
const bcrypt = require('bcrypt'); // Asegúrate de importar bcrypt
//Ruta frontendimage.pngimage.png
const FRONTEND_URL = process.env.FRONTEND_URL || '';
//USER AND EMAIL
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_USER = process.env.EMAIL_USER;

const nodemailer = require('nodemailer');


// Ruta para iniciar sesión con Google
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticación fallida' });
    }

    const token = jwt.sign(
      {
        id: req.user.usuario_id,
        email: req.user.correo_electronico,
        rol: req.user.rol_id || 'usuario',
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Redirige al frontend pasando el token como parámetro en la URL
    res.redirect(`${FRONTEND_URL}/home?token=${encodeURIComponent(token)}`);
  }
);



// Ruta para cerrar sesión
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});


// Ruta para recuperar contraseña
router.post('/recover-password', async (req, res) => {
  let connection;
  try {
    const { correo_electronico } = req.body;
    if (!correo_electronico) {
      return res.status(400).json({ message: 'Correo electrónico requerido' });
    }

    connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ?',
      [correo_electronico]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'No existe una cuenta con este correo electrónico' });
    }

    const verificationCode = Math.floor(10000 + Math.random() * 90000).toString();

    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 30);

    await connection.query(
      'UPDATE Usuario SET codigo_recuperacion = ?, expiracion_codigo = ?, codigo_verificado = FALSE WHERE correo_electronico = ?',
      [verificationCode, expirationTime, correo_electronico]
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: correo_electronico,
      subject: 'Recuperación de contraseña',
      text: `Tu código de verificación es: ${verificationCode}\nEste código expirará en 30 minutos.`,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Correo de recuperación enviado' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el proceso de recuperación', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Ruta para verificar código
// Ruta para verificar código sin cambiar contraseña
router.post('/verify-code', async (req, res) => {
  let connection;
  try {
    const { correo_electronico, code } = req.body;

    if (!correo_electronico || !code) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ? AND codigo_recuperacion = ?',
      [correo_electronico, code]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Código inválido' });
    }

    const user = users[0];
    const now = new Date();
    const expirationTime = new Date(user.expiracion_codigo);

    if (now > expirationTime) {
      return res.status(400).json({ message: 'Código expirado' });
    }

    res.json({ message: 'Código verificado correctamente', userId: user.usuario_id });
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar el código', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/change-password', async (req, res) => {
  let connection;
  try {
    const { correo_electronico, code, nuevaContrasena } = req.body;

    if (!correo_electronico || !code || !nuevaContrasena) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    connection = await pool.getConnection();

    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ? AND codigo_recuperacion = ?',
      [correo_electronico, code]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Código inválido' });
    }

    const user = users[0];
    const now = new Date();
    const expirationTime = new Date(user.expiracion_codigo);

    if (now > expirationTime) {
      return res.status(400).json({ message: 'Código expirado' });
    }

    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
    console.log('Hashed password:', hashedPassword);

    const [result] = await connection.query(
      `UPDATE Usuario 
       SET contrasena = ?, codigo_verificado = TRUE, codigo_recuperacion = NULL, expiracion_codigo = NULL 
       WHERE correo_electronico = ?`,
      [hashedPassword, correo_electronico]
    );

    console.log('Filas afectadas:', result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'No se actualizó la contraseña. Verifica el correo.' });
    }

    res.json({ message: 'Contraseña actualizada correctamente', userId: user.usuario_id });
  } catch (error) {
    console.error('Error actualizar contraseña:', error);
    res.status(500).json({ message: 'Error al actualizar la contraseña', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});



// Ruta para registro de usuario
router.post('/register', async (req, res) => {
  try {
    const {
      nombre,
      apellido_pa,
      apellido_ma,
      correo_electronico,
      contrasena,
      rol_id,
    } = req.body;

    if (
      !nombre ||
      !apellido_pa ||
      !correo_electronico ||
      !contrasena ||
      !rol_id
    ) {
      return res
        .status(400)
        .json({ message: 'Todos los campos son requeridos' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo_electronico)) {
      return res
        .status(400)
        .json({ message: 'Formato de correo electrónico inválido' });
    }

    const connection = await pool.getConnection();
    const [existingUser] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ?',
      [correo_electronico]
    );

    if (existingUser.length > 0) {
      connection.release();
      return res
        .status(400)
        .json({ message: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    const [result] = await connection.query(
      'INSERT INTO Usuario (rol_id, nombre, apellido_pa, apellido_ma, correo_electronico, contrasena) VALUES (?, ?, ?, ?, ?, ?)',
      [
        rol_id,
        nombre,
        apellido_pa,
        apellido_ma,
        correo_electronico,
        hashedPassword,
      ]
    );

    connection.release();

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      usuario_id: result.insertId,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al registrar usuario', error: error.message });
  }
});

// Ruta para login
router.post('/login', async (req, res) => {
  try {
    const { correo_electronico, contrasena } = req.body;

    if (!correo_electronico || !contrasena) {
      return res.status(400).json({ message: 'Correo electrónico y contraseña son requeridos' });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ?',
      [correo_electronico]
    );

    connection.release();

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const usuario = users[0];
    console.log('Usuario encontrado:', usuario);

    const validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      {
        id: usuario.usuario_id,
        email: usuario.correo_electronico,
        rol: usuario.rol_id,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      token,
      usuario: {
        id: usuario.usuario_id,
        nombre: usuario.nombre,
        correo: usuario.correo_electronico,
        rol: usuario.rol_id,
      },
      message: 'Login exitoso',
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
});

// Ruta protegida para obtener perfil
router.get('/perfil', verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT usuario_id, rol_id, nombre, apellido_pa, apellido_ma, correo_electronico FROM Usuario WHERE usuario_id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ user: users[0], message: 'Perfil obtenido exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener perfil', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Ruta para actualizar el rol de un usuario
router.put('/update-role/:usuarioId', verifyToken, async (req, res) => {
  try {
    const { rol_id } = req.body;
    const { usuarioId } = req.params;

    const connection = await pool.getConnection();
    const [adminUser] = await connection.query(
      'SELECT rol_id FROM Usuario WHERE usuario_id = ?',
      [req.user.id]
    );
    if (adminUser.length === 0 || adminUser[0].rol_id !== 3) {
      connection.release();
      return res.status(403).json({
        message:
          'Acceso denegado: solo los administradores pueden cambiar roles',
      });
    }

    const [existingUser] = await connection.query(
      'SELECT * FROM Usuario WHERE usuario_id = ?',
      [usuarioId]
    );
    if (existingUser.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await connection.query(
      'UPDATE Usuario SET rol_id = ? WHERE usuario_id = ?',
      [rol_id, usuarioId]
    );

    if (rol_id === 2) {
      const [existingPartner] = await connection.query(
        'SELECT * FROM Partner WHERE partner_id = ?',
        [usuarioId]
      );
      if (existingPartner.length === 0) {
        await connection.query('INSERT INTO Partner (partner_id) VALUES (?)', [
          usuarioId,
        ]);
      }
    } else {
      await connection.query('DELETE FROM Partner WHERE partner_id = ?', [
        usuarioId,
      ]);
    }

    connection.release();

    res.json({ message: 'Rol actualizado exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al actualizar rol', error: error.message });
  }
});

// Ruta para cambiar la contraseña
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Se requieren la contraseña actual y la nueva contraseña',
      });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE usuario_id = ?',
      [userId]
    );

    if (users.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const usuario = users[0];
    const validPassword = await bcrypt.compare(
      currentPassword,
      usuario.contrasena
    );
    if (!validPassword) {
      connection.release();
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await connection.query(
      'UPDATE Usuario SET contrasena = ? WHERE usuario_id = ?',
      [hashedNewPassword, userId]
    );

    connection.release();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({
      message: 'Error al cambiar la contraseña',
      error: error.message,
    });
  }
});
module.exports = router;
