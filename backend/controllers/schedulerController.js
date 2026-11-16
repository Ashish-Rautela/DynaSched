const SchedulerService = require('../services/schedulerService');

class SchedulerController {
  static async simulate(req, res) {
    try {
      const customWeights = req.body?.weights;
      const algorithm = req.body?.algorithm || 'dynamic';
      const simResult = await SchedulerService.runAndPersistSimulation(customWeights, algorithm);
      res.json({
        success: true,
        data: simResult
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async compare(req, res) {
    try {
      const customWeights = req.body?.weights;
      const compResult = await SchedulerService.compareAllAlgorithms(customWeights);
      res.json({ success: true, data: compResult });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}

module.exports = SchedulerController;
