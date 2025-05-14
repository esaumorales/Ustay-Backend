const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener reseñas por cuarto
router.get('/cuarto/:cuartoId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [resenas] = await connection.query(`
            SELECT r.*, u.nombre, u.apellido_pa
            FROM Reseña r
            JOIN Usuario u ON r.usuario_id = u.usuario_id
            WHERE r.cuarto_id = ?
        `, [req.params.cuartoId]);
        connection.release();
        
        res.json({ resenas });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener reseñas del cuarto', error: error.message });
    }
});

// Obtener reseñas por usuario
router.get('/usuario/:usuarioId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [resenas] = await connection.query(`
            SELECT r.*, c.nombre as nombre_cuarto, p.direccion as direccion_propiedad
            FROM Reseña r
            JOIN Cuarto c ON r.cuarto_id = c.cuarto_id
            JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            WHERE r.usuario_id = ?
        `, [req.params.usuarioId]);
        connection.release();
        
        res.json({ resenas });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener reseñas del usuario', error: error.message });
    }
});

module.exports = router;