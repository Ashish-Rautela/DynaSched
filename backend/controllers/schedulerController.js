const SchedulerService = require('../services/schedulerService');

class SchedulerController {
  static async simulate(req, res) {
    try {
      const customWeights = req.body?.weights;
      const simResult = await SchedulerService.runAndPersistSimulation(customWeights);
      res.json({
        success: true,
        data: simResult
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}

module.exports = SchedulerController;
