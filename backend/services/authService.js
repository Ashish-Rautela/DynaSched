const UserModel = require('../models/userModel');

class AuthService {
  /**
   * Parses standard HTTP Basic Auth header: 'Basic <base64(user:pass)>'
   * @param {string} authHeader
   * @returns {{ username: string, password: string } | null}
   */
  static parseBasicAuthHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return null;
    }
    try {
      const base64Credentials = authHeader.substring(6).trim();
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const colonIndex = credentials.indexOf(':');
      if (colonIndex === -1) {
        return null;
      }
      const username = credentials.substring(0, colonIndex);
      const password = credentials.substring(colonIndex + 1);
      return { username, password };
    } catch {
      return null;
    }
  }

  /**
   * Verifies credentials against configured admin or database users.
   * @param {string} username - Username, email, or team member name
   * @param {string} password - User password
   * @returns {Promise<{ authenticated: boolean, user?: object, error?: string }>}
   */
  static async verifyCredentials(username, password) {
    if (!username || !password) {
      return { authenticated: false, error: 'Missing username or password' };
    }

    const adminUser = process.env.BASIC_AUTH_USER || 'admin';
    const adminPass = process.env.BASIC_AUTH_PASS || 'admin123';

    // 1. Check against Admin credentials
    if (username === adminUser && password === adminPass) {
      return {
        authenticated: true,
        user: {
          user_id: 0,
          name: 'Administrator',
          email: `${adminUser}@dynasched.local`,
          role: 'Admin'
        }
      };
    }

    // 2. Check against Database Users (Email or Name)
    try {
      const dbUser = await UserModel.findByEmailOrName(username);
      if (dbUser) {
        // Check password (default is 'password123')
        const storedPassword = dbUser.password || 'password123';
        if (password === storedPassword) {
          return {
            authenticated: true,
            user: {
              user_id: dbUser.user_id,
              name: dbUser.name,
              email: dbUser.email,
              role: dbUser.role
            }
          };
        }
      }
    } catch (err) {
      console.error('Error verifying user credentials in DB:', err.message);
    }

    return { authenticated: false, error: 'Invalid credentials' };
  }
}

module.exports = AuthService;
