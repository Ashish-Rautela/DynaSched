const express = require('express');
const router = express.Router();

const basicAuthMiddleware = require('../middlewares/authMiddleware');
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const TaskController = require('../controllers/taskController');
const DependencyController = require('../controllers/dependencyController');
const SchedulerController = require('../controllers/schedulerController');
const HistoryController = require('../controllers/historyController');

// ---------------------------------------------------------------------------
// Authentication Routes
// ---------------------------------------------------------------------------
router.post('/auth/login', AuthController.login);
router.get('/auth/me', basicAuthMiddleware, AuthController.me);

// ---------------------------------------------------------------------------
// Protected API Routes (Requires HTTP Basic Auth)
// ---------------------------------------------------------------------------
router.use(basicAuthMiddleware);

// User APIs
router.get('/users', UserController.getUsers);

// Task CRUD APIs
router.get('/tasks', TaskController.getTasks);
router.post('/tasks', TaskController.createTask);
router.put('/tasks/:id', TaskController.updateTask);
router.delete('/tasks/:id', TaskController.deleteTask);

// Dependency APIs
router.post('/dependencies', DependencyController.createDependency);
router.delete('/dependencies/:id', DependencyController.deleteDependency);

// Scheduler Simulation APIs
router.post('/simulate', SchedulerController.simulate);

// History, Seeding & Reset APIs
router.get('/history', HistoryController.getHistory);
router.post('/reset', HistoryController.reset);
router.post('/seed', HistoryController.seed);

module.exports = router;
