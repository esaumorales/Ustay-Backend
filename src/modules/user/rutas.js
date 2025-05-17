const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../../config');
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Ruta para registro de usuario
router.post('/register', async (req, res) => {
    try {
        const { 
            nombre, 
            apellido_pa, 
            apellido_ma, 
            correo_electronico, 
            contrasena,
            rol_id 
        } = req.body;

        // Validación de campos requeridos
        if (!nombre || !apellido_pa || !correo_electronico || !contrasena || !rol_id) {
            return res.status(400).json({ 
                message: 'Todos los campos son requeridos' 
            });
        }

        // Validación de formato de correo
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo_electronico)) {
            return res.status(400).json({ 
                message: 'Formato de correo electrónico inválido' 
            });
        }

        const connection = await pool.getConnection();

        // Verificar si el correo ya existe
        const [existingUser] = await connection.query(
            'SELECT * FROM Usuario WHERE correo_electronico = ?',
            [correo_electronico]
        );

        if (existingUser.length > 0) {
            connection.release();
            return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
        }

        // Hash de la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(contrasena, salt);

        // Insertar nuevo usuario
        const [result] = await connection.query(
            'INSERT INTO Usuario (rol_id, nombre, apellido_pa, apellido_ma, correo_electronico, contrasena) VALUES (?, ?, ?, ?, ?, ?)',
            [rol_id, nombre, apellido_pa, apellido_ma, correo_electronico, hashedPassword]
        );

        connection.release();

        res.status(201).json({ 
            message: 'Usuario registrado exitosamente',
            usuario_id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al registrar usuario', error: error.message });
    }
});

// Ruta para login
router.post('/login', async (req, res) => {
    try {
        const { correo_electronico, contrasena } = req.body;

        // Validación de campos requeridos
        if (!correo_electronico || !contrasena) {
            return res.status(400).json({ 
                message: 'Correo electrónico y contraseña son requeridos' 
            });
        }

        const connection = await pool.getConnection();

        // Buscar usuario
        const [users] = await connection.query(
            'SELECT * FROM Usuario WHERE correo_electronico = ?',
            [correo_electronico]
        );

        connection.release();

        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const usuario = users[0];

        // Verificar contraseña
        const validPassword = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!validPassword) {
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: usuario.usuario_id,
                email: usuario.correo_electronico,
                rol: usuario.rol_id
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
                rol: usuario.rol_id
            },
            message: 'Login exitoso'
        });
    } catch (error) {
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

        res.json({ 
            user: users[0],
            message: 'Perfil obtenido exitosamente'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener perfil', error: error.message });
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

        // Verificar si el usuario que realiza la solicitud es administrador
        const [adminUser] = await connection.query('SELECT rol_id FROM Usuario WHERE usuario_id = ?', [req.user.id]);
        if (adminUser.length === 0 || adminUser[0].rol_id !== 3) { // 3 es el rol de Administrador
            connection.release();
            return res.status(403).json({ message: 'Acceso denegado: solo los administradores pueden cambiar roles' });
        }

        // Verificar si el usuario existe
        const [existingUser] = await connection.query('SELECT * FROM Usuario WHERE usuario_id = ?', [usuarioId]);
        if (existingUser.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Actualizar rol
        await connection.query('UPDATE Usuario SET rol_id = ? WHERE usuario_id = ?', [rol_id, usuarioId]);

        // Si el rol es Partner, verifica si ya existe un registro en Partner
        if (rol_id === 2) { // 2 es el rol de Partner
            const [existingPartner] = await connection.query('SELECT * FROM Partner WHERE partner_id = ?', [usuarioId]);
            if (existingPartner.length === 0) {
                // Insertar nuevo registro en Partner
                await connection.query('INSERT INTO Partner (partner_id) VALUES (?)', [usuarioId]);
            }
        } else {
            // Si el rol no es Partner, eliminar el registro de Partner si existe
            await connection.query('DELETE FROM Partner WHERE partner_id = ?', [usuarioId]);
        }

        connection.release();

        res.json({ message: 'Rol actualizado exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar rol', error: error.message });
    }
});

module.exports = router;