const db = require('../config/db');
const TaskModel = require('../models/taskModel');
const DependencyModel = require('../models/dependencyModel');
const HistoryModel = require('../models/historyModel');
const { runSimulation, DEFAULT_WEIGHTS } = require('../scheduler/schedulerEngine');

class SchedulerService {
  /**
   * Executes the dynamic priority simulation and persists results into PostgreSQL.
   * @param {Object} customWeights - optional custom scoring weights
   * @returns {Promise<Object>} simulation results
   */
  static async runAndPersistSimulation(customWeights = DEFAULT_WEIGHTS) {
    const client = await db.pool.connect();
    try {
      // 1. Fetch current tasks and dependencies
      const tasks = await TaskModel.findAllRaw(client);
      const dependencies = await DependencyModel.findAll(client);

      if (tasks.length === 0) {
        const err = new Error('No tasks found to schedule. Please add tasks first.');
        err.statusCode = 400;
        throw err;
      }

      // 2. Run simulation engine in-memory
      const simResult = runSimulation(tasks, dependencies, customWeights);

      // 3. Persist results in PostgreSQL transaction
      await client.query('BEGIN');
      await HistoryModel.clearAll(client);
      await HistoryModel.insertExecutionResults(simResult.executionResults, client);
      await HistoryModel.insertSchedulingDecisions(simResult.schedulingLog, client);
      await client.query('COMMIT');

      return simResult;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = SchedulerService;
