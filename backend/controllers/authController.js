const AuthService = require('../services/authService');
const jwtMiddleware = require('../middlewares/authMiddleware');

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }
      const result = await AuthService.verifyCredentials(username, password);
      if (!result.authenticated) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      const token = AuthService.generateToken(result.user);
      res.json({ success: true, token, user: result.user });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static me(req, res) {
    res.json({ user: req.user });
  }

  static logout(req, res) {
    res.json({ success: true, message: 'Logged out successfully.' });
  }
}

module.exports = AuthController;
