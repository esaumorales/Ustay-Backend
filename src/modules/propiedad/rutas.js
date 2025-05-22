const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todas las propiedades
router.get('/', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo, 
                   u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
                   u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner,
                   u.google_foto as foto_partner
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
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
            SELECT p.*, d.direccion as direccion_completa, pe.periodo,
                   u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
                   u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner,
                   u.google_foto as foto_partner, pa.telefono as telefono_partner
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
            WHERE p.propiedad_id = ?
        `, [req.params.id]);
        connection.release();

        if (propiedades.length === 0) {
            return res.status(404).json({ message: 'Propiedad no encontrada' });
        }
        
        // Obtener cuartos de la propiedad
        const [cuartos] = await connection.query(`
            SELECT c.*, tc.tipo as tipo_cuarto
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            WHERE c.propiedad_id = ?
        `, [req.params.id]);
        
        // Crear objeto de respuesta con propiedad y sus cuartos
        const propiedad = propiedades[0];
        propiedad.cuartos = cuartos;
        
        res.json({ propiedad });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedad', error: error.message });
    }
});

// Obtener propiedades por partner
router.get('/partner/:partnerId', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo,
                   u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
                   u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
            WHERE p.partner_id = ?
        `, [req.params.partnerId]);
        connection.release();
        
        res.json({ propiedades });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedades del partner', error: error.message });
    }
});

// Crear una nueva propiedad
router.post('/', verifyToken, async (req, res) => {
    try {
        const { 
            partner_id, 
            direccion, 
            reglas, 
            descripcion, 
            foto, 
            estado_verificacion, 
            periodo_id,
            n_pisos,
            referencia
        } = req.body;
        
        const connection = await pool.getConnection();
        
        // Primero crear la dirección si se proporciona
        let direccion_id = null;
        if (direccion) {
            const [direccionResult] = await connection.query(
                'INSERT INTO Direccion (direccion) VALUES (?)',
                [direccion]
            );
            direccion_id = direccionResult.insertId;
        }
        
        // Luego crear la propiedad
        const [propiedadResult] = await connection.query(`
            INSERT INTO Propiedad (
                partner_id, 
                direccion_id, 
                reglas, 
                descripcion, 
                foto, 
                direccion, 
                estado_verificacion, 
                periodo_id,
                n_pisos,
                referencia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            partner_id || null, 
            direccion_id, 
            reglas || null, 
            descripcion || null, 
            foto || null, 
            direccion || null, 
            estado_verificacion || null, 
            periodo_id || null,
            n_pisos || null,
            referencia || null
        ]);
        
        connection.release();
        
        res.status(201).json({ 
            message: 'Propiedad creada exitosamente', 
            propiedad_id: propiedadResult.insertId 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear propiedad', error: error.message });
    }
});

// Actualizar una propiedad existente
router.put('/propiedad-edit/:id', verifyToken, async (req, res) => {
    try {
        const { 
            reglas, 
            descripcion, 
            foto, 
            direccion, 
            estado_verificacion, 
            periodo_id,
            n_pisos,
            referencia
        } = req.body;
        
        const connection = await pool.getConnection();
        
        // Obtener la propiedad actual
        const [propiedadActual] = await connection.query(
            'SELECT * FROM Propiedad WHERE propiedad_id = ?',
            [req.params.id]
        );
        
        if (propiedadActual.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Propiedad no encontrada' });
        }
        
        // Actualizar la dirección si se proporciona
        if (direccion !== undefined) {
            await connection.query(
                'UPDATE Direccion SET direccion = ? WHERE direccion_id = ?',
                [direccion, propiedadActual[0].direccion_id]
            );
        }
        
        // Preparar los campos para actualizar, permitiendo valores nulos
        const updateFields = {};
        if (reglas !== undefined) updateFields.reglas = reglas;
        if (descripcion !== undefined) updateFields.descripcion = descripcion;
        if (foto !== undefined) updateFields.foto = foto;
        if (direccion !== undefined) updateFields.direccion = direccion;
        if (estado_verificacion !== undefined) updateFields.estado_verificacion = estado_verificacion;
        if (periodo_id !== undefined) updateFields.periodo_id = periodo_id;
        if (n_pisos !== undefined) updateFields.n_pisos = n_pisos;
        if (referencia !== undefined) updateFields.referencia = referencia;
        
        // Solo actualizar si hay campos para actualizar
        if (Object.keys(updateFields).length > 0) {
            const setClause = Object.keys(updateFields)
                .map(key => `${key} = ?`)
                .join(', ');
            
            const values = [...Object.values(updateFields), req.params.id];
            
            await connection.query(
                `UPDATE Propiedad SET ${setClause} WHERE propiedad_id = ?`,
                values
            );
        }
        
        connection.release();
        
        res.json({ message: 'Propiedad actualizada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar propiedad', error: error.message });
    }
});

// Eliminar una propiedad
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Obtener la propiedad para conseguir el direccion_id
        const [propiedad] = await connection.query(
            'SELECT direccion_id FROM Propiedad WHERE propiedad_id = ?',
            [req.params.id]
        );
        
        if (propiedad.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Propiedad no encontrada' });
        }
        
        // Eliminar cuartos asociados a la propiedad
        await connection.query(
            'DELETE FROM Cuarto WHERE propiedad_id = ?',
            [req.params.id]
        );
        
        // Eliminar la propiedad
        await connection.query(
            'DELETE FROM Propiedad WHERE propiedad_id = ?',
            [req.params.id]
        );
        
        // Eliminar la dirección
        await connection.query(
            'DELETE FROM Direccion WHERE direccion_id = ?',
            [propiedad[0].direccion_id]
        );
        
        connection.release();
        
        res.json({ message: 'Propiedad eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar propiedad', error: error.message });
    }
});

// Obtener propiedades por estado de verificación
router.get('/estado/:estado', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [propiedades] = await connection.query(`
            SELECT p.*, d.direccion as direccion_completa, pe.periodo,
                   u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
                   u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner
            FROM Propiedad p
            LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
            LEFT JOIN Periodo pe ON p.periodo_id = pe.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
            WHERE p.estado_verificacion = ?
        `, [req.params.estado]);
        connection.release();
        
        res.json({ propiedades });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener propiedades por estado', error: error.message });
    }
});

module.exports = router;