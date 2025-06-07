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
    
    // Consulta para obtener los cuartos con la información principal
    const [cuartos] = await connection.query(`
      SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, 
             c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, 
             tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, 
             u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
      LEFT JOIN Periodo pr ON c.periodo_id = pr.periodo_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
    `);

    // Obtener las fotos asociadas a cada cuarto
    const [fotos] = await connection.query(`
      SELECT f.cuarto_id, f.url_imagen
      FROM Foto f
    `);
    
    connection.release();

    // Mapeo para incluir las fotos en cada cuarto
    const cuartosConFotos = cuartos.map((cuarto) => {
      // Filtrar las fotos para este cuarto específico
      const cuartoFotos = fotos.filter((foto) => foto.cuarto_id === cuarto.cuarto_id).map(foto => foto.url_imagen);

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
        fotos: cuartoFotos,  // Asignar solo las fotos correspondientes al cuarto
      };
    });

    res.json({ cuartos: cuartosConFotos });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cuartos', error: error.message });
  }
});



// Obtener cuarto específico
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [cuartos] = await connection.query(`
      SELECT c.cuarto_id, c.propiedad_id, c.tipo_cuarto_id, c.precio, c.nombre, c.dimensiones, 
             c.n_piso, c.n_cuarto, c.descripcion, c.disponibilidad, c.informacion_adicional, 
             tc.tipo as tipo_cuarto, p.direccion as direccion_propiedad, pr.periodo, p.reglas, 
             u.nombre as nombre_usuario, u.apellido_pa as apellido_usuario, pa.n_dni, pa.direccion, pa.telefono
      FROM Cuarto c
      LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
      LEFT JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
      LEFT JOIN Periodo pr ON c.periodo_id = pr.periodo_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
      WHERE c.cuarto_id = ?
    `, [req.params.id]);

    if (cuartos.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Cuarto no encontrado' });
    }

    cuartos[0].informacion_adicional = cuartos[0].informacion_adicional.replace(/,/g, '\n');

    const [servicios] = await connection.query(`
      SELECT s.servicio_id, s.servicio, s.descripcion
      FROM Servicio s
      JOIN Servicio_x_Cuarto sc ON s.servicio_id = sc.servicio_id
      WHERE sc.cuarto_id = ?
    `, [req.params.id]);

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
          telefono: cuartos[0].telefono,
        },
      },
      servicios,
      fotos,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cuarto', error: error.message });
  }
});

// Obtener cuartos por partner
router.get('/partnerRoom/:partnerId', verifyToken, async (req, res) => {
  try {
    const partnerId = req.params.partnerId;

    const connection = await pool.getConnection();
    const [cuartos] = await connection.query(`
      SELECT 
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
      LEFT JOIN Periodo pr ON c.periodo_id = pr.periodo_id
      LEFT JOIN Partner pa ON p.partner_id = pa.partner_id
      LEFT JOIN Usuario u ON pa.partner_id = u.usuario_id
      LEFT JOIN Foto f ON c.cuarto_id = f.cuarto_id
      WHERE p.partner_id = ?
      GROUP BY c.cuarto_id
    `, [partnerId]);
    connection.release();

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
        periodo: cuarto.periodo || '',
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

// Crear un nuevo cuarto
router.post('/', verifyToken, async (req, res) => {
  try {
    const { 
      propiedad_id, tipo_cuarto_id, precio, nombre, dimensiones, n_piso, n_cuarto, 
      descripcion, disponibilidad, informacion_adicional, periodo_id, fotos 
    } = req.body;

    const fotosUrls = [];
    if (Array.isArray(fotos)) {
      for (const foto of fotos) {
        const url = await uploadToCloudinary(foto);
        if (url) fotosUrls.push(url);
      }
    }

    const connection = await pool.getConnection();

    const [cuartoResult] = await connection.query(`
      INSERT INTO Cuarto (
        propiedad_id, tipo_cuarto_id, precio, nombre, dimensiones, n_piso, n_cuarto, descripcion, 
        disponibilidad, informacion_adicional, periodo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      propiedad_id, tipo_cuarto_id, precio, nombre, dimensiones, n_piso, n_cuarto, 
      descripcion, disponibilidad, informacion_adicional, periodo_id
    ]);

    if (fotosUrls.length > 0) {
      const fotoValues = fotosUrls.map((url) => [cuartoResult.insertId, url]);
      await connection.query('INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?', [fotoValues]);
    }

    connection.release();

    res.status(201).json({
      message: 'Cuarto creado exitosamente',
      cuarto_id: cuartoResult.insertId,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cuarto', error: error.message });
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
      fotos, // Las fotos se pasan desde el frontend
    } = req.body;

    const connection = await pool.getConnection();

    // Primero, obtener los datos actuales del cuarto
    const [cuartoActual] = await connection.query('SELECT * FROM Cuarto WHERE cuarto_id = ?', [req.params.id]);

    if (cuartoActual.length === 0) {
      connection.release();
      return res.status(404).json({ message: 'Cuarto no encontrado' });
    }

    // Obtener los valores actuales del cuarto
    const cuarto = cuartoActual[0];

    // Prepara el objeto para la actualización
    const updatedFields = {};

    // Solo actualizamos los campos que se pasaron en la solicitud
    updatedFields.tipo_cuarto_id = tipo_cuarto_id || cuarto.tipo_cuarto_id;
    updatedFields.precio = precio || cuarto.precio;
    updatedFields.nombre = nombre || cuarto.nombre;
    updatedFields.dimensiones = dimensiones || cuarto.dimensiones;
    updatedFields.n_piso = n_piso || cuarto.n_piso;
    updatedFields.n_cuarto = n_cuarto || cuarto.n_cuarto;
    updatedFields.descripcion = descripcion || cuarto.descripcion;
    updatedFields.disponibilidad = disponibilidad !== undefined ? disponibilidad : cuarto.disponibilidad;
    updatedFields.informacion_adicional = informacion_adicional || cuarto.informacion_adicional;
    updatedFields.periodo_id = periodo_id || cuarto.periodo_id;

    // Actualización de los datos del cuarto
    const setClause = Object.keys(updatedFields).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updatedFields), req.params.id];
    await connection.query(`UPDATE Cuarto SET ${setClause} WHERE cuarto_id = ?`, values);

    // Si se pasan nuevas fotos, gestionarlas
    if (fotos && fotos.length > 0) {
      // Eliminar fotos anteriores de la tabla Foto
      await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [req.params.id]);

      // Subir nuevas fotos a Cloudinary
      const newImageUrls = await Promise.all(fotos.map(uploadToCloudinary));

      // Insertar nuevas fotos en la tabla Foto
      const fotoValues = newImageUrls.map((url) => [req.params.id, url]);
      await connection.query('INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?', [fotoValues]);
    }

    connection.release();

    res.json({ message: 'Cuarto actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar cuarto:', error);
    res.status(500).json({ message: 'Error al actualizar cuarto', error: error.message });
  }
});


// Eliminar cuarto
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [fotos] = await connection.query('SELECT * FROM Foto WHERE cuarto_id = ?', [req.params.id]);

    for (const foto of fotos) {
      await deleteImageByUrl(foto.url_imagen);
    }

    await connection.query('DELETE FROM Foto WHERE cuarto_id = ?', [req.params.id]);
    await connection.query('DELETE FROM Cuarto WHERE cuarto_id = ?', [req.params.id]);

    connection.release();

    res.json({ message: 'Cuarto eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar cuarto', error: error.message });
  }
});

module.exports = router;

// Modificar la consulta en GET /
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
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
    }));

    res.json({ cuartos: cuartosConPartner });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cuartos', error: error.message });
  }
});

// Modificar la ruta POST para incluir periodo_id
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
      periodo_id,
      fotos // Nueva propiedad para las fotos
    } = req.body;

    const connection = await pool.getConnection();

    // Insertar el cuarto en la base de datos
    const [result] = await connection.query(
      `INSERT INTO Cuarto (
        propiedad_id, tipo_cuarto_id, precio, nombre, 
        dimensiones, n_piso, n_cuarto, descripcion, 
        disponibilidad, informacion_adicional, periodo_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        periodo_id
      ]
    );

    // Si se proporcionan fotos, insertarlas en la tabla Foto
    if (fotos && fotos.length > 0) {
      // Insertar las URLs de las fotos en la tabla Foto
      const fotoValues = fotos.map(url => [result.insertId, url]);
      await connection.query('INSERT INTO Foto (cuarto_id, url_imagen) VALUES ?', [fotoValues]);
    }

    connection.release();

    res.status(201).json({
      message: 'Cuarto creado exitosamente',
      cuarto_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear cuarto', error: error.message });
  }
});
