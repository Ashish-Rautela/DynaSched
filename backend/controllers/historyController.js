const HistoryService = require('../services/historyService');

class HistoryController {
  static async getHistory(req, res) {
    try {
      const data = await HistoryService.getPerformanceMetricsAndHistory();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async reset(req, res) {
    try {
      const result = await HistoryService.resetSimulation();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async seed(req, res) {
    try {
      const result = await HistoryService.seedSampleWorkload();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = HistoryController;
