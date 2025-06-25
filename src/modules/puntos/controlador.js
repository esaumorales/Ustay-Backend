// modules/puntos/controlador.js
const modelo = require('./modelo');

const recargarPuntos = async (req, res) => {
    try {
        const { usuario_id, monto_soles, puntos_obtenidos } = req.body;
        const resultado = await modelo.insertarRecarga(usuario_id, monto_soles, puntos_obtenidos);
        res.status(201).json({ message: 'Recarga exitosa', resultado });
    } catch (error) {
        console.error('Error al recargar puntos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = {
    recargarPuntos,
};
