const { v4: uuidv4 } = require('uuid');
const pool = require('./database'); // ajusta la ruta según tu estructura

async function asignarUUIDs() {
  const connection = await pool.getConnection();
  try {
    const [usuarios] = await connection.query(
      'SELECT usuario_id FROM Usuario WHERE uuid IS NULL OR uuid = ""'
    );

    for (const user of usuarios) {
      const uuid = uuidv4();
      await connection.query('UPDATE Usuario SET uuid = ? WHERE usuario_id = ?', [
        uuid,
        user.usuario_id,
      ]);
    }

    console.log(`✅ UUID asignados a ${usuarios.length} usuario(s).`);
  } catch (error) {
    console.error('❌ Error al asignar UUIDs:', error);
  } finally {
    connection.release();
    process.exit();
  }
}

asignarUUIDs();
