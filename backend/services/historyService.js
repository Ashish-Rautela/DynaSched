const db = require('../config/db');
const TaskModel = require('../models/taskModel');
const DependencyModel = require('../models/dependencyModel');
const HistoryModel = require('../models/historyModel');
const UserModel = require('../models/userModel');

class HistoryService {
  static async getPerformanceMetricsAndHistory() {
    const summary = await HistoryModel.getPerformanceSummary();
    const schedulingDecisions = await HistoryModel.getSchedulingHistory();
    const executionResults = await HistoryModel.getExecutionHistory();

    return {
      summary,
      schedulingDecisions,
      executionResults
    };
  }

  static async resetSimulation() {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await TaskModel.resetAllStatus('PENDING', client);
      await HistoryModel.clearAll(client);
      await client.query('COMMIT');
      return { message: 'Simulation reset. All tasks set to PENDING.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async seedSampleWorkload() {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await HistoryModel.clearAll(client);
      await DependencyModel.deleteAll(client);
      await TaskModel.deleteAll(client);

      // Get available users to assign tasks
      const users = await UserModel.findAll();
      const u1 = users[0]?.user_id || null;
      const u2 = users[1]?.user_id || null;
      const u3 = users[2]?.user_id || null;
      const u4 = users[3]?.user_id || null;

      // Realistic workload showcasing aging, urgency, dependencies, and burst times
      const sampleTasks = [
        { task_name: 'T1: Auth Service Setup', importance: 6, arrival_time: 0, burst_time: 4, deadline: 25, user_id: u1 },
        { task_name: 'T2: Database Migration', importance: 7, arrival_time: 0, burst_time: 5, deadline: 30, user_id: u2 },
        { task_name: 'T3: Payment Gateway', importance: 9, arrival_time: 1, burst_time: 4, deadline: 35, user_id: u3 },
        { task_name: 'T4: Background Log Archiver', importance: 2, arrival_time: 0, burst_time: 3, deadline: 50, user_id: u4 },
        { task_name: 'T5: Security Patch Deploy', importance: 8, arrival_time: 5, burst_time: 3, deadline: 18, user_id: u1 },
        { task_name: 'T6: Analytics Reporting', importance: 5, arrival_time: 6, burst_time: 4, deadline: 45, user_id: u2 }
      ];

      const createdIds = [];
      for (const t of sampleTasks) {
        const created = await TaskModel.create(t, client);
        createdIds.push(created.task_id);
      }

      // Dependencies:
      // T3 (Payment Gateway) depends on T1 (Auth Service Setup)
      // T6 (Analytics Reporting) depends on T2 (Database Migration)
      await DependencyModel.create(createdIds[2], createdIds[0], client);
      await DependencyModel.create(createdIds[5], createdIds[1], client);

      await client.query('COMMIT');
      return { message: 'Sample workload successfully seeded with realistic tasks and dependencies.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = HistoryService;
