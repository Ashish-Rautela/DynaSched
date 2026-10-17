const DependencyModel = require('../models/dependencyModel');

class DependencyService {
  static async addDependency(taskId, dependsOnTaskId) {
    const tId = parseInt(taskId, 10);
    const dId = parseInt(dependsOnTaskId, 10);

    if (isNaN(tId) || isNaN(dId)) {
      const err = new Error('Both task_id and depends_on_task_id are required.');
      err.statusCode = 400;
      throw err;
    }

    if (tId === dId) {
      const err = new Error('A task cannot depend on itself.');
      err.statusCode = 400;
      throw err;
    }

    try {
      const newDep = await DependencyModel.create(tId, dId);
      return newDep;
    } catch (err) {
      if (err.code === '23505') {
        const customErr = new Error('This dependency already exists.');
        customErr.statusCode = 400;
        throw customErr;
      }
      throw err;
    }
  }

  static async removeDependency(dependencyId) {
    const depId = parseInt(dependencyId, 10);
    if (isNaN(depId)) {
      const err = new Error('Valid dependency ID required');
      err.statusCode = 400;
      throw err;
    }

    const success = await DependencyModel.delete(depId);
    if (!success) {
      const err = new Error('Dependency not found.');
      err.statusCode = 404;
      throw err;
    }
    return { message: 'Dependency removed.' };
  }
}

module.exports = DependencyService;
