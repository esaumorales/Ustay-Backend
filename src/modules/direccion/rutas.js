const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todas las direcciones
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [direcciones] = await connection.query('SELECT * FROM Direccion');
        connection.release();
        
        res.json({ direcciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener direcciones', error: error.message });
    }
});

// Obtener dirección específica
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [direcciones] = await connection.query('SELECT * FROM Direccion WHERE direccion_id = ?', [req.params.id]);
        connection.release();

        if (direcciones.length === 0) {
            return res.status(404).json({ message: 'Dirección no encontrada' });
        }
        
        res.json({ direccion: direcciones[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener dirección', error: error.message });
    }
});

module.exports = router;