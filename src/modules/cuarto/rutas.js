const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los cuartos
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [cuartos] = await connection.query(`
            SELECT c.*, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
        `);
        connection.release();
        
        res.json({ cuartos });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuartos', error: error.message });
    }
});

// Obtener cuarto específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Obtener información del cuarto
        const [cuartos] = await connection.query(`
            SELECT c.*, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            WHERE c.cuarto_id = ?
        `, [req.params.id]);

        if (cuartos.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Cuarto no encontrado' });
        }

        // Obtener servicios del cuarto
        const [servicios] = await connection.query(`
            SELECT s.*
            FROM Servicio s
            JOIN Servicio_x_Cuarto sc ON s.servicio_id = sc.servicio_id
            WHERE sc.cuarto_id = ?
        `, [req.params.id]);

        // Obtener fotos del cuarto
        const [fotos] = await connection.query(`
            SELECT * FROM Foto WHERE cuarto_id = ?
        `, [req.params.id]);

        connection.release();
        
        res.json({ 
            cuarto: cuartos[0],
            servicios,
            fotos
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuarto', error: error.message });
    }
});

// Obtener cuartos por propiedad
router.get('/propiedad/:propiedadId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [cuartos] = await connection.query(`
            SELECT c.*, tc.tipo as tipo_cuarto
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            WHERE c.propiedad_id = ?
        `, [req.params.propiedadId]);
        connection.release();
        
        res.json({ cuartos });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cuartos de la propiedad', error: error.message });
    }
});

module.exports = router;