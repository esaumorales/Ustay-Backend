const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener subscripciones por usuario
router.get('/usuario/:usuarioId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [subscripciones] = await connection.query(`
            SELECT s.*, p.direccion as propiedad_direccion
            FROM Subscripcion s
            JOIN Propiedad p ON s.propiedad_id = p.propiedad_id
            WHERE s.usuario_id = ?
        `, [req.params.usuarioId]);
        connection.release();
        
        res.json({ subscripciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener subscripciones del usuario', error: error.message });
    }
});

// Obtener subscripciones por propiedad
router.get('/propiedad/:propiedadId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [subscripciones] = await connection.query(`
            SELECT s.*, u.nombre, u.apellido_pa, u.correo_electronico
            FROM Subscripcion s
            JOIN Usuario u ON s.usuario_id = u.usuario_id
            WHERE s.propiedad_id = ?
        `, [req.params.propiedadId]);
        connection.release();
        
        res.json({ subscripciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener subscripciones de la propiedad', error: error.message });
    }
});

module.exports = router;