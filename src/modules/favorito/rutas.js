const express = require('express');
const router = express.Router();
const verifyToken = require('../../middlewares/auth');
const pool = require('../../database');

// Obtener favoritos por usuario
router.get('/usuario/:usuarioId', verifyToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [favoritos] = await connection.query(
      `
    SELECT 
        f.favorito_id,
        f.usuario_id,
        f.cuarto_id,
        c.nombre AS nombre_cuarto,
        c.precio,
        p.direccion AS direccion_propiedad,
        tc.tipo AS tipo_cuarto,
        u.nombre AS propietario_nombre,
        u.apellido_pa AS propietario_apellido_pa,
        u.apellido_ma AS propietario_apellido_ma,
        MIN(ft.url_imagen) AS imagen
    FROM Favorito f
    JOIN Cuarto c ON f.cuarto_id = c.cuarto_id
    JOIN Propiedad p ON c.propiedad_id = p.propiedad_id
    JOIN Partner pr ON p.partner_id = pr.partner_id
    JOIN Usuario u ON pr.partner_id = u.usuario_id
    LEFT JOIN Tipo_Cuarto tc ON c.tipo_cuarto_id = tc.tipo_cuarto_id
    LEFT JOIN Foto ft ON c.cuarto_id = ft.cuarto_id
    WHERE f.usuario_id = ?
    GROUP BY f.favorito_id
`,
      [req.params.usuarioId]
    );
    connection.release();

    // Puedes unir los apellidos y nombre para mostrar el propietario completo
    const favoritosFormateados = favoritos.map((fav) => ({
      favorito_id: fav.favorito_id,
      usuario_id: fav.usuario_id,
      cuarto_id: fav.cuarto_id,
      nombre_cuarto: fav.nombre_cuarto,
      precio: fav.precio,
      direccion_propiedad: fav.direccion_propiedad,
      tipo_cuarto: fav.tipo_cuarto,
      partner: `${fav.propietario_nombre} ${fav.propietario_apellido_pa} ${fav.propietario_apellido_ma}`,
      imagen: fav.imagen,
    }));

    res.json({ favoritos: favoritosFormateados });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al obtener favoritos', error: error.message });
  }
});

// Agregar un favorito
router.post('/', verifyToken, async (req, res) => {
  try {
    const { usuario_id, cuarto_id } = req.body;
    const connection = await pool.getConnection();

    // Inserta el favorito en la base de datos
    await connection.query(
      'INSERT INTO Favorito (usuario_id, cuarto_id) VALUES (?, ?)',
      [usuario_id, cuarto_id]
    );

    connection.release();
    res.status(201).json({ message: 'Favorito agregado exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al agregar favorito', error: error.message });
  }
});

// Eliminar un favorito
router.delete('/:favoritoId', verifyToken, async (req, res) => {
  try {
    const { favoritoId } = req.params;
    const connection = await pool.getConnection();

    // Elimina el favorito de la base de datos
    const [result] = await connection.query(
      'DELETE FROM Favorito WHERE favorito_id = ?',
      [favoritoId]
    );

    connection.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Favorito no encontrado' });
    }

    res.json({ message: 'Favorito eliminado exitosamente' });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Error al eliminar favorito', error: error.message });
  }
});

module.exports = router;
