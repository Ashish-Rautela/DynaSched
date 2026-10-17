const DependencyService = require('../services/dependencyService');

class DependencyController {
  static async createDependency(req, res) {
    try {
      const { task_id, depends_on_task_id } = req.body;
      const created = await DependencyService.addDependency(task_id, depends_on_task_id);
      res.status(201).json(created);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async deleteDependency(req, res) {
    try {
      const result = await DependencyService.removeDependency(req.params.id);
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}

module.exports = DependencyController;
