const TaskService = require('../services/taskService');

class TaskController {
  static async getTasks(req, res) {
    try {
      const tasks = await TaskService.getAllTasks();
      res.json(tasks);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async createTask(req, res) {
    try {
      const newTask = await TaskService.createTask(req.body);
      res.status(201).json(newTask);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async updateTask(req, res) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const updated = await TaskService.updateTask(taskId, req.body);
      res.json(updated);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async deleteTask(req, res) {
    try {
      const taskId = parseInt(req.params.id, 10);
      const result = await TaskService.deleteTask(taskId);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}

module.exports = TaskController;
