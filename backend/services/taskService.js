const db = require('../config/db');
const TaskModel = require('../models/taskModel');
const DependencyModel = require('../models/dependencyModel');

class TaskService {
  static validateTaskData(data) {
    const { task_name, importance, arrival_time, burst_time, deadline } = data;

    if (!task_name || !task_name.trim()) {
      const err = new Error('Task name is required.');
      err.statusCode = 400;
      throw err;
    }

    const imp = parseInt(importance, 10);
    const arr = parseInt(arrival_time, 10);
    const burst = parseInt(burst_time, 10);
    const dline = parseInt(deadline, 10);

    if (isNaN(imp) || imp < 1 || imp > 10) {
      const err = new Error('Importance must be between 1 and 10.');
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(arr) || arr < 0) {
      const err = new Error('Arrival time must be non-negative.');
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(burst) || burst <= 0) {
      const err = new Error('Burst time must be greater than 0.');
      err.statusCode = 400;
      throw err;
    }
    if (isNaN(dline) || dline < arr + burst) {
      const err = new Error(`Deadline (${dline}) must be at least Arrival Time + Burst Time (${arr + burst}).`);
      err.statusCode = 400;
      throw err;
    }

    return {
      task_name: task_name.trim(),
      importance: imp,
      arrival_time: arr,
      burst_time: burst,
      deadline: dline,
      user_id: data.user_id ? parseInt(data.user_id, 10) : null
    };
  }

  static async getAllTasks() {
    return await TaskModel.findAllWithDependencies();
  }

  static async getTaskById(taskId) {
    const task = await TaskModel.findById(taskId);
    if (!task) {
      const err = new Error(`Task with ID ${taskId} not found`);
      err.statusCode = 404;
      throw err;
    }
    return task;
  }

  static async createTask(data) {
    const validated = this.validateTaskData(data);
    const dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const newTask = await TaskModel.create(validated, client);

      if (dependencies.length > 0) {
        for (const depId of dependencies) {
          const parsedDepId = parseInt(depId, 10);
          if (!isNaN(parsedDepId) && parsedDepId !== newTask.task_id) {
            await DependencyModel.createIfNotExists(newTask.task_id, parsedDepId, client);
          }
        }
      }

      await client.query('COMMIT');
      return newTask;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async updateTask(taskId, data) {
    const existing = await TaskModel.findById(taskId);
    if (!existing) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    const updated = await TaskModel.update(taskId, data);
    return updated;
  }

  static async deleteTask(taskId) {
    const success = await TaskModel.delete(taskId);
    if (!success) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }
    return { message: `Task ${taskId} deleted successfully.` };
  }
}

module.exports = TaskService;
