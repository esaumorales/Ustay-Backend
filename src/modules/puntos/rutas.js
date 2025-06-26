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

    const [result] = await connection.query(
      `
        INSERT INTO RecargaPuntos (usuario_id, monto_soles, puntos_obtenidos)
        VALUES (?, ?, ?)
      `,
      [usuario_id, monto_soles, puntos_obtenidos]
    );

    // ✅ Obtener la fecha exacta recién insertada
    const [rows] = await connection.query(
      `
        SELECT fecha_recarga 
        FROM RecargaPuntos 
        WHERE recarga_id = ?
      `,
      [result.insertId]
    );

    connection.release();

    res.status(201).json({
      message: 'Recarga registrada correctamente.',
      fecha_recarga: rows[0]?.fecha_recarga || null,
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
    const [result] = await connection.query(
      `
            SELECT 
                IFNULL((SELECT SUM(puntos_obtenidos) FROM RecargaPuntos WHERE usuario_id = ?), 0) -
                IFNULL((SELECT SUM(puntos_utilizados) FROM PromocionCuarto WHERE usuario_id = ?), 0)
                AS puntos_disponibles
        `,
      [usuarioId, usuarioId]
    );

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

    const [recargas] = await connection.query(
      `
            SELECT monto_soles, puntos_obtenidos, fecha_recarga
            FROM RecargaPuntos
            WHERE usuario_id = ?
            ORDER BY fecha_recarga DESC
        `,
      [usuarioId]
    );

    const [promociones] = await connection.query(
      `
            SELECT pc.*, c.nombre AS nombre_cuarto
            FROM PromocionCuarto pc
            JOIN Cuarto c ON pc.cuarto_id = c.cuarto_id
            WHERE pc.usuario_id = ?
            ORDER BY pc.fecha_inicio DESC
        `,
      [usuarioId]
    );

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
    console.log('Renovando con:', { usuario_id, cuarto_id, plan_id });
  
    if (!usuario_id || !cuarto_id || !plan_id) {
      return res.status(400).json({ message: 'Faltan datos requeridos.' });
    }
  
    try {
      const connection = await pool.getConnection();
  
      // 🔍 1. Obtener promoción activa (si existe)
      const [promocionesActivas] = await connection.query(
        `SELECT * FROM PromocionCuarto 
         WHERE usuario_id = ? AND cuarto_id = ? AND estado = 'Activa'`,
        [usuario_id, cuarto_id]
      );
  
      // 📦 2. Obtener detalles del plan
      const [planes] = await connection.query(
        `SELECT * FROM PlanPromocion WHERE plan_id = ?`,
        [plan_id]
      );
  
      if (planes.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Plan no encontrado.' });
      }
  
      const plan = planes[0];
  
      // 💰 3. Validar puntos disponibles
      const [saldoRes] = await connection.query(
        `SELECT 
          IFNULL((SELECT SUM(puntos_obtenidos) FROM RecargaPuntos WHERE usuario_id = ?), 0) -
          IFNULL((SELECT SUM(puntos_utilizados) FROM PromocionCuarto WHERE usuario_id = ?), 0)
          AS puntos_disponibles`,
        [usuario_id, usuario_id]
      );
  
      const puntosActuales = saldoRes[0].puntos_disponibles;
  
      if (puntosActuales < plan.costo_puntos) {
        connection.release();
        return res.status(400).json({ message: 'No tienes puntos suficientes.' });
      }
  
      // 🔄 4. Si hay promoción activa, la renovamos (extendemos la fecha_fin)
      if (promocionesActivas.length > 0) {
        const promocionActiva = promocionesActivas[0];
  
        await connection.query(
          `UPDATE PromocionCuarto
           SET 
             fecha_fin = DATE_ADD(fecha_fin, INTERVAL ? DAY),
             puntos_utilizados = puntos_utilizados + ?,
             plan_id = ?,
             nombre_plan = ?
           WHERE promocion_id = ?`,
          [
            plan.duracion_dias,
            plan.costo_puntos,
            plan_id,
            plan.nombre,
            promocionActiva.promocion_id
          ]
        );
  
        connection.release();
        return res.status(200).json({ message: 'Promoción renovada correctamente.' });
      }
  
      // 🆕 5. Si no existe, insertamos una nueva promoción
      await connection.query(
        `INSERT INTO PromocionCuarto 
          (usuario_id, cuarto_id, puntos_utilizados, fecha_inicio, fecha_fin, plan_id, nombre_plan, estado)
         VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?, ?, 'Activa')`,
        [
          usuario_id,
          cuarto_id,
          plan.costo_puntos,
          plan.duracion_dias,
          plan_id,
          plan.nombre
        ]
      );
  
      connection.release();
      res.status(201).json({ message: 'Promoción activada correctamente.' });
    } catch (error) {
      console.error('Error al activar promoción:', error);
      res.status(500).json({ message: 'Error interno al activar promoción' });
    }
  });
  

router.post('/cancelar-promocion', verifyToken, async (req, res) => {
  const { promocion_id } = req.body;

  if (!promocion_id) {
    return res.status(400).json({ message: 'Falta el ID de la promoción.' });
  }

  try {
    const connection = await pool.getConnection();

    // Verificamos que exista la promoción y esté activa
    const [rows] = await connection.query(
      `
            SELECT * FROM PromocionCuarto WHERE promocion_id = ?
        `,
      [promocion_id]
    );

    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Promoción no encontrada.' });
    }

    if (rows[0].estado === 'Finalizada') {
      connection.release();
      return res
        .status(400)
        .json({ message: 'La promoción ya está finalizada.' });
    }

    // Actualizamos el estado a 'Finalizada'
    await connection.query(
      `
         UPDATE PromocionCuarto
            SET estado = 'Finalizada', fecha_fin = CURDATE()
            WHERE promocion_id = ?
        `,
      [promocion_id]
    );

    connection.release();
    res.json({ message: 'Promoción cancelada correctamente.' });
  } catch (error) {
    console.error('Error al cancelar promoción:', error);
    res.status(500).json({ message: 'Error interno al cancelar promoción.' });
  }
});

router.get('/historial/cuarto/:cuartoId', async (req, res) => {
    const { cuartoId } = req.params;
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.query(
        `SELECT nombre_plan, fecha_inicio, fecha_fin, puntos_utilizados
         FROM PromocionCuarto
         WHERE cuarto_id = ?
         ORDER BY fecha_inicio DESC`,
        [cuartoId]
      );
      connection.release();
      res.json({ historial: rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al obtener historial' });
    }
  });
  

module.exports = router;
