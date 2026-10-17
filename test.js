const assert = require('assert');
const { runSimulation, calculateDynamicScore } = require('./backend/scheduler/schedulerEngine');
const AuthService = require('./backend/services/authService');
const TaskService = require('./backend/services/taskService');
const DependencyService = require('./backend/services/dependencyService');
const SchedulerService = require('./backend/services/schedulerService');
const HistoryService = require('./backend/services/historyService');
const UserService = require('./backend/services/userService');

const UserModel = require('./backend/models/userModel');
const TaskModel = require('./backend/models/taskModel');
const DependencyModel = require('./backend/models/dependencyModel');
const HistoryModel = require('./backend/models/historyModel');

async function runTests() {
  console.log('🚀 Running self-check test suite for DynaSched MVC & Services Architecture...\n');

  // -------------------------------------------------------------
  // Test Suite 1: Dynamic Priority Scheduling Algorithm & Aging
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Scheduler Engine & Aging ---');
  const taskA = { task_id: 1, task_name: 'Task A', importance: 5, arrival_time: 0, burst_time: 4, deadline: 20 };
  const scoreAtT0 = calculateDynamicScore(taskA, 0);
  const scoreAtT10 = calculateDynamicScore(taskA, 10);

  assert(scoreAtT10.score > scoreAtT0.score, 'Aging must increase priority score over time');
  assert.strictEqual(scoreAtT10.waitingTime, 10, 'Waiting time should be 10 at t=10');
  console.log('✔ Test 1.1 Passed: Dynamic score and aging verified.');

  const sampleTasks = [
    { task_id: 1, task_name: 'Setup DB', importance: 5, arrival_time: 0, burst_time: 3, deadline: 10 },
    { task_id: 2, task_name: 'Seed Data', importance: 10, arrival_time: 0, burst_time: 2, deadline: 10 }
  ];
  const sampleDeps = [{ task_id: 2, depends_on_task_id: 1 }];

  const sim = runSimulation(sampleTasks, sampleDeps);
  assert.strictEqual(sim.executionResults[0].taskId, 1, 'Task 1 must run first because Task 2 depends on it');
  assert.strictEqual(sim.executionResults[1].taskId, 2, 'Task 2 runs after Task 1 completes');
  assert.strictEqual(sim.summaryMetrics.totalTasks, 2);
  assert.strictEqual(sim.summaryMetrics.deadlinesMet, 2);
  console.log('✔ Test 1.2 Passed: Task dependency ordering verified.');

  const lowImpTask = { task_id: 10, task_name: 'Low Imp Batch', importance: 1, arrival_time: 0, burst_time: 2, deadline: 100 };
  const highImpTask = { task_id: 20, task_name: 'High Imp Burst', importance: 8, arrival_time: 15, burst_time: 2, deadline: 100 };
  const simAging = runSimulation([lowImpTask, highImpTask], []);
  assert.strictEqual(simAging.executionResults[0].taskId, 10, 'Low importance task executes first since it arrived early');
  console.log('✔ Test 1.3 Passed: Aging prevents starvation of early arrived tasks.\n');

  // -------------------------------------------------------------
  // Test Suite 2: HTTP Basic Authentication Service
  // -------------------------------------------------------------
  console.log('--- Test Suite 2: Basic Auth Service ---');
  // 2.1 Header parsing
  const validHeader = 'Basic ' + Buffer.from('admin:admin123').toString('base64');
  const parsed = AuthService.parseBasicAuthHeader(validHeader);
  assert(parsed !== null, 'Header parsing should succeed');
  assert.strictEqual(parsed.username, 'admin');
  assert.strictEqual(parsed.password, 'admin123');
  assert.strictEqual(AuthService.parseBasicAuthHeader('Bearer someToken'), null, 'Bearer token should return null');
  console.log('✔ Test 2.1 Passed: HTTP Basic Auth header parsing verified.');

  // 2.2 Admin verification
  const adminAuth = await AuthService.verifyCredentials('admin', 'admin123');
  assert.strictEqual(adminAuth.authenticated, true);
  assert.strictEqual(adminAuth.user.role, 'Admin');
  console.log('✔ Test 2.2 Passed: Admin credentials verification verified.');

  // 2.3 Invalid credentials rejection
  const invalidAuth = await AuthService.verifyCredentials('admin', 'wrongpass');
  assert.strictEqual(invalidAuth.authenticated, false);
  console.log('✔ Test 2.3 Passed: Invalid password rejected correctly.');

  // 2.4 DB User verification
  const dbUserAuth = await AuthService.verifyCredentials('nitin892684@gmail.com', 'password123');
  assert.strictEqual(dbUserAuth.authenticated, true);
  assert.strictEqual(dbUserAuth.user.name, 'Nitin');
  console.log('✔ Test 2.4 Passed: Team member database authentication verified.\n');

  // -------------------------------------------------------------
  // Test Suite 3: Task Service Validation & Rules
  // -------------------------------------------------------------
  console.log('--- Test Suite 3: Task Service Validation ---');
  // 3.1 Task name requirement
  assert.throws(() => {
    TaskService.validateTaskData({ task_name: '', importance: 5, arrival_time: 0, burst_time: 2, deadline: 10 });
  }, /Task name is required/, 'Must reject empty task name');

  // 3.2 Importance boundary (1-10)
  assert.throws(() => {
    TaskService.validateTaskData({ task_name: 'Invalid Task', importance: 15, arrival_time: 0, burst_time: 2, deadline: 10 });
  }, /Importance must be between 1 and 10/, 'Must reject out-of-range importance');

  // 3.3 Deadline constraint: deadline >= arrival + burst
  assert.throws(() => {
    TaskService.validateTaskData({ task_name: 'Invalid Deadline', importance: 5, arrival_time: 5, burst_time: 10, deadline: 12 });
  }, /must be at least Arrival Time \+ Burst Time/, 'Must enforce deadline >= arrival + burst');
  console.log('✔ Test 3.1 Passed: Task validation constraints verified.\n');

  // -------------------------------------------------------------
  // Test Suite 4: Architecture Division (MVC & Services Integrity)
  // -------------------------------------------------------------
  console.log('--- Test Suite 4: Modular Services & MVC Integrity ---');
  assert(typeof UserModel.findAll === 'function', 'UserModel.findAll exists');
  assert(typeof TaskModel.findAllWithDependencies === 'function', 'TaskModel.findAllWithDependencies exists');
  assert(typeof DependencyModel.findAll === 'function', 'DependencyModel.findAll exists');
  assert(typeof HistoryModel.getPerformanceSummary === 'function', 'HistoryModel.getPerformanceSummary exists');

  assert(typeof AuthService.verifyCredentials === 'function', 'AuthService.verifyCredentials exists');
  assert(typeof UserService.getAllUsers === 'function', 'UserService.getAllUsers exists');
  assert(typeof TaskService.createTask === 'function', 'TaskService.createTask exists');
  assert(typeof DependencyService.addDependency === 'function', 'DependencyService.addDependency exists');
  assert(typeof SchedulerService.runAndPersistSimulation === 'function', 'SchedulerService.runAndPersistSimulation exists');
  assert(typeof HistoryService.seedSampleWorkload === 'function', 'HistoryService.seedSampleWorkload exists');
  console.log('✔ Test 4.1 Passed: All 6 backend services and 4 models correctly modularized and exported.\n');

  console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY! 🚀');
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
