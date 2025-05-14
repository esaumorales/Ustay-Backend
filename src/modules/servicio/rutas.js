const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los servicios
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [servicios] = await connection.query('SELECT * FROM Servicio');
        connection.release();
        
        res.json({ servicios });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener servicios', error: error.message });
    }
});

// Obtener servicio específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [servicios] = await connection.query('SELECT * FROM Servicio WHERE servicio_id = ?', [req.params.id]);
        connection.release();

        if (servicios.length === 0) {
            return res.status(404).json({ message: 'Servicio no encontrado' });
        }
        
        res.json({ servicio: servicios[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener servicio', error: error.message });
    }
});

// Obtener servicios por cuarto
router.get('/cuarto/:cuartoId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [servicios] = await connection.query(`
            SELECT s.*
            FROM Servicio s
            JOIN Servicio_x_Cuarto sc ON s.servicio_id = sc.servicio_id
            WHERE sc.cuarto_id = ?
        `, [req.params.cuartoId]);
        connection.release();
        
        res.json({ servicios });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener servicios del cuarto', error: error.message });
    }
});

module.exports = router;