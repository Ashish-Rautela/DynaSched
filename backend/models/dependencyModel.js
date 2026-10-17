const db = require('../config/db');

class DependencyModel {
  static async findAll(client = db) {
    const { rows } = await client.query('SELECT task_id, depends_on_task_id FROM task_dependencies');
    return rows;
  }

  static async create(taskId, dependsOnTaskId, client = db) {
    const { rows } = await client.query(
      'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2) RETURNING *',
      [taskId, dependsOnTaskId]
    );
    return rows[0];
  }

  static async createIfNotExists(taskId, dependsOnTaskId, client = db) {
    const { rows } = await client.query(
      'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
      [taskId, dependsOnTaskId]
    );
    return rows[0] || null;
  }

  static async delete(dependencyId, client = db) {
    const { rowCount } = await client.query(
      'DELETE FROM task_dependencies WHERE dependency_id = $1',
      [dependencyId]
    );
    return rowCount > 0;
  }

  static async deleteAll(client = db) {
    await client.query('DELETE FROM task_dependencies');
  }
}

module.exports = DependencyModel;
