const db = require('../config/db');

class HistoryModel {
  static async getPerformanceSummary(client = db) {
    const { rows } = await client.query('SELECT * FROM performance_summary_view');
    return rows[0] || {};
  }

  static async getSchedulingHistory(client = db) {
    const { rows } = await client.query(`
      SELECT sh.*, t.task_name 
      FROM scheduling_history sh 
      LEFT JOIN tasks t ON sh.selected_task_id = t.task_id 
      ORDER BY sh.simulated_time ASC
    `);
    return rows;
  }

  static async getExecutionHistory(client = db) {
    const { rows } = await client.query(`
      SELECT eh.*, t.task_name 
      FROM execution_history eh 
      LEFT JOIN tasks t ON eh.task_id = t.task_id 
      ORDER BY eh.start_time ASC
    `);
    return rows;
  }

  static async insertExecutionResults(results, client = db) {
    const query = `
      INSERT INTO execution_history 
        (task_id, start_time, completion_time, waiting_time, turnaround_time, response_time, deadline_met)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    for (const exec of results) {
      await client.query(query, [
        exec.taskId,
        exec.startTime,
        exec.completionTime,
        exec.waitingTime,
        exec.turnaroundTime,
        exec.responseTime,
        exec.deadlineMet
      ]);
    }
  }

  static async insertSchedulingDecisions(decisions, client = db) {
    const query = `
      INSERT INTO scheduling_history 
        (simulated_time, selected_task_id, priority_score, algorithm, decision_reason)
      VALUES ($1, $2, $3, $4, $5)
    `;
    for (const log of decisions) {
      await client.query(query, [
        log.simulatedTime,
        log.selectedTaskId,
        log.priorityScore,
        'Dynamic Priority with Aging',
        log.decisionReason
      ]);
    }
  }

  static async clearAll(client = db) {
    await client.query('DELETE FROM execution_history');
    await client.query('DELETE FROM scheduling_history');
  }
}

module.exports = HistoryModel;
