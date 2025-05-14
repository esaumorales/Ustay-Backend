const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todas las propiedades
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
        `);
        connection.release();
        
        res.json({ propiedades });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedades', error: error.message });
    }
});

// Obtener propiedad específica
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            WHERE p.propiedad_id = ?
        `, [req.params.id]);
        connection.release();

        if (propiedades.length === 0) {
            return res.status(404).json({ message: 'Propiedad no encontrada' });
        }
        
        res.json({ propiedad: propiedades[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedad', error: error.message });
    }
});

// Obtener propiedades por partner
router.get('/partner/:partnerId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            WHERE p.partner_id = ?
        `, [req.params.partnerId]);
        connection.release();
        
        res.json({ propiedades });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedades del partner', error: error.message });
    }
});

module.exports = router;