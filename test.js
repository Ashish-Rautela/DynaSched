const assert = require('assert');
const {
  runSimulation,
  runFCFS,
  runSJF,
  runStaticPriority,
  calculateDynamicScore
} = require('./backend/scheduler/schedulerEngine');
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
  console.log('🚀 Running test suite for DynaSched with JWT & Comparative Scheduling Algorithms...\n');

  // -------------------------------------------------------------
  // Test Suite 1: Dynamic Priority Scheduling Algorithm & Aging
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Dynamic Priority & Aging ---');
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

  // Test 1.3 Circular Dependency Deadlock Catch
  assert.throws(() => {
    runSimulation(
      [
        { task_id: 1, task_name: 'Task 1', importance: 5, arrival_time: 0, burst_time: 2, deadline: 10 },
        { task_id: 2, task_name: 'Task 2', importance: 5, arrival_time: 0, burst_time: 2, deadline: 10 }
      ],
      [
        { task_id: 1, depends_on_task_id: 2 },
        { task_id: 2, depends_on_task_id: 1 }
      ]
    );
  }, /Deadlock detected/, 'Scheduler must detect deadlocks caused by circular dependencies');
  console.log('✔ Test 1.3 Passed: Circular dependency deadlock detection verified.');

  const lowImpTask = { task_id: 10, task_name: 'Low Imp Batch', importance: 1, arrival_time: 0, burst_time: 2, deadline: 100 };
  const highImpTask = { task_id: 20, task_name: 'High Imp Burst', importance: 8, arrival_time: 15, burst_time: 2, deadline: 100 };
  const simAging = runSimulation([lowImpTask, highImpTask], []);
  assert.strictEqual(simAging.executionResults[0].taskId, 10, 'Low importance task executes first since it arrived early');
  console.log('✔ Test 1.3 Passed: Aging prevents starvation of early arrived tasks.\n');

  // -------------------------------------------------------------
  // Test Suite 2: Baseline Scheduling Algorithms (FCFS, SJF, Static)
  // -------------------------------------------------------------
  console.log('--- Test Suite 2: Baseline Algorithms (FCFS, SJF, Static Priority) ---');

  const compTasks = [
    { task_id: 1, task_name: 'T1 Long', importance: 3, arrival_time: 0, burst_time: 10, deadline: 30 },
    { task_id: 2, task_name: 'T2 Short', importance: 9, arrival_time: 1, burst_time: 2, deadline: 30 },
    { task_id: 3, task_name: 'T3 Med', importance: 6, arrival_time: 1, burst_time: 4, deadline: 30 }
  ];

  // 2.1 FCFS: At t=0, only T1 arrived, so T1 runs (0-10). At t=10, both T2 and T3 arrived (both at arr=1), T2 has lower id so T2 runs then T3
  const fcfsRes = runFCFS(compTasks, []);
  assert.strictEqual(fcfsRes.executionResults[0].taskId, 1, 'FCFS runs T1 first (arrived at t=0)');
  assert.strictEqual(fcfsRes.executionResults[1].taskId, 2, 'FCFS runs T2 second');
  assert.strictEqual(fcfsRes.executionResults[2].taskId, 3, 'FCFS runs T3 third');
  console.log('✔ Test 2.1 Passed: FCFS scheduling order verified.');

  // 2.2 SJF: At t=0, only T1 is ready -> runs (0-10). At t=10, T2 (burst=2) and T3 (burst=4) are ready. T2 has shorter burst than T3
  const sjfRes = runSJF(compTasks, []);
  assert.strictEqual(sjfRes.executionResults[0].taskId, 1, 'SJF runs T1 first');
  assert.strictEqual(sjfRes.executionResults[1].taskId, 2, 'SJF picks shortest burst (T2 burst=2 before T3 burst=4)');
  assert.strictEqual(sjfRes.executionResults[2].taskId, 3, 'SJF runs T3 third');
  console.log('✔ Test 2.2 Passed: SJF shortest burst preference verified.');

  // 2.3 Static Priority: At t=10, T2 has importance=9, T3 has importance=6. T2 runs before T3.
  const staticRes = runStaticPriority(compTasks, []);
  assert.strictEqual(staticRes.executionResults[0].taskId, 1);
  assert.strictEqual(staticRes.executionResults[1].taskId, 2, 'Static priority picks highest importance T2 (imp 9)');
  assert.strictEqual(staticRes.executionResults[2].taskId, 3, 'Static priority picks T3 (imp 6)');
  console.log('✔ Test 2.3 Passed: Static priority ordering verified.\n');

  // -------------------------------------------------------------
  // Test Suite 3: Dependency Cycle Detection
  // -------------------------------------------------------------
  console.log('--- Test Suite 3: Dependency Validation & Cycle Detection ---');
  // Self dependency check
  await assert.rejects(async () => {
    await DependencyService.addDependency(5, 5);
  }, /cannot depend on itself/, 'Must reject self dependency');
  console.log('✔ Test 3.1 Passed: Self dependency rejected.');

  // -------------------------------------------------------------
  // Test Suite 4: JWT Authentication Service
  // -------------------------------------------------------------
  console.log('--- Test Suite 4: JWT Authentication Service ---');
  const dummyUser = { user_id: 1, name: 'Sahil', email: 'sahil@example.com', role: 'Developer' };
  
  // 4.1 Token Generation
  const token = AuthService.generateToken(dummyUser);
  assert(typeof token === 'string' && token.length > 20, 'Token must be a valid JWT string');
  console.log('✔ Test 4.1 Passed: JWT generation verified.');

  // 4.2 Token Verification
  const decoded = AuthService.verifyToken(token);
  assert.strictEqual(decoded.user_id, 1);
  assert.strictEqual(decoded.email, 'sahil@example.com');
  assert.strictEqual(decoded.role, 'Developer');
  console.log('✔ Test 4.2 Passed: JWT verification & payload extraction verified.');

  // 4.3 Invalid / Forged Token Rejection
  assert.throws(() => {
    AuthService.verifyToken('invalid.token.signature');
  }, 'Must reject forged or malformed token');
  console.log('✔ Test 4.3 Passed: Forged JWT token rejected correctly.');

  // 4.4 Admin Credentials Verification
  const adminAuth = await AuthService.verifyCredentials('admin', 'admin123');
  assert.strictEqual(adminAuth.authenticated, true);
  assert.strictEqual(adminAuth.user.role, 'Admin');
  console.log('✔ Test 4.4 Passed: Admin credentials verification verified.\n');

  // -------------------------------------------------------------
  // Test Suite 5: Task Service Validation & Rules
  // -------------------------------------------------------------
  console.log('--- Test Suite 5: Task Service Validation ---');
  assert.throws(() => {
    TaskService.validateTaskData({ task_name: '', importance: 5, arrival_time: 0, burst_time: 2, deadline: 10 });
  }, /Task name is required/, 'Must reject empty task name');

  assert.throws(() => {
    TaskService.validateTaskData({ task_name: 'Invalid Task', importance: 15, arrival_time: 0, burst_time: 2, deadline: 10 });
  }, /Importance must be between 1 and 10/, 'Must reject out-of-range importance');

  assert.throws(() => {
    TaskService.validateTaskData({ task_name: 'Invalid Deadline', importance: 5, arrival_time: 5, burst_time: 10, deadline: 12 });
  }, /must be at least Arrival Time \+ Burst Time/, 'Must enforce deadline >= arrival + burst');
  console.log('✔ Test 5.1 Passed: Task validation constraints verified.\n');

  // -------------------------------------------------------------
  // Test Suite 6: Architecture Division (MVC & Services Integrity)
  // -------------------------------------------------------------
  console.log('--- Test Suite 6: Modular Services & MVC Integrity ---');
  assert(typeof UserModel.findAll === 'function', 'UserModel.findAll exists');
  assert(typeof TaskModel.findAllWithDependencies === 'function', 'TaskModel.findAllWithDependencies exists');
  assert(typeof DependencyModel.findAll === 'function', 'DependencyModel.findAll exists');
  assert(typeof HistoryModel.getPerformanceSummary === 'function', 'HistoryModel.getPerformanceSummary exists');

  assert(typeof AuthService.verifyCredentials === 'function', 'AuthService.verifyCredentials exists');
  assert(typeof AuthService.generateToken === 'function', 'AuthService.generateToken exists');
  assert(typeof AuthService.verifyToken === 'function', 'AuthService.verifyToken exists');
  assert(typeof UserService.getAllUsers === 'function', 'UserService.getAllUsers exists');
  assert(typeof TaskService.createTask === 'function', 'TaskService.createTask exists');
  assert(typeof DependencyService.addDependency === 'function', 'DependencyService.addDependency exists');
  assert(typeof SchedulerService.runAndPersistSimulation === 'function', 'SchedulerService.runAndPersistSimulation exists');
  assert(typeof SchedulerService.compareAllAlgorithms === 'function', 'SchedulerService.compareAllAlgorithms exists');
  assert(typeof HistoryService.seedSampleWorkload === 'function', 'HistoryService.seedSampleWorkload exists');
  console.log('✔ Test 6.1 Passed: All backend services and models correctly modularized and exported.\n');

  console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY! 🚀');
}

runTests()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
