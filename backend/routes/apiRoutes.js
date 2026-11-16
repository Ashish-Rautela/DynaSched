const express = require('express');
const router = express.Router();

const jwtMiddleware = require('../middlewares/authMiddleware');
const AuthController = require('../controllers/authController');
const UserController = require('../controllers/userController');
const TaskController = require('../controllers/taskController');
const DependencyController = require('../controllers/dependencyController');
const SchedulerController = require('../controllers/schedulerController');
const HistoryController = require('../controllers/historyController');

// Public routes
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', AuthController.logout);

// Protected routes
router.get('/auth/me', jwtMiddleware, AuthController.me);
router.use(jwtMiddleware);

router.get('/users', UserController.getUsers);
router.get('/tasks', TaskController.getTasks);
router.post('/tasks', TaskController.createTask);
router.put('/tasks/:id', TaskController.updateTask);
router.delete('/tasks/:id', TaskController.deleteTask);
router.post('/dependencies', DependencyController.createDependency);
router.delete('/dependencies/:id', DependencyController.deleteDependency);
router.post('/simulate', SchedulerController.simulate);
router.post('/simulate/compare', SchedulerController.compare);
router.get('/history', HistoryController.getHistory);
router.post('/reset', HistoryController.reset);
router.post('/seed', HistoryController.seed);

module.exports = router;
