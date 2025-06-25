// modules/puntos/modelo.js
const db = require('../../database');

const insertarRecarga = async (usuario_id, monto_soles, puntos_obtenidos) => {
    const [result] = await db.query(
        `INSERT INTO RecargaPuntos (usuario_id, monto_soles, puntos_obtenidos)
         VALUES (?, ?, ?)`,
        [usuario_id, monto_soles, puntos_obtenidos]
    );
    return result;
};

module.exports = {
    insertarRecarga,
};
