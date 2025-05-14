const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener favoritos por usuario
router.get('/usuario/:usuarioId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [favoritos] = await connection.query(`
            SELECT f.*, c.nombre as nombre_cuarto, c.precio, p.direccion as direccion_propiedad
            FROM Favorito f
            JOIN Cuarto c ON f.cuarto_id = c.cuarto_id
            JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            WHERE f.usuario_id = ?
        `, [req.params.usuarioId]);
        connection.release();
        
        res.json({ favoritos });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener favoritos', error: error.message });
    }
});

module.exports = router;