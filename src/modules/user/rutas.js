const express = require('express');
const passport = require('passport');
const router = express.Router();
const jwt = require('jsonwebtoken');
const config = require('../../config');
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_USER = process.env.EMAIL_USER;

// Función para formatear fecha a formato MySQL DATETIME
function formatDateToMySQL(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Ruta para iniciar sesión con Google
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback de Google OAuth mejorado
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  async (req, res) => {
    let connection;
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Autenticación fallida' });
      }

      connection = await pool.getConnection();

      // Verificar si el usuario ya existe en la base de datos
      const [existingUsers] = await connection.query(
        'SELECT * FROM Usuario WHERE correo_electronico = ?',
        [req.user.email]
      );

      let usuario;

      if (existingUsers.length > 0) {
        // Usuario existe, usar datos existentes
        usuario = existingUsers[0];
      } else {
        // Usuario no existe, crear nuevo usuario
        const newUUID = uuidv4();
        const [result] = await connection.query(
          `INSERT INTO Usuario (
            rol_id, nombre, apellido_pa, apellido_ma, 
            correo_electronico, correo_verificado, uuid, 
            google_id, fecha_registro
          ) VALUES (?, ?, ?, ?, ?, TRUE, ?, ?, NOW())`,
          [
            1, // rol_id por defecto (usuario normal)
            req.user.name.split(' ')[0] || 'Usuario',
            req.user.name.split(' ')[1] || '',
            req.user.name.split(' ')[2] || '',
            req.user.email,
            newUUID,
            req.user.googleId
          ]
        );

        // Obtener el usuario recién creado
        const [newUser] = await connection.query(
          'SELECT * FROM Usuario WHERE usuario_id = ?',
          [result.insertId]
        );
        usuario = newUser[0];
      }

      // Generar token JWT
      const token = jwt.sign(
        {
          id: usuario.usuario_id,
          email: usuario.correo_electronico,
          rol: usuario.rol_id || 1,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      // Redirigir al frontend con el token
      res.redirect(`${FRONTEND_URL}/home?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Error en Google OAuth callback:', error);
      res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
    } finally {
      if (connection) connection.release();
    }
  }
);

// Ruta para cerrar sesión
router.get('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});

// Ruta para recuperar contraseña (ACTUALIZADA A 6 DÍGITOS)
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
      return res
        .status(404)
        .json({ message: 'No existe una cuenta con este correo electrónico' });
    }

    // CAMBIADO: Generar código de 6 dígitos
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 30);
    const expirationFormatted = formatDateToMySQL(expirationTime);

    await connection.query(
      'UPDATE Usuario SET codigo_recuperacion = ?, expiracion_codigo = ?, codigo_verificado = FALSE WHERE correo_electronico = ?',
      [verificationCode, expirationFormatted, correo_electronico]
    );

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Soporte USTAY" <${EMAIL_USER}>`,
      to: correo_electronico,
      subject: 'Recuperación de contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #F9F9F9; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border: 1px solid #ddd; border-radius: 8px; padding: 30px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://res.cloudinary.com/djasvvxs9/image/upload/v1752538991/rxlwrvnxkj1hatngj07d.png" alt="Logo" style="height: 60px;" />
              <h2 style="color: #F05B20; margin: 10px 0 0;">Recuperación de Contraseña</h2>
            </div>
    
            <p style="color: #111827; font-size: 16px;">Estimado usuario,</p>
    
            <p style="color: #111827; font-size: 15px;">
              Hemos recibido una solicitud para restablecer la contraseña de su cuenta asociada a este correo electrónico.
            </p>
    
            <p style="color: #111827; font-size: 15px; font-weight: bold;">Su código de verificación es:</p>
    
            <div style="background-color: #F05B20; color: white; font-size: 22px; font-weight: bold; text-align: center; padding: 12px 0; border-radius: 6px; margin: 20px 0;">
              ${verificationCode}
            </div>
    
            <p style="color: #111827; font-size: 14px;">
              Este código expirará en 30 minutos. Si usted no solicitó este cambio, puede ignorar este mensaje con tranquilidad.
            </p>
    
            <p style="color: #070A13; font-size: 14px; margin-top: 30px;">
              Atentamente,<br>
              <strong>Equipo de Soporte USTAY</strong>
            </p>
          </div>
    
          <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px;">
            © ${new Date().getFullYear()} USTAY. Todos los derechos reservados.
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Correo de recuperación enviado' });
  } catch (error) {
    res.status(500).json({
      message: 'Error en el proceso de recuperación',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Ruta para verificar código
router.post('/verify-code', async (req, res) => {
  let connection;
  try {
    const { correo_electronico, code } = req.body;

    if (!correo_electronico || !code) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    connection = await pool.getConnection();

    const cleanedCode = code.trim();

    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ? AND TRIM(codigo_recuperacion) = ?',
      [correo_electronico, cleanedCode]
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

    res.json({
      message: 'Código verificado correctamente',
      userId: user.usuario_id,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al verificar el código', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Cambio de contraseña
router.post('/change-password', async (req, res) => {
  let connection;
  try {
    const { correo_electronico, code, nuevaContrasena } = req.body;

    if (!correo_electronico || !code || !nuevaContrasena) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    connection = await pool.getConnection();

    const cleanedCode = code.trim();

    const [users] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ? AND TRIM(codigo_recuperacion) = ?',
      [correo_electronico, cleanedCode]
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

    const [result] = await connection.query(
      `UPDATE Usuario 
       SET contrasena = ?, codigo_verificado = TRUE, codigo_recuperacion = NULL, expiracion_codigo = NULL 
       WHERE correo_electronico = ?`,
      [hashedPassword, correo_electronico]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        message: 'No se actualizó la contraseña. Verifica el correo.',
      });
    }

    res.json({
      message: 'Contraseña actualizada correctamente',
      userId: user.usuario_id,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error al actualizar la contraseña',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Registro de usuario (paso 1) - ACTUALIZADO A 6 DÍGITOS
router.post('/register', async (req, res) => {
  let connection;
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

    connection = await pool.getConnection();

    const [existingUser] = await connection.query(
      'SELECT * FROM Usuario WHERE correo_electronico = ?',
      [correo_electronico]
    );

    if (existingUser.length > 0) {
      return res
        .status(400)
        .json({ message: 'El correo electrónico ya está registrado' });
    }

    // Eliminar registros temporales previos para evitar duplicados
    await connection.query(
      'DELETE FROM RegistroTemporal WHERE correo_electronico = ?',
      [correo_electronico]
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(contrasena, salt);

    // CAMBIADO: Generar código de 6 dígitos
    const codigo_verificacion = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    
    const expiracion = new Date();
    expiracion.setHours(expiracion.getHours() + 1);
    const expiracionFormatted = formatDateToMySQL(expiracion);

    await connection.query(
      `INSERT INTO RegistroTemporal (
        rol_id, nombre, apellido_pa, apellido_ma, 
        correo_electronico, contrasena, 
        codigo_verificacion, expiracion_codigo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rol_id,
        nombre,
        apellido_pa,
        apellido_ma,
        correo_electronico,
        hashedPassword,
        codigo_verificacion,
        expiracionFormatted,
      ]
    );

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: correo_electronico,
      subject: 'Verifica tu cuenta',
      html: `
        <h1>Bienvenido a nuestra plataforma</h1>
        <p>Tu código de verificación es: <strong>${codigo_verificacion}</strong></p>
        <p>Este código expirará en 1 hora.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'Código de verificación enviado al correo electrónico',
      correo_electronico,
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      message: 'Error al iniciar registro',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Verificar código y crear usuario (paso 2)
router.post('/verify-email', async (req, res) => {
  let connection;
  try {
    const { correo_electronico, codigo } = req.body;

    if (!correo_electronico || !codigo) {
      return res
        .status(400)
        .json({ message: 'Correo y código son requeridos' });
    }

    connection = await pool.getConnection();

    console.log('Verificando código:', correo_electronico, codigo);

    const cleanedCode = codigo.trim();

    const [registroTemp] = await connection.query(
      `SELECT * FROM RegistroTemporal 
       WHERE correo_electronico = ? 
       AND TRIM(codigo_verificacion) = ? 
       AND expiracion_codigo > NOW()`,
      [correo_electronico, cleanedCode]
    );

    console.log('Resultado consulta RegistroTemporal:', registroTemp);

    if (registroTemp.length === 0) {
      return res.status(400).json({
        message: 'Código inválido o expirado',
      });
    }
    const newUUID = uuidv4();
    // Crear usuario con los datos temporales
    const [result] = await connection.query(
      `INSERT INTO Usuario (
        rol_id, nombre, apellido_pa, apellido_ma, 
        correo_electronico, contrasena, 
        correo_verificado, uuid
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        registroTemp[0].rol_id,
        registroTemp[0].nombre,
        registroTemp[0].apellido_pa,
        registroTemp[0].apellido_ma,
        registroTemp[0].correo_electronico,
        registroTemp[0].contrasena,
        newUUID,
      ]
    );

    await connection.query(
      'DELETE FROM RegistroTemporal WHERE correo_electronico = ?',
      [correo_electronico]
    );

    const token = jwt.sign(
      {
        id: result.insertId,
        email: correo_electronico,
        rol: registroTemp[0].rol_id,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id: result.insertId,
        nombre: registroTemp[0].nombre,
        correo: registroTemp[0].correo_electronico,
        rol: registroTemp[0].rol_id,
      },
    });
  } catch (error) {
    console.error('Error en verificación:', error);
    res.status(500).json({
      message: 'Error al verificar código',
      error: error.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { correo_electronico, contrasena } = req.body;

    if (!correo_electronico || !contrasena) {
      return res
        .status(400)
        .json({ message: 'Correo electrónico y contraseña son requeridos' });
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
    res
      .status(500)
      .json({ message: 'Error en el servidor', error: error.message });
  }
});

// Obtener perfil protegido
router.get('/perfil', verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const [users] = await connection.query(
      `SELECT usuario_id, rol_id, nombre, apellido_pa, apellido_ma, correo_electronico, fecha_registro 
       FROM Usuario 
       WHERE usuario_id = ?`,
      [req.user.id]
    );
    console.log(users[0]);

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

// Actualizar rol de usuario
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

// Cambiar contraseña
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