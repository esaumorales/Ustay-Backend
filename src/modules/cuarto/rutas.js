const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');
const cloudinary = require('../../cloudinaryConfig');

// Función para subir imágenes a Cloudinary
const uploadToCloudinary = async (file) => {
  if (!file) return null;
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: 'cuartos',
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('Error al subir imagen a Cloudinary:', error);
    return null;
  }
};

// Obtener cuarto por UUID (ruta pública)
router.get('/uuid/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const connection = await pool.getConnection();

    const [cuartos] = await connection.query(
      `SELECT * FROM Cuarto WHERE uuid = ?`,
      [uuid]
    );

    connection.release();

    if (cuartos.length === 0) {
      return res.status(404).json({ message: 'Cuarto no encontrado' });
    }

    res.json({ cuarto: cuartos[0] });
  } catch (error) {
    res
      .status(500)
      .json({
        message: 'Error al obtener cuarto por UUID',
        error: error.message,
      });
  }
});

// Función para extraer public_id desde URL de Cloudinary
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/src/image/cuarto/');
  if (parts.length < 2) return null;
  const publicIdWithExtension = parts[1];
  const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
  if (lastDotIndex === -1) return publicIdWithExtension;
  return publicIdWithExtension.substring(0, lastDotIndex);
};

// Función para eliminar imagen en Cloudinary usando URL
const deleteImageByUrl = async (url) => {
  const public_id = getPublicIdFromUrl(url);
  if (!public_id) return;
  try {
    await cloudinary.uploader.destroy(public_id, { resource_type: 'image' });
  } catch (error) {
    console.error('Error eliminando imagen en Cloudinary:', error);
  }
};

// Obtener todos los cuartos
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Consulta para obtener los cuartos con la información principal, incluida la zona de la propiedad
    const [cuartos] = await connection.query(`
          SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, c.valoracion,
                c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, 
                tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, TRIM(p.zona) as zona, pr.periodo, 
                u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario
          FROM Cuarto c
          LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
          LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
          LEFT JOIN Periodo pr ON c.periodo_id = pr.periodo_id
          LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
          LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
    `);

    // Verifica si los datos de la zona se están obteniendo correctamente
    console.log(cuartos); // Puedes comprobar en la consola si la zona está presente.

    // Obtener las fotos asociadas a cada cuarto
    const [fotos] = await connection.query(`
      SELECT f.cuarto_id, f.url_imagen
      FROM Foto f
    `);

    // Obtener los servicios personalizados desde la tabla Servicio_x_Cuarto
    const [servicios] = await connection.query(`
      SELECT sc.cuarto_id, s.servicio_id, s.servicio, sc.descripcion
      FROM Servicio_x_Cuarto sc
      LEFT JOIN Servicio s ON sc.servicio_id = s.servicio_id
    `);

    connection.release();

    // Mapeo para incluir las fotos y servicios personalizados en cada cuarto
    const cuartosConFotosYServicios = cuartos.map((cuarto) => {
      const cuartoFotos = fotos
        .filter((foto) => foto.cuarto_id === cuarto.cuarto_id)
        .map((foto) => foto.url_imagen);

      // Filtrar los servicios personalizados para este cuarto
      const cuartoServicios = servicios
        .filter((servicio) => servicio.cuarto_id === cuarto.cuarto_id)
        .map((servicio) => ({
          servicio_id: servicio.servicio_id,
          servicio: servicio.servicio,
          descripcion: servicio.descripcion || 'Sin descripción',
        }));

      return {
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
        valoracion: cuarto.valoracion,
        informacion_adicional: cuarto.informacion_adicional,
        tipo_cuarto: cuarto.tipo_cuarto,
        direccion_propiedad: cuarto.direccion_propiedad,
        zona: cuarto.zona, // Asegúrate de que aquí estás obteniendo la zona correctamente
        periodo: cuarto.periodo,
        partner: {
          nombre: cuarto.nombre_usuario,
          apellido: cuarto.apellido_usuario,
        },
        fotos: cuartoFotos,
        servicios: cuartoServicios,
      };
    });

    res.json({ cuartos: cuartosConFotosYServicios });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener cuartos', error: error.message });
  }
});

// Obtener cuarto específico
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Consulta para obtener la información del cuarto (incluye lat/lng desde Propiedad)
    const [cuartos] = await connection.query(
      `
      SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, c.valoracion,
             c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, 
             p.latitud, p.longitud,
             tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, p.reglas, 
             u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario, pa.n_dni, pa.direccion, pa.telefono
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
      LEFT JOIN Periodo pr ON c.periodo_id = pr.periodo_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
      WHERE c.cuarto_id = ?
      `,
      [req.params.id]
    );

    if (cuartos.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Cuarto no encontrado' });
    }

    cuartos[0].informacion_adicional = cuartos[0].informacion_adicional.replace(
      /,/g,
      '\n'
    );

    // Obtener los servicios personalizados para este cuarto
    const [servicios] = await connection.query(
      `
      SELECT s.servicio_id, s.servicio, sc.descripcion
      FROM Servicio s
      JOIN Servicio_x_Cuarto sc ON s.servicio_id = sc.servicio_id
      WHERE sc.cuarto_id = ?
      `,
      [req.params.id]
    );

    // Obtener las fotos asociadas al cuarto
    const [fotos] = await connection.query(
      `SELECT * FROM Foto WHERE cuarto_id = ?`,
      [req.params.id]
    );

    connection.release();

    // Responder con los datos del cuarto, incluyendo latitud/longitud
    res.json({
      cuarto: {
        ...cuartos[0],
        partner: {
          nombre: cuartos[0].nombre_usuario,
          apellido: cuartos[0].apellido_usuario,
          dni: cuartos[0].n_dni,
          direccion: cuartos[0].direccion,
          telefono: cuartos[0].telefono,
        },
      },
      servicios: servicios.map((servicio) => ({
        servicio_id: servicio.servicio_id,
        servicio: servicio.servicio,
        descripcion: servicio.descripcion || 'Sin descripción',
      })),
      fotos,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener cuarto', error: error.message });
  }
});

// Obtener cuartos por partner
router.get('/partnerRoom/:partnerId', verifyToken, async (req, res) => {
  const { partnerId } = req.params;
  let connection;

  try {
    connection = await pool.getConnection();

    /* ---- CUARTOS ---- */
    const [cuartos] = await connection.query(
      `SELECT
         c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id,
         c.precio, c.nombre, c.dimensiones,
         c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad,
         c.informacion_adicional, c.valoracion,
         tc.tipo                 AS tipo_cuarto,
         p.direccion             AS direccion_propiedad,
         pr.periodo,
         u.nombre                AS nombre_partner,
         u.apellido_pa           AS apellido_partner,
         u.apellido_ma           AS apellido_ma_partner,
         u.correo_electronico    AS correo_partner,
         u.google_foto           AS foto_partner,
         pa.telefono             AS telefono_partner,
         MIN(f.url_imagen)       AS url_imagen
       FROM Cuarto c
       LEFT JOIN Tipo_Cuarto tc   ON c.tipo_cuarto_id = tc.tipo_cuarto_id
       LEFT JOIN Propiedad p      ON c.propiedad_id   = p.propiedad_id
       LEFT JOIN Periodo pr       ON c.periodo_id     = pr.periodo_id
       LEFT JOIN Partner pa       ON p.partner_id     = pa.partner_id
       LEFT JOIN Usuario u        ON pa.partner_id    = u.usuario_id
       LEFT JOIN Foto f           ON c.cuarto_id      = f.cuarto_id
       WHERE p.partner_id = ?
       GROUP BY c.cuarto_id`,
      [partnerId]
    );

    /* ---- SERVICIOS ---- */
    const [servicios] = await connection.query(
      `SELECT sc.cuarto_id, s.servicio_id, s.servicio, sc.descripcion
       FROM Servicio_x_Cuarto sc
       JOIN Servicio s ON s.servicio_id = sc.servicio_id
       WHERE sc.cuarto_id IN (
         SELECT c.cuarto_id
         FROM Cuarto c
         JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
         WHERE p.partner_id = ? )`,
      [partnerId]
    );

    /* ---- FOTOS EXTRA ---- */
    const [fotos] = await connection.query(
      `SELECT cuarto_id, url_imagen
       FROM Foto
       WHERE cuarto_id IN (
         SELECT c.cuarto_id
         FROM Cuarto c
         JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
         WHERE p.partner_id = ? )`,
      [partnerId]
    );

    /* ---- PROMOCIÓN MÁS RECIENTE POR FECHA_FIN ---- */
    const [promociones] = await connection.query(
      `SELECT pc.promocion_id, pc.cuarto_id, pc.estado, pc.nombre_plan, pc.fecha_inicio, pc.fecha_fin, pc.plan_id
       FROM PromocionCuarto pc
       INNER JOIN (
         SELECT cuarto_id, MAX(fecha_fin) AS ultima
         FROM PromocionCuarto
         GROUP BY cuarto_id
       ) sub ON pc.cuarto_id = sub.cuarto_id AND pc.fecha_fin = sub.ultima
       WHERE pc.usuario_id = ?`,
      [partnerId]
    );

    /* ---- COMPOSICIÓN ---- */
    const cuartosConDetalles = cuartos.map((c) => {
      const cuartoServicios = servicios
        .filter((s) => s.cuarto_id === c.cuarto_id)
        .map((s) => ({
          servicio_id: s.servicio_id,
          servicio: s.servicio,
          descripcion: s.descripcion || 'Sin descripción',
        }));

      const fotosCuarto = fotos
        .filter((f) => f.cuarto_id === c.cuarto_id)
        .map((f) =>
          cloudinary.url(f.url_imagen, {
            secure: true,
            transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
          })
        );

      const fotoPrincipal = c.url_imagen
        ? cloudinary.url(c.url_imagen, {
            secure: true,
            transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }],
          })
        : '';

      const promocion = promociones.find((p) => p.cuarto_id === c.cuarto_id);

      const diasRestantes = promocion?.fecha_fin
        ? Math.max(
            Math.ceil(
              (new Date(promocion.fecha_fin) - new Date()) /
                (1000 * 60 * 60 * 24)
            ),
            0
          )
        : null;

      return {
        cuarto_id: c.cuarto_id,
        propiedad_id: c.propiedad_id,
        tipo_cuarto_id: c.tipo_cuarto_id,
        precio: Number(c.precio),
        nombre: c.nombre,
        dimensiones: c.dimensiones,
        n_piso: c.n_piso,
        n_cuarto: c.n_cuarto,
        descripcion: c.descripcion,
        disponibilidad: c.disponibilidad,
        valoracion: c.valoracion,
        informacion_adicional: c.informacion_adicional,
        tipo_cuarto: c.tipo_cuarto,
        propiedad: {
          direccion: c.direccion_propiedad,
          periodo: c.periodo,
        },
        partner: {
          nombre: c.nombre_partner,
          apellido: c.apellido_partner,
          apellido_ma: c.apellido_ma_partner,
          correo: c.correo_partner,
          foto: c.foto_partner,
          telefono: c.telefono_partner,
        },
        foto: fotoPrincipal,
        fotos: fotosCuarto,
        servicios: cuartoServicios,
        promocion: promocion
          ? {
              promocion_id: promocion.promocion_id,
              plan_id: promocion.plan_id,
              estado: promocion.estado,
              nombre_plan: promocion.nombre_plan,
              fecha_inicio: promocion.fecha_inicio,
              fecha_fin: promocion.fecha_fin,
              dias_restantes: diasRestantes,
            }
          : null,
      };
    });

    res.json({ cuartos: cuartosConDetalles });
  } catch (err) {
    console.error('Error al obtener cuartos del partner:', err);
    res.status(500).json({
      message: 'Error al obtener cuartos del partner',
      error: err.message,
    });
  } finally {
    connection?.release();
  }
});




// Actualizar cuarto existente
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      tipo_cuarto_id,
      precio,
      nombre,
      dimensiones,
      n_piso,
      n_cuarto,
      descripcion,
      disponibilidad,
      informacion_adicional,
      periodo_id,
      fotos,            // Las fotos se pasan desde el frontend
      servicios,        // Nuevo: servicios seleccionados
      serviceDetails    // Nuevo: detalles de cada servicio
    } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Primero, obtener los datos actuales del cuarto
      const [cuartoActual] = await connection.query(
        'SELECT * FROM Cuarto WHERE cuarto_id = ?',
        [req.params.id]
      );

      if (cuartoActual.length === 0) {
        connection.release();
        return res.status(404).json({ message: 'Cuarto no encontrado' });
      }

      const cuarto = cuartoActual[0];

      const updatedFields = {
        tipo_cuarto_id: tipo_cuarto_id || cuarto.tipo_cuarto_id,
        precio: precio || cuarto.precio,
        nombre: nombre || cuarto.nombre,
        dimensiones: dimensiones || cuarto.dimensiones,
        n_piso: n_piso || cuarto.n_piso,
        n_cuarto: n_cuarto || cuarto.n_cuarto,
        descripcion: descripcion || cuarto.descripcion,
        disponibilidad: disponibilidad !== undefined ? disponibilidad : cuarto.disponibilidad,
        informacion_adicional: informacion_adicional || cuarto.informacion_adicional,
        periodo_id: periodo_id || cuarto.periodo_id
      };

      const setClause = Object.keys(updatedFields)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = [...Object.values(updatedFields), req.params.id];

      await connection.query(
        `UPDATE Cuarto SET ${setClause} WHERE cuarto_id = ?`,
        values
      );

      /** ---- ACTUALIZAR SERVICIOS ---- */
      if (servicios && Array.isArray(servicios) && serviceDetails) {
        // Borrar servicios previos
        await connection.query(
          'DELETE FROM Servicio_x_Cuarto WHERE cuarto_id = ?',
          [req.params.id]
        );

        const servicioMap = {
          luz: 1,
          agua: 2,
          wifi: 3,
          seguridad: 4,
          calefaccion: 5,
          limpieza: 6,
          garage: 7
        };

        const servicioValues = servicios
          .map((servicio) => {
            const servicio_id = servicioMap[servicio];
            const descripcion = serviceDetails[servicio] || 'Sin descripción';
            if (!servicio_id) return null;
            return [servicio_id, req.params.id, descripcion];
          })
          .filter((v) => v !== null);

        if (servicioValues.length > 0) {
          await connection.query(
            'INSERT INTO Servicio_x_Cuarto (servicio_id, cuarto_id, descripcion) VALUES ?',
            [servicioValues]
          );
        }
      }

      /** ---- ACTUALIZAR FOTOS ---- */
      if (fotos && fotos.length > 0) {
        await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [
          req.params.id
        ]);

        const newImageUrls = await Promise.all(fotos.map(uploadToCloudinary));

        const fotoValues = newImageUrls.map((url) => [req.params.id, url]);
        await connection.query(
          'INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?',
          [fotoValues]
        );
      }

      await connection.commit();
      connection.release();

      res.json({ message: 'Cuarto actualizado exitosamente' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('Error al actualizar cuarto:', error);
      res.status(500).json({ message: 'Error al actualizar cuarto', error: error.message });
    }
  } catch (error) {
    console.error('Error en la actualización del cuarto:', error);
    res.status(500).json({ message: 'Error al actualizar cuarto', error: error.message });
  }
});


// Eliminar cuarto
router.delete('/:id', verifyToken, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Eliminar las fotos asociadas al cuarto en Cloudinary
    const [fotos] = await connection.query(
      'SELECT url_imagen FROM Foto WHERE cuarto_id = ?',
      [req.params.id]
    );

    for (const foto of fotos) {
      try {
        await deleteImageByUrl(foto.url_imagen);
      } catch (err) {
        console.error(`Error eliminando imagen ${foto.url_imagen} en Cloudinary:`, err.message);
      }
    }

    // Eliminar las fotos de la base de datos
    await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [
      req.params.id
    ]);

    // Eliminar las asociaciones de servicios (Servicio_x_Cuarto)
    await connection.query(
      'DELETE FROM Servicio_x_Cuarto WHERE cuarto_id = ?',
      [req.params.id]
    );

    // Eliminar el cuarto de la base de datos
    await connection.query('DELETE FROM Cuarto WHERE cuarto_id = ?', [
      req.params.id
    ]);

    await connection.commit();
    res.json({ message: 'Cuarto eliminado exitosamente' });

  } catch (error) {
    await connection.rollback();
    console.error('Error al eliminar cuarto:', error);
    res.status(500).json({ message: 'Error al eliminar cuarto', error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;

// Modificar la consulta en GET /
router.get('/userRoom/', async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Obtener los cuartos con la información principal
    const [cuartos] = await connection.query(`
      SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, 
             c.dimensiones, c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, 
             c.informacion_adicional, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, 
             pe.periodo, u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
      LEFT JOIN Periodo pe ON c.periodo_id = pe.periodo_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
    `);

    // Obtener las fotos asociadas a cada cuarto
    const [fotos] = await connection.query(`
      SELECT f.cuarto_id, f.url_imagen
      FROM Foto f
    `);

    // Obtener los servicios personalizados desde la tabla Servicio_x_Cuarto
    const [servicios] = await connection.query(`
      SELECT sc.cuarto_id, s.servicio_id, s.servicio, sc.descripcion
      FROM Servicio_x_Cuarto sc
      LEFT JOIN Servicio s ON sc.servicio_id = s.servicio_id
    `);

    connection.release();

    // Mapeo para incluir las fotos y servicios personalizados en cada cuarto
    const cuartosConFotosYServicios = cuartos.map((cuarto) => {
      // Filtrar las fotos asociadas al cuarto
      const cuartoFotos = fotos
        .filter((foto) => foto.cuarto_id === cuarto.cuarto_id)
        .map((foto) => foto.url_imagen);

      // Filtrar los servicios personalizados para el cuarto
      const cuartoServicios = servicios
        .filter((servicio) => servicio.cuarto_id === cuarto.cuarto_id)
        .map((servicio) => ({
          servicio_id: servicio.servicio_id,
          servicio: servicio.servicio,
          descripcion: servicio.descripcion || 'Sin descripción', // Descripción por defecto si no se proporciona
        }));

      return {
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
          apellido: cuarto.apellido_usuario,
        },
        fotos: cuartoFotos,
        servicios: cuartoServicios, // Servicios personalizados asociados
      };
    });

    res.json({ cuartos: cuartosConFotosYServicios });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener cuartos', error: error.message });
  }
});

router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      propiedad_id,
      tipo_cuarto_id,
      precio,
      nombre,
      dimensiones,
      n_piso,
      n_cuarto,
      descripcion,
      disponibilidad,
      informacion_adicional,
      periodo,
      fotos,
      servicios,
      serviceDetails, // Recibir serviceDetails
    } = req.body;

    if (
      !propiedad_id ||
      !tipo_cuarto_id ||
      !precio ||
      !nombre ||
      !servicios ||
      !serviceDetails
    ) {
      return res
        .status(400)
        .json({ message: 'Faltan campos obligatorios o serviceDetails' });
    }

    if (typeof serviceDetails !== 'object' || serviceDetails === null) {
      return res
        .status(400)
        .json({ message: 'serviceDetails debe ser un objeto' });
    }

    const servicioMap = {
      luz: 1,
      agua: 2,
      wifi: 3,
      seguridad: 4,
      calefaccion: 5,
      limpieza: 6,
      garage: 7,
    };

    const periodoMap = {
      Mensual: 1,
      Semestral: 2,
      Anual: 3,
    };
    const periodo_id = periodoMap[periodo];

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Generar UUID único
      const [[{ uuid }]] = await connection.query('SELECT UUID() AS uuid');

      // Insertar el cuarto con UUID
      const [cuartoResult] = await connection.query(
        `INSERT INTO Cuarto (
          propiedad_id, tipo_cuarto_id, precio, nombre, dimensiones, n_piso, n_cuarto, descripcion,
          disponibilidad, informacion_adicional, periodo_id, uuid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          propiedad_id,
          tipo_cuarto_id,
          precio,
          nombre,
          dimensiones,
          n_piso,
          n_cuarto,
          descripcion,
          disponibilidad,
          informacion_adicional,
          periodo_id,
          uuid,
        ]
      );

      if (
        !Array.isArray(servicios) ||
        servicios.some((s) => typeof s !== 'string')
      ) {
        return res
          .status(400)
          .json({ message: 'Los servicios deben ser un arreglo de strings' });
      }

      if (servicios.length > 0) {
        const servicioValues = servicios
          .map((servicio) => {
            const servicio_id = servicioMap[servicio];
            const descripcion = serviceDetails[servicio] || 'Sin descripción';
            if (!servicio_id) return null;
            return [servicio_id, cuartoResult.insertId, descripcion];
          })
          .filter((v) => v !== null);

        if (servicioValues.length > 0) {
          await connection.query(
            `INSERT INTO Servicio_x_Cuarto (servicio_id, cuarto_id, descripcion) VALUES ?`,
            [servicioValues]
          );
        }
      }

      if (fotos && fotos.length > 0) {
        const fotosUrls = [];
        for (const foto of fotos) {
          try {
            const url = await uploadToCloudinary(foto);
            if (url) fotosUrls.push(url);
          } catch (error) {
            console.error('Error al subir foto a Cloudinary:', error.message);
          }
        }

        if (fotosUrls.length > 0) {
          const fotoValues = fotosUrls.map((url) => [
            cuartoResult.insertId,
            url,
          ]);
          await connection.query(
            'INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?',
            [fotoValues]
          );
        }
      }

      await connection.commit();
      connection.release();

      res.status(201).json({
        message: 'Cuarto creado exitosamente',
        cuarto_id: cuartoResult.insertId,
        uuid,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error en la creación del cuarto:', error.message);
    res
      .status(500)
      .json({ message: 'Error al crear cuarto', error: error.message });
  }
});
