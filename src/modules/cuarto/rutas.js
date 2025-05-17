const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener todos los cuartos
router.get('/', async (req, res) => { // Eliminado verifyToken
    try {
        const connection = await pool.getConnection();
            const [cuartos] = await connection.query(`
            SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            LEFT JOIN Periodo pr ON p.periodo_id = pr.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
        `);
        connection.release();
        
        // Agregar nombre y apellido del partner a cada cuarto y eliminar duplicados
        const cuartosConPartner = cuartos.map(cuarto => ({
            cuarto_id: cuarto.cuarto_id,
            propiedad_id: cuarto.propiedad_id,
            tipo_cuarto_id: cuarto.tipo_cuarto_id,
            precio: cuarto.precio,
            nombre: cuarto.nombre,
            dimensiones: cuarto.dimensiones,
            n_piso: cuarto.n_piso,
            n_cuarto: cuarto.n_cuarto,
            descripcion: cuarto.descripcion,
            disponibilidad: cuarto.disponibilidad,
            informacion_adicional: cuarto.informacion_adicional,
            tipo_cuarto: cuarto.tipo_cuarto,
            direccion_propiedad: cuarto.direccion_propiedad,
            periodo: cuarto.periodo,
            partner: {
                nombre: cuarto.nombre_usuario,
                apellido: cuarto.apellido_usuario
            }
        }));

        res.json({ cuartos: cuartosConPartner });
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
            SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, p.reglas, u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario, pa.n_dni, pa.direccion, pa.telefono
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            LEFT JOIN Periodo pr ON p.periodo_id = pr.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
            WHERE c.cuarto_id = ?
        `, [req.params.id]);

        if (cuartos.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Cuarto no encontrado' });
        }

        // Reemplazar comas por saltos de línea en información adicional
        cuartos[0].informacion_adicional = cuartos[0].informacion_adicional.replace(/,/g, '\n');

        // Obtener servicios del cuarto
        const [servicios] = await connection.query(`
            SELECT s.servicio_id, s.servicio, s.descripcion
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
            cuarto: {
                ...cuartos[0],
                partner: {
                    nombre: cuartos[0].nombre_usuario,
                    apellido: cuartos[0].apellido_usuario,
                    dni: cuartos[0].n_dni,
                    direccion: cuartos[0].direccion,
                    telefono: cuartos[0].telefono
                }
            },
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