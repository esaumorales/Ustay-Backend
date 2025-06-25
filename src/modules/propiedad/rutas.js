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
      folder: 'propiedades',
      resource_type: 'auto'
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
  const parts = url.split('/src/image/propiedad/');
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

// Obtener todas las propiedades
router.get('/', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [propiedades] = await connection.query(`
      SELECT p.*, d.direccion as direccion_completa,
             u.nombre as nombre_partner, u.apellido_pa as apellido_partner, 
             u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner,
             u.google_foto as foto_partner, p.foto_2, p.foto_3
      FROM Propiedad p
      LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
    `);
    connection.release();

    res.json({ propiedades });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener propiedades', error: error.message });
  }
});
router.get('/zonas', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [zonas] = await connection.query(`
      SELECT DISTINCT zona FROM Propiedad;
    `);
    connection.release();

    res.json({ zonas });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener zonas', error: error.message });
  }
});

// Obtener propiedad por UUID (nuevo)
router.get('/uuid/:uuid', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [propiedades] = await connection.query(`
      SELECT p.*, d.direccion as direccion_completa,
             u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
             u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner,
             u.google_foto as foto_partner, pa.telefono as telefono_partner,
             p.foto_2, p.foto_3
      FROM Propiedad p
      LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
      WHERE p.uuid = ?
    `, [req.params.uuid]);

    if (propiedades.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Propiedad no encontrada por UUID' });
    }

    const [cuartos] = await connection.query(`
      SELECT c.*, tc.tipo as tipo_cuarto, pe.periodo
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Periodo pe ON c.periodo_id = pe.periodo_id
      WHERE c.propiedad_id = ?
    `, [propiedades[0].propiedad_id]);

    connection.release();

    const propiedad = propiedades[0];
    propiedad.cuartos = cuartos;

    if (propiedad.foto) {
      propiedad.foto = cloudinary.url(propiedad.foto, { width: 800, crop: 'scale' });
    }
    if (propiedad.foto_2) {
      propiedad.foto_2 = cloudinary.url(propiedad.foto_2, { width: 800, crop: 'scale' });
    }
    if (propiedad.foto_3) {
      propiedad.foto_3 = cloudinary.url(propiedad.foto_3, { width: 800, crop: 'scale' });
    }

    res.json({ propiedad });
  } catch (error) {
    console.error('Error al obtener propiedad por UUID:', error);
    res.status(500).json({
      message: 'Error al obtener propiedad por UUID',
      error: error.message,
    });
  }
});


// Modificar la consulta en GET /:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    // Obtener propiedad
    const [propiedades] = await connection.query(`
      SELECT p.*, d.direccion as direccion_completa,
             u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
             u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner,
             u.google_foto as foto_partner, pa.telefono as telefono_partner,
             p.foto_2, p.foto_3
      FROM Propiedad p
      LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
      WHERE p.propiedad_id = ?
    `, [req.params.id]);

    if (propiedades.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Propiedad no encontrada' });
    }

    // Obtener cuartos
    const [cuartos] = await connection.query(`
      SELECT c.*, tc.tipo as tipo_cuarto, pe.periodo
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Periodo pe ON c.periodo_id = pe.periodo_id
      WHERE c.propiedad_id = ?
    `, [req.params.id]);

    connection.release();

    const propiedad = propiedades[0];
    propiedad.cuartos = cuartos;

    // Aplicar URLs Cloudinary si existen
    if (propiedad.foto) {
      propiedad.foto = cloudinary.url(propiedad.foto, { width: 800, crop: 'scale' });
    }
    if (propiedad.foto_2) {
      propiedad.foto_2 = cloudinary.url(propiedad.foto_2, { width: 800, crop: 'scale' });
    }
    if (propiedad.foto_3) {
      propiedad.foto_3 = cloudinary.url(propiedad.foto_3, { width: 800, crop: 'scale' });
    }

    res.json({ propiedad });
  } catch (error) {
    console.error('Error al obtener propiedad:', error);
    res.status(500).json({
      message: 'Error al obtener propiedad',
      error: error.message,
    });
  }
});

// Obtener propiedades por partner
router.get('/partner/:partnerId', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [propiedades] = await connection.query(`
      SELECT p.*, d.direccion as direccion_completa, u.nombre as nombre_partner, u.apellido_pa as apellido_partner,
             u.apellido_ma as apellido_ma_partner, u.correo_electronico as correo_partner
      FROM Propiedad p
      LEFT JOIN Direccion d ON p.direccion_id = d.direccion_id
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
    const { partner_id, direccion, reglas, descripcion, foto, foto_2, foto_3, estado_verificacion, periodo_id, n_pisos, referencia } = req.body;

    // Subir imágenes a Cloudinary
    const foto_url = await uploadToCloudinary(foto);
    const foto_2_url = await uploadToCloudinary(foto_2);
    const foto_3_url = await uploadToCloudinary(foto_3);

    const connection = await pool.getConnection();

    // Crear dirección si se proporciona
    let direccion_id = null;
    if (direccion) {
      const [direccionResult] = await connection.query(
        'INSERT INTO Direccion (direccion) VALUES (?)',
        [direccion]
      );
      direccion_id = direccionResult.insertId;
    }

    // Insertar propiedad
    const [propiedadResult] = await connection.query(`
      INSERT INTO Propiedad (
        partner_id, direccion_id, reglas, descripcion, foto, foto_2, foto_3, direccion, estado_verificacion, n_pisos, referencia
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      partner_id || null,
      direccion_id,
      reglas || null,
      descripcion || null,
      foto_url || null,
      foto_2_url || null,
      foto_3_url || null,
      direccion || null,
      estado_verificacion || null,
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

// Actualizar propiedad existente
router.put('/propiedad-edit/:id', verifyToken, async (req, res) => {
  try {
    const { reglas, descripcion, foto, foto_2, foto_3, direccion, estado_verificacion, periodo_id, n_pisos, referencia } = req.body;

    const connection = await pool.getConnection();

    const [propiedadActual] = await connection.query(
      'SELECT * FROM Propiedad WHERE propiedad_id = ?',
      [req.params.id]
    );

    if (propiedadActual.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Propiedad no encontrada' });
    }

    const propiedad = propiedadActual[0];

    // Subir imágenes nuevas y eliminar viejas si vienen nuevas
    let foto_url = undefined;
    if (foto) {
      foto_url = await uploadToCloudinary(foto);
      await deleteImageByUrl(propiedad.foto);
    }

    let foto_2_url = undefined;
    if (foto_2) {
      foto_2_url = await uploadToCloudinary(foto_2);
      await deleteImageByUrl(propiedad.foto_2);
    }

    let foto_3_url = undefined;
    if (foto_3) {
      foto_3_url = await uploadToCloudinary(foto_3);
      await deleteImageByUrl(propiedad.foto_3);
    }

    // Actualizar dirección si viene
    if (direccion !== undefined) {
      await connection.query(
        'UPDATE Direccion SET direccion = ? WHERE direccion_id = ?',
        [direccion, propiedad.direccion_id]
      );
    }

    const updateFields = {};
    if (reglas !== undefined) updateFields.reglas = reglas;
    if (descripcion !== undefined) updateFields.descripcion = descripcion;
    if (foto_url !== undefined) updateFields.foto = foto_url;
    if (foto_2_url !== undefined) updateFields.foto_2 = foto_2_url;
    if (foto_3_url !== undefined) updateFields.foto_3 = foto_3_url;
    if (direccion !== undefined) updateFields.direccion = direccion;
    if (estado_verificacion !== undefined) updateFields.estado_verificacion = estado_verificacion;
    if (periodo_id !== undefined) updateFields.periodo_id = periodo_id;
    if (n_pisos !== undefined) updateFields.n_pisos = n_pisos;
    if (referencia !== undefined) updateFields.referencia = referencia;

    if (Object.keys(updateFields).length > 0) {
      const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updateFields), req.params.id];
      await connection.query(`UPDATE Propiedad SET ${setClause} WHERE propiedad_id = ?`, values);
    }

    connection.release();

    res.json({ message: 'Propiedad actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar propiedad', error: error.message });
  }
});

// Eliminar propiedad
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [propiedad] = await connection.query(
      'SELECT * FROM Propiedad WHERE propiedad_id = ?',
      [req.params.id]
    );

    if (propiedad.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Propiedad no encontrada' });
    }

    const propiedadEliminar = propiedad[0];

    // Eliminar imágenes en Cloudinary
    await deleteImageByUrl(propiedadEliminar.foto);
    await deleteImageByUrl(propiedadEliminar.foto_2);
    await deleteImageByUrl(propiedadEliminar.foto_3);

    // Eliminar cuartos asociados
    await connection.query('DELETE FROM Cuarto WHERE propiedad_id = ?', [req.params.id]);

    // Eliminar propiedad
    await connection.query('DELETE FROM Propiedad WHERE propiedad_id = ?', [req.params.id]);

    // Eliminar dirección asociada
    await connection.query('DELETE FROM Direccion WHERE direccion_id = ?', [propiedadEliminar.direccion_id]);

    connection.release();

    res.json({ message: 'Propiedad eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar propiedad', error: error.message });
  }
});

module.exports = router;
