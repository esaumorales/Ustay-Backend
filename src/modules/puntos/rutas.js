const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// ✅ 1. Registrar recarga
router.post('/recargar', verifyToken, async (req, res) => {
    const { usuario_id, monto_soles, puntos_obtenidos } = req.body;
  
    if (!usuario_id || !monto_soles || !puntos_obtenidos) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
  
    try {
      const connection = await pool.getConnection();
  
      const [result] = await connection.query(`
        INSERT INTO RecargaPuntos (usuario_id, monto_soles, puntos_obtenidos)
        VALUES (?, ?, ?)
      `, [usuario_id, monto_soles, puntos_obtenidos]);
  
      // ✅ Obtener la fecha exacta recién insertada
      const [rows] = await connection.query(`
        SELECT fecha_recarga 
        FROM RecargaPuntos 
        WHERE recarga_id = ?
      `, [result.insertId]);
  
      connection.release();
  
      res.status(201).json({
        message: 'Recarga registrada correctamente.',
        fecha_recarga: rows[0]?.fecha_recarga || null
      });
    } catch (error) {
      console.error('Error al registrar recarga:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  });
  

// ✅ 2. Obtener saldo de puntos
router.get('/saldo/:usuarioId', verifyToken, async (req, res) => {
    const usuarioId = req.params.usuarioId;

    try {
        const connection = await pool.getConnection();
        const [result] = await connection.query(`
            SELECT 
                IFNULL((SELECT SUM(puntos_obtenidos) FROM RecargaPuntos WHERE usuario_id = ?), 0) -
                IFNULL((SELECT SUM(puntos_utilizados) FROM PromocionCuarto WHERE usuario_id = ?), 0)
                AS puntos_disponibles
        `, [usuarioId, usuarioId]);

        connection.release();
        res.json({ puntos: result[0].puntos_disponibles });
    } catch (error) {
        console.error('Error al obtener saldo:', error);
        res.status(500).json({ message: 'Error interno al calcular saldo' });
    }
});

// ✅ 3. Obtener historial
router.get('/historial/:usuarioId', verifyToken, async (req, res) => {
    const usuarioId = req.params.usuarioId;

    try {
        const connection = await pool.getConnection();

        const [recargas] = await connection.query(`
            SELECT monto_soles, puntos_obtenidos, fecha_recarga
            FROM RecargaPuntos
            WHERE usuario_id = ?
            ORDER BY fecha_recarga DESC
        `, [usuarioId]);

        const [promociones] = await connection.query(`
            SELECT pc.*, c.nombre AS nombre_cuarto
            FROM PromocionCuarto pc
            JOIN Cuarto c ON pc.cuarto_id = c.cuarto_id
            WHERE pc.usuario_id = ?
            ORDER BY pc.fecha_inicio DESC
        `, [usuarioId]);

        connection.release();
        res.json({ recargas, promociones });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ message: 'Error interno al obtener historial' });
    }
});

// ✅ 4. Obtener planes disponibles
router.get('/planes', verifyToken, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [planes] = await connection.query(`SELECT * FROM PlanPromocion`);
        connection.release();

        res.json({ planes });
    } catch (error) {
        console.error('Error al obtener planes:', error);
        res.status(500).json({ message: 'Error al obtener planes' });
    }
});

// ✅ 5. Activar promoción
router.post('/promocionar', verifyToken, async (req, res) => {
    const { usuario_id, cuarto_id, plan_id } = req.body;

    if (!usuario_id || !cuarto_id || !plan_id) {
        return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }

    try {
        const connection = await pool.getConnection();

        // Obtener plan
        const [planes] = await connection.query(`
            SELECT * FROM PlanPromocion WHERE plan_id = ?
        `, [plan_id]);

        if (planes.length === 0) {
            connection.release();
            return res.status(404).json({ message: 'Plan no encontrado.' });
        }

        const plan = planes[0];

        // Calcular saldo
        const [saldoRes] = await connection.query(`
            SELECT 
                IFNULL((SELECT SUM(puntos_obtenidos) FROM RecargaPuntos WHERE usuario_id = ?), 0) -
                IFNULL((SELECT SUM(puntos_utilizados) FROM PromocionCuarto WHERE usuario_id = ?), 0)
                AS puntos_disponibles
        `, [usuario_id, usuario_id]);

        const puntosActuales = saldoRes[0].puntos_disponibles;

        if (puntosActuales < plan.costo_puntos) {
            connection.release();
            return res.status(400).json({ message: 'No tienes puntos suficientes.' });
        }

        // Insertar promoción
        await connection.query(`
            INSERT INTO PromocionCuarto (usuario_id, cuarto_id, puntos_utilizados, fecha_inicio, fecha_fin, plan_id, nombre_plan)
            VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?)
        `, [usuario_id, cuarto_id, plan.costo_puntos, plan.duracion_dias, plan_id, plan.nombre]);

        connection.release();
        res.status(201).json({ message: 'Promoción activada correctamente.' });

    } catch (error) {
        console.error('Error al activar promoción:', error);
        res.status(500).json({ message: 'Error interno al activar promoción' });
    }
});

module.exports = router;
