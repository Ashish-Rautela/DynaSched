const AuthService = require('../services/authService');

class AuthController {
  /**
   * Endpoint to verify credentials and exchange for Basic Auth header token.
   * Supports JSON body { username, password } or Authorization header.
   */
  static async login(req, res) {
    try {
      let username = req.body?.username;
      let password = req.body?.password;

      // Also support Authorization header
      if ((!username || !password) && req.headers.authorization) {
        const parsed = AuthService.parseBasicAuthHeader(req.headers.authorization);
        if (parsed) {
          username = parsed.username;
          password = parsed.password;
        }
      }

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const result = await AuthService.verifyCredentials(username, password);
      if (!result.authenticated) {
        return res.status(401).json({ error: result.error || 'Invalid credentials' });
      }

      const token = Buffer.from(`${username}:${password}`).toString('base64');
      res.json({
        success: true,
        user: result.user,
        basicToken: token
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Returns current authenticated user profile
   */
  static async me(req, res) {
    res.json({ user: req.user });
  }
}

module.exports = AuthController;
