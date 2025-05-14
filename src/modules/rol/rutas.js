const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los roles
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [roles] = await connection.query('SELECT * FROM Rol');
        connection.release();
        
        res.json({ roles });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener roles', error: error.message });
    }
});

// Obtener rol específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [roles] = await connection.query('SELECT * FROM Rol WHERE rol_id = ?', [req.params.id]);
        connection.release();

        if (roles.length === 0) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        
        res.json({ rol: roles[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener rol', error: error.message });
    }
});

module.exports = router;