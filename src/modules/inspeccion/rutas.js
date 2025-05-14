const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todas las asignaciones de inspección
router.get('/asignacion', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [asignaciones] = await connection.query(`
            SELECT ai.*, u.nombre as inspector_nombre, p.direccion as propiedad_direccion
            FROM Asignacion_Inspeccion ai
            JOIN Usuario u ON ai.inspector_id = u.usuario_id
            JOIN Propiedad p ON ai.propiedad_id = p.propiedad_id
        `);
        connection.release();
        
        res.json({ asignaciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asignaciones', error: error.message });
    }
});

// Obtener asignación específica
router.get('/asignacion/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [asignaciones] = await connection.query(`
            SELECT ai.*, u.nombre as inspector_nombre, p.direccion as propiedad_direccion
            FROM Asignacion_Inspeccion ai
            JOIN Usuario u ON ai.inspector_id = u.usuario_id
            JOIN Propiedad p ON ai.propiedad_id = p.propiedad_id
            WHERE ai.asignacion_id = ?
        `, [req.params.id]);
        connection.release();

        if (asignaciones.length === 0) {
            return res.status(404).json({ message: 'Asignación no encontrada' });
        }
        
        res.json({ asignacion: asignaciones[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asignación', error: error.message });
    }
});

// Obtener asignaciones por inspector
router.get('/inspector/:inspectorId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [asignaciones] = await connection.query(`
            SELECT ai.*, p.direccion as propiedad_direccion
            FROM Asignacion_Inspeccion ai
            JOIN Propiedad p ON ai.propiedad_id = p.propiedad_id
            WHERE ai.inspector_id = ?
        `, [req.params.inspectorId]);
        connection.release();
        
        res.json({ asignaciones });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asignaciones del inspector', error: error.message });
    }
});

// Obtener informes de inspección
router.get('/informe', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [informes] = await connection.query(`
            SELECT i.*, u.nombre as inspector_nombre, p.direccion as propiedad_direccion
            FROM Informe_Inspeccion i
            JOIN Usuario u ON i.inspector_id = u.usuario_id
            JOIN Propiedad p ON i.propiedad_id = p.propiedad_id
        `);
        connection.release();
        
        res.json({ informes });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener informes', error: error.message });
    }
});

// Obtener informe específico
router.get('/informe/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [informes] = await connection.query(`
            SELECT i.*, u.nombre as inspector_nombre, p.direccion as propiedad_direccion
            FROM Informe_Inspeccion i
            JOIN Usuario u ON i.inspector_id = u.usuario_id
            JOIN Propiedad p ON i.propiedad_id = p.propiedad_id
            WHERE i.informe_id = ?
        `, [req.params.id]);
        connection.release();

        if (informes.length === 0) {
            return res.status(404).json({ message: 'Informe no encontrado' });
        }
        
        res.json({ informe: informes[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener informe', error: error.message });
    }
});

module.exports = router;