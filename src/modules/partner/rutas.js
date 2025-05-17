const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los partners
// Obtener todos los partners (solo administradores)
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // Verificar si el usuario que realiza la solicitud es administrador
        const [adminUser] = await connection.query('SELECT rol_id FROM Usuario WHERE usuario_id = ?', [req.user.id]);
        if (adminUser.length === 0 || adminUser[0].rol_id !== 3) { // 3 es el rol de Administrador
            connection.release();
            return res.status(403).json({ message: 'Acceso denegado: solo los administradores pueden ver todos los partners' });
        }

        const [partners] = await connection.query(`
            SELECT p.*, u.nombre, u.apellido_pa, u.apellido_ma, u.correo_electronico 
            FROM Partner p 
            JOIN Usuario u ON p.partner_id = u.usuario_id
        `);
        connection.release();
        
        res.json({ partners });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener partners', error: error.message });
    }
});

// Obtener partner específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [partners] = await connection.query(`
            SELECT p.*, u.nombre, u.apellido_pa, u.apellido_ma, u.correo_electronico 
            FROM Partner p 
            JOIN Usuario u ON p.partner_id = u.usuario_id 
            WHERE p.partner_id = ?
        `, [req.params.id]);
        connection.release();

        if (partners.length === 0) {
            return res.status(404).json({ message: 'Partner no encontrado' });
        }
        
        res.json({ partner: partners[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener partner', error: error.message });
    }
});

router.get('/public', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [partners] = await connection.query(`
            SELECT u.nombre, u.apellido_pa, u.apellido_ma, u.correo_electronico, p.direccion
            FROM Partner p
            JOIN Usuario u ON p.partner_id = u.usuario_id
        `);
        connection.release();
        
        res.json({ partners });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener datos públicos de partners', error: error.message });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [partner] = await connection.query(`
            SELECT p.*, u.nombre, u.apellido_pa, u.apellido_ma, u.correo_electronico 
            FROM Partner p 
            JOIN Usuario u ON p.partner_id = u.usuario_id 
            WHERE p.partner_id = ?
        `, [req.user.id]);
        connection.release();

        if (partner.length === 0) {
            return res.status(404).json({ message: 'Partner no encontrado' });
        }
        
        res.json({ partner: partner[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener datos del partner', error: error.message });
    }
});

module.exports = router;