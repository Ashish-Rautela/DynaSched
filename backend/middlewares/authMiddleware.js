const AuthService = require('../services/authService');

module.exports = function jwtMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : req.headers['x-access-token'];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please login.' });
  }

  try {
    const decoded = AuthService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
};
