const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Subir una foto
router.post('/', verifyToken, async (req, res) => {
    try {
        const { cuarto_id, url_imagen } = req.body;
        const connection = await pool.getConnection();
        const [result] = await connection.query(`
            INSERT INTO Foto (cuarto_id, url_imagen)
            VALUES (?, ?)
        `, [cuarto_id, url_imagen]);
        connection.release();
        
        res.status(201).json({ message: 'Foto subida', foto_id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Error al subir foto', error: error.message });
    }
});

module.exports = router;