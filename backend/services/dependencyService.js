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

    const hasCycle = await DependencyService.wouldCreateCycle(tId, dId);
    if (hasCycle) {
      const err = new Error('Adding this dependency would create a circular dependency chain.');
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

  static async wouldCreateCycle(newTaskId, newDependsOnId) {
    // Fetch all existing dependencies to build graph
    const allDeps = await DependencyModel.findAll();
    // Build adjacency: task_id -> [depends_on_task_id, ...]
    const graph = new Map();
    allDeps.forEach(dep => {
      if (!graph.has(dep.task_id)) graph.set(dep.task_id, []);
      graph.get(dep.task_id).push(dep.depends_on_task_id);
    });
    // Add the proposed edge temporarily
    if (!graph.has(newTaskId)) graph.set(newTaskId, []);
    graph.get(newTaskId).push(newDependsOnId);

    // DFS from newTaskId — if we can reach newTaskId again, cycle exists
    const visited = new Set();
    const stack = [newDependsOnId];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === newTaskId) return true; // cycle found
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = graph.get(current) || [];
      neighbors.forEach(n => stack.push(n));
    }
    return false;
  }

  static async checkCycleForTask(taskId, proposedDependencies) {
    const tId = parseInt(taskId, 10);
    const allDeps = await DependencyModel.findAll();
    
    // Build adjacency graph excluding existing outgoing edges from taskId (since we are replacing them)
    const graph = new Map();
    allDeps.forEach(dep => {
      if (dep.task_id !== tId) {
        if (!graph.has(dep.task_id)) graph.set(dep.task_id, []);
        graph.get(dep.task_id).push(dep.depends_on_task_id);
      }
    });

    const proposed = proposedDependencies.map(d => parseInt(d, 10)).filter(d => !isNaN(d));
    if (!graph.has(tId)) graph.set(tId, []);
    proposed.forEach(depId => graph.get(tId).push(depId));

    // For each proposed dependency, check if path back to tId exists
    for (const startNode of proposed) {
      if (startNode === tId) return true; // self dependency
      const visited = new Set();
      const stack = [startNode];
      while (stack.length > 0) {
        const current = stack.pop();
        if (current === tId) return true; // cycle detected
        if (visited.has(current)) continue;
        visited.add(current);
        const neighbors = graph.get(current) || [];
        neighbors.forEach(n => stack.push(n));
      }
    }
    return false;
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
