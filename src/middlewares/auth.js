const jwt = require('jsonwebtoken');
const config = require('../config');

const verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization'];

  if (!token) {
    return res
      .status(403)
      .json({ message: 'Se requiere un token para la autenticación' });
  }

  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

module.exports = verifyToken;
