const db = require('../config/db');

class UserModel {
  static async findAll() {
    const { rows } = await db.query(
      'SELECT user_id, name, email, role, created_at FROM users ORDER BY user_id'
    );
    return rows;
  }

  static async findById(id) {
    const { rows } = await db.query(
      'SELECT user_id, name, email, role, created_at FROM users WHERE user_id = $1',
      [id]
    );
    return rows[0] || null;
  }

  static async findByEmailOrName(identifier) {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1)',
      [identifier]
    );
    return rows[0] || null;
  }

  static async count() {
    const { rows } = await db.query('SELECT COUNT(*)::INT AS count FROM users');
    return rows[0].count;
  }
}

module.exports = UserModel;
