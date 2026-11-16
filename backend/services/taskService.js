const db = require('../config/db');
const TaskModel = require('../models/taskModel');
const DependencyModel = require('../models/dependencyModel');
const DependencyService = require('./dependencyService');

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
    let dline = parseInt(deadline, 10);

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

    // Standard RTOS Laxity Formula: Deadline = Arrival + Burst * (1 + (10 - Importance) / 5)
    if (isNaN(dline)) {
      const laxityFactor = 1 + (10 - imp) / 5;
      dline = Math.ceil(arr + (burst * laxityFactor));
    }

    if (dline < arr + burst) {
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

    const mergedData = {
      task_name: data.task_name !== undefined ? data.task_name : existing.task_name,
      importance: data.importance !== undefined ? data.importance : existing.importance,
      arrival_time: data.arrival_time !== undefined ? data.arrival_time : existing.arrival_time,
      burst_time: data.burst_time !== undefined ? data.burst_time : existing.burst_time,
      deadline: data.deadline !== undefined ? data.deadline : existing.deadline,
      user_id: data.user_id !== undefined ? data.user_id : existing.user_id,
      status: data.status !== undefined ? data.status : existing.status
    };

    const validated = this.validateTaskData(mergedData);
    const dependencies = Array.isArray(data.dependencies) ? data.dependencies : null;

    if (dependencies !== null) {
      for (const depId of dependencies) {
        const pDepId = parseInt(depId, 10);
        if (pDepId === taskId) {
          const err = new Error(`Task T${taskId} cannot depend on itself.`);
          err.statusCode = 400;
          throw err;
        }
      }

      const hasCycle = await DependencyService.checkCycleForTask(taskId, dependencies);
      if (hasCycle) {
        const err = new Error(`Circular dependency detected: Setting these dependencies for Task T${taskId} would create a deadlock cycle.`);
        err.statusCode = 400;
        throw err;
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await TaskModel.update(taskId, validated, client);

      if (dependencies !== null) {
        await DependencyModel.deleteByTaskId(taskId, client);
        for (const depId of dependencies) {
          const pDepId = parseInt(depId, 10);
          if (!isNaN(pDepId) && pDepId !== taskId) {
            await DependencyModel.createIfNotExists(taskId, pDepId, client);
          }
        }
      }

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
