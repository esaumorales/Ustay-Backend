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
  // Eliminado verifyToken
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
    const cuartosConPartner = cuartos.map((cuarto) => ({
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
    }));

    res.json({ cuartos: cuartosConPartner });
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

    // Obtener información del cuarto
    const [cuartos] = await connection.query(
      `
            SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, p.reglas, u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario, pa.n_dni, pa.direccion, pa.telefono
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            LEFT JOIN Periodo pr ON p.periodo_id = pr.periodo_id
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

    // Reemplazar comas por saltos de línea en información adicional
    cuartos[0].informacion_adicional = cuartos[0].informacion_adicional.replace(
      /,/g,
      '\n'
    );

    // Obtener servicios del cuarto
    const [servicios] = await connection.query(
      `
            SELECT s.servicio_id, s.servicio, s.descripcion
            FROM Servicio s
            JOIN Servicio_x_Cuarto sc ON s.servicio_id = sc.servicio_id
            WHERE sc.cuarto_id = ?
        `,
      [req.params.id]
    );

    // Obtener fotos del cuarto
    const [fotos] = await connection.query(
      `
            SELECT * FROM Foto WHERE cuarto_id = ?
        `,
      [req.params.id]
    );

    connection.release();

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
      servicios,
      fotos,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener cuarto', error: error.message });
  }
});

// Obtener cuartos por propiedad
router.get('/propiedad/:propiedadId', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [cuartos] = await connection.query(
      `
            SELECT c.*, tc.tipo as tipo_cuarto
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            WHERE c.propiedad_id = ?
        `,
      [req.params.propiedadId]
    );
    connection.release();

    res.json({ cuartos });
  } catch (error) {
    res.status(500).json({
      message: 'Error al obtener cuartos de la propiedad',
      error: error.message,
    });
  }
});

// Obtener cuartos por partner
router.get('/partnerRoom/:partnerId', verifyToken, async (req, res) => {
    try {
      const partnerId = req.params.partnerId;
      console.log('partnerId:', partnerId);
  
      const connection = await pool.getConnection();
      const [cuartos] = await connection.query(`
        SELECT 
            c.*,
            tc.tipo as tipo_cuarto,
            p.direccion as direccion_propiedad,
            p.reglas,
            p.descripcion as descripcion_propiedad,
            p.foto as foto_propiedad,
            p.estado_verificacion,
            pr.periodo,
            u.nombre as nombre_partner,
            u.apellido_pa as apellido_partner,
            u.apellido_ma as apellido_ma_partner,
            u.correo_electronico as correo_partner,
            u.google_foto as foto_partner,
            pa.telefono as telefono_partner,
            MIN(f.url_imagen) as url_imagen
        FROM Cuarto c
        LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
        LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
        LEFT JOIN Periodo pr ON p.periodo_id = pr.periodo_id
        LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
        LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
        LEFT JOIN Foto f ON c.cuarto_id = f.cuarto_id
        WHERE p.partner_id = ?
        GROUP BY c.cuarto_id
      `, [partnerId]);
      connection.release();
  
      console.log('cuartos encontrados:', cuartos.length);
  
      const cuartosConDetalles = cuartos.map(cuarto => ({
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
        propiedad: {
          direccion: cuarto.direccion_propiedad || '',
          reglas: cuarto.reglas || '',
          descripcion: cuarto.descripcion_propiedad || '',
          foto: cuarto.foto_propiedad || '',
          estado_verificacion: cuarto.estado_verificacion || '',
          periodo: cuarto.periodo || ''
        },
        partner: {
          nombre: cuarto.nombre_partner || '',
          apellido: cuarto.apellido_partner || '',
          apellido_ma: cuarto.apellido_ma_partner || '',
          correo: cuarto.correo_partner || '',
          foto: cuarto.foto_partner || '',
          telefono: cuarto.telefono_partner || ''
        },
        foto: cuarto.url_imagen || ''
      }));
  
      res.json({ cuartos: cuartosConDetalles });
    } catch (error) {
      console.error('Error al obtener cuartos del partner:', error);
      res.status(500).json({ message: 'Error al obtener cuartos del partner', error: error.message });
    }
  });
  

// Comparar cuartos por IDs
router.get('/compare', async (req, res) => {
  try {
    const ids = req.query.ids; // Ejemplo: "1,9"
    if (!ids) {
      return res
        .status(400)
        .json({ message: 'Se requieren los IDs de los cuartos' });
    }
    const idsArray = ids.split(',').map((id) => parseInt(id));
    const connection = await pool.getConnection();
    const [cuartos] = await connection.query(
      `SELECT 
                c.cuarto_id,
                c.propiedad_id,
                c.tipo_cuarto_id,
                c.precio,
                c.nombre,
                c.dimensiones,
                c.n_piso,
                c.n_cuarto,
                c.descripcion,
                c.disponibilidad,
                c.informacion_adicional,
                tc.tipo as tipo_cuarto,
                p.direccion as direccion_propiedad,
                pr.periodo,
                u.nombre as nombre_usuario,
                u.apellido_pa as apellido_usuario,
                MIN(f.url_imagen) as imagen
            FROM Cuarto c
            LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
            LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
            LEFT JOIN Periodo pr ON p.periodo_id = pr.periodo_id
            LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
            LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
            LEFT JOIN Foto f ON c.cuarto_id = f.cuarto_id
            WHERE c.cuarto_id IN (?)
            GROUP BY c.cuarto_id
            `,
      [idsArray]
    );
    connection.release();

    const cuartosConPartner = cuartos.map((cuarto) => ({
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
      imagen: cuarto.imagen,
    }));

    res.json({ cuartos: cuartosConPartner });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al comparar cuartos', error: error.message });
  }
});

// Crear un nuevo cuarto
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
      fotos,
    } = req.body;

    // Subir imágenes a Cloudinary
    const fotosUrls = [];
    if (Array.isArray(fotos)) {
      for (const foto of fotos) {
        const url = await uploadToCloudinary(foto);
        if (url) fotosUrls.push(url);
      }
    }

    const connection = await pool.getConnection();

    // Insertar cuarto
    const [cuartoResult] = await connection.query(
      `
      INSERT INTO Cuarto (
        propiedad_id, tipo_cuarto_id, precio, nombre, dimensiones, n_piso, n_cuarto, descripcion, disponibilidad, informacion_adicional
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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
      ]
    );

    // Insertar fotos
    if (fotosUrls.length > 0) {
      const fotoValues = fotosUrls.map((url) => [cuartoResult.insertId, url]);
      await connection.query(
        'INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?',
        [fotoValues]
      );
    }

    connection.release();

    res.status(201).json({
      message: 'Cuarto creado exitosamente',
      cuarto_id: cuartoResult.insertId,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al crear cuarto', error: error.message });
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
      fotos,
    } = req.body;

    const connection = await pool.getConnection();

    // Verificar si el cuarto existe
    const [cuartoActual] = await connection.query(
      'SELECT * FROM Cuarto WHERE cuarto_id = ?',
      [req.params.id]
    );

    if (cuartoActual.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Cuarto no encontrado' });
    }

    // Obtener fotos actuales
    const [fotosActuales] = await connection.query(
      'SELECT * FROM Foto WHERE cuarto_id = ?',
      [req.params.id]
    );

    // Subir nuevas fotos a Cloudinary
    const nuevasFotosUrls = [];
    if (Array.isArray(fotos)) {
      for (const foto of fotos) {
        const url = await uploadToCloudinary(foto);
        if (url) nuevasFotosUrls.push(url);
      }
    }

    // Eliminar fotos antiguas de Cloudinary
    for (const foto of fotosActuales) {
      await deleteImageByUrl(foto.url_imagen);
    }

    // Actualizar información del cuarto
    await connection.query(
      `
      UPDATE Cuarto SET
        tipo_cuarto_id = ?,
        precio = ?,
        nombre = ?,
        dimensiones = ?,
        n_piso = ?,
        n_cuarto = ?,
        descripcion = ?,
        disponibilidad = ?,
        informacion_adicional = ?
      WHERE cuarto_id = ?
    `,
      [
        tipo_cuarto_id,
        precio,
        nombre,
        dimensiones,
        n_piso,
        n_cuarto,
        descripcion,
        disponibilidad,
        informacion_adicional,
        req.params.id,
      ]
    );

    // Eliminar fotos antiguas de la base de datos
    await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [
      req.params.id,
    ]);

    // Insertar nuevas fotos
    if (nuevasFotosUrls.length > 0) {
      const fotoValues = nuevasFotosUrls.map((url) => [req.params.id, url]);
      await connection.query(
        'INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?',
        [fotoValues]
      );
    }

    connection.release();

    res.json({ message: 'Cuarto actualizado exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al actualizar cuarto', error: error.message });
  }
});

// Eliminar cuarto
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Obtener fotos del cuarto
    const [fotos] = await connection.query(
      'SELECT * FROM Foto WHERE cuarto_id = ?',
      [req.params.id]
    );

    // Eliminar fotos de Cloudinary
    for (const foto of fotos) {
      await deleteImageByUrl(foto.url_imagen);
    }

    // Eliminar fotos de la base de datos
    await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [
      req.params.id,
    ]);

    // Eliminar cuarto
    await connection.query('DELETE FROM Cuarto WHERE cuarto_id = ?', [
      req.params.id,
    ]);

    connection.release();

    res.json({ message: 'Cuarto eliminado exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al eliminar cuarto', error: error.message });
  }
});

module.exports = router;
