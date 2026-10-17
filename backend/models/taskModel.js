const db = require('../config/db');

class TaskModel {
  static async findAllWithDependencies() {
    const query = `
      SELECT 
        t.task_id, 
        t.task_name, 
        t.importance, 
        t.arrival_time, 
        t.burst_time, 
        t.deadline, 
        t.status, 
        t.user_id,
        u.name AS user_name,
        COALESCE(
          json_agg(
            json_build_object(
              'dependency_id', td.dependency_id,
              'depends_on_task_id', td.depends_on_task_id,
              'depends_on_task_name', dep.task_name
            )
          ) FILTER (WHERE td.dependency_id IS NOT NULL), '[]'
        ) AS dependencies
      FROM tasks t
      LEFT JOIN users u ON t.user_id = u.user_id
      LEFT JOIN task_dependencies td ON t.task_id = td.task_id
      LEFT JOIN tasks dep ON td.depends_on_task_id = dep.task_id
      GROUP BY t.task_id, u.name
      ORDER BY t.arrival_time ASC, t.task_id ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  static async findAllRaw(client = db) {
    const { rows } = await client.query(
      'SELECT * FROM tasks ORDER BY arrival_time ASC, task_id ASC'
    );
    return rows;
  }

  static async findById(taskId, client = db) {
    const { rows } = await client.query(
      'SELECT * FROM tasks WHERE task_id = $1',
      [taskId]
    );
    return rows[0] || null;
  }

  static async create(data, client = db) {
    const { task_name, importance, arrival_time, burst_time, deadline, user_id, status = 'PENDING' } = data;
    const sql = `
      INSERT INTO tasks (task_name, importance, arrival_time, burst_time, deadline, user_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [
      task_name.trim(),
      importance,
      arrival_time,
      burst_time,
      deadline,
      user_id || null,
      status
    ]);
    return rows[0];
  }

  static async update(taskId, data, client = db) {
    const { task_name, importance, arrival_time, burst_time, deadline, user_id, status } = data;
    const sql = `
      UPDATE tasks 
      SET 
        task_name = COALESCE($1, task_name),
        importance = COALESCE($2, importance),
        arrival_time = COALESCE($3, arrival_time),
        burst_time = COALESCE($4, burst_time),
        deadline = COALESCE($5, deadline),
        user_id = COALESCE($6, user_id),
        status = COALESCE($7, status)
      WHERE task_id = $8
      RETURNING *;
    `;
    const { rows } = await client.query(sql, [
      task_name,
      importance,
      arrival_time,
      burst_time,
      deadline,
      user_id,
      status,
      taskId
    ]);
    return rows[0] || null;
  }

  static async delete(taskId, client = db) {
    const { rowCount } = await client.query('DELETE FROM tasks WHERE task_id = $1', [taskId]);
    return rowCount > 0;
  }

  static async resetAllStatus(status = 'PENDING', client = db) {
    await client.query('UPDATE tasks SET status = $1', [status]);
  }

  static async deleteAll(client = db) {
    await client.query('DELETE FROM tasks');
  }
}

module.exports = TaskModel;
