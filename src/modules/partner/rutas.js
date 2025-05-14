const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los partners
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
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

module.exports = router;