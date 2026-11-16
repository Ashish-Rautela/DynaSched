const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dynasched_jwt_secret_2024';

class AuthService {
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

  /**
   * Generates a JWT for the given user.
   * @param {object} user - { user_id, name, email, role }
   * @returns {string} signed JWT token
   */
  static generateToken(user) {
    const payload = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  /**
   * Verifies a JWT and returns its decoded payload.
   * @param {string} token
   * @returns {object} decoded payload
   * @throws if token is invalid or expired
   */
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

module.exports = AuthService;
