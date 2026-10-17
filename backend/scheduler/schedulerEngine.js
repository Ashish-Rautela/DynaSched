// DynaSched: Dynamic Priority Scheduling Engine with Aging and Dependency Resolution
// Non-preemptive scheduling policy

const DEFAULT_WEIGHTS = {
  w_importance: 3.0,
  w_aging: 1.5,
  w_urgency: 2.0,
  w_burst: 0.5
};

/**
 * Calculates dynamic priority score for a ready task at the current simulated time.
 * Score = (w_importance * importance) + (w_aging * waiting_time) + (w_urgency * urgency) - (w_burst * burst_time)
 */
function calculateDynamicScore(task, currentTime, weights = DEFAULT_WEIGHTS) {
  const waitingTime = Math.max(0, currentTime - task.arrival_time);
  
  // Slack time: remaining time before deadline minus required burst time
  const slack = task.deadline - (currentTime + task.burst_time);
  // Urgency increases as slack becomes tighter or negative (at risk)
  const urgency = slack <= 0 ? 30 + Math.abs(slack) : Math.max(0, 30 - slack);
  
  const score = (weights.w_importance * task.importance) +
                (weights.w_aging * waitingTime) +
                (weights.w_urgency * urgency) -
                (weights.w_burst * task.burst_time);

  return {
    score: parseFloat(score.toFixed(2)),
    waitingTime,
    urgency: parseFloat(urgency.toFixed(2)),
    slack,
    components: {
      importanceContribution: parseFloat((weights.w_importance * task.importance).toFixed(2)),
      agingContribution: parseFloat((weights.w_aging * waitingTime).toFixed(2)),
      urgencyContribution: parseFloat((weights.w_urgency * urgency).toFixed(2)),
      burstPenalty: parseFloat((weights.w_burst * task.burst_time).toFixed(2))
    }
  };
}

/**
 * Checks if all prerequisites for a given task have been completed.
 */
function areDependenciesMet(task, completedTaskIds, dependencyMap) {
  const deps = dependencyMap.get(task.task_id) || [];
  return deps.every(depId => completedTaskIds.has(depId));
}

/**
 * Simulates non-preemptive dynamic priority scheduling for a list of tasks and dependencies.
 * @param {Array} tasks - list of task objects
 * @param {Array} dependencies - list of { task_id, depends_on_task_id }
 * @param {Object} customWeights - optional scoring weights
 * @returns {Object} { ganttChart, executionResults, schedulingLog, summaryMetrics }
 */
function runSimulation(tasks, dependencies = [], customWeights = DEFAULT_WEIGHTS) {
  if (!tasks || tasks.length === 0) {
    return {
      ganttChart: [],
      executionResults: [],
      schedulingLog: [],
      summaryMetrics: {
        totalTasks: 0,
        avgWaitingTime: 0,
        avgTurnaroundTime: 0,
        avgResponseTime: 0,
        cpuUtilizationPct: 0,
        deadlineMisses: 0,
        deadlinesMet: 0,
        totalMakespan: 0
      }
    };
  }

  // Build dependency map: task_id -> [depends_on_task_id, ...]
  const dependencyMap = new Map();
  dependencies.forEach(dep => {
    if (!dependencyMap.has(dep.task_id)) {
      dependencyMap.set(dep.task_id, []);
    }
    dependencyMap.get(dep.task_id).push(dep.depends_on_task_id);
  });

  // Clone tasks and prepare working copies
  const taskPool = tasks.map(t => ({
    ...t,
    importance: parseInt(t.importance, 10),
    arrival_time: parseInt(t.arrival_time, 10),
    burst_time: parseInt(t.burst_time, 10),
    deadline: parseInt(t.deadline, 10)
  }));

  const completedTaskIds = new Set();
  const executionResults = [];
  const schedulingLog = [];
  const ganttChart = [];

  let currentTime = 0;
  let totalBusyTime = 0;

  // Find initial minimum arrival time
  const minArrival = Math.min(...taskPool.map(t => t.arrival_time));
  currentTime = Math.max(0, minArrival);

  // Run simulation until all tasks are completed or deadlocked
  while (completedTaskIds.size < taskPool.length) {
    // 1. Identify tasks that have arrived and are not completed
    const arrivedPending = taskPool.filter(t => !completedTaskIds.has(t.task_id) && t.arrival_time <= currentTime);

    // 2. Filter tasks whose dependencies are met (READY tasks)
    const readyTasks = arrivedPending.filter(t => areDependenciesMet(t, completedTaskIds, dependencyMap));

    // If no tasks are ready at this moment
    if (readyTasks.length === 0) {
      const remaining = taskPool.filter(t => !completedTaskIds.has(t.task_id));
      const possibleFutureTasks = remaining.filter(t => t.arrival_time > currentTime);
      
      if (possibleFutureTasks.length > 0) {
        // CPU Idle period until next task arrives
        const nextArrivalTime = Math.min(...possibleFutureTasks.map(t => t.arrival_time));
        ganttChart.push({
          taskId: null,
          taskName: 'CPU Idle',
          start: currentTime,
          end: nextArrivalTime,
          isIdle: true
        });
        currentTime = nextArrivalTime;
        continue;
      } else {
        // All remaining tasks arrived but their dependencies cannot be satisfied
        throw new Error('Deadlock detected: Remaining tasks have circular or unresolvable dependencies.');
      }
    }

    // 3. Calculate dynamic priority score for each ready task
    const scoredReadyTasks = readyTasks.map(t => {
      const scoreObj = calculateDynamicScore(t, currentTime, customWeights);
      return {
        task: t,
        ...scoreObj
      };
    });

    // 4. Select task with highest priority score (tie breaker: arrival_time, then task_id)
    scoredReadyTasks.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.task.arrival_time !== b.task.arrival_time) return a.task.arrival_time - b.task.arrival_time;
      return a.task.task_id - b.task.task_id;
    });

    const chosen = scoredReadyTasks[0];
    const chosenTask = chosen.task;

    // 5. Log scheduling decision
    const candidatesSummary = scoredReadyTasks
      .map(c => `[ID:${c.task.task_id} "${c.task.task_name}" Score:${c.score} (Imp:${c.task.importance}, Wait:${c.waitingTime}, Slack:${c.slack})]`)
      .join(', ');

    schedulingLog.push({
      simulatedTime: currentTime,
      selectedTaskId: chosenTask.task_id,
      selectedTaskName: chosenTask.task_name,
      priorityScore: chosen.score,
      decisionReason: `At t=${currentTime}, selected task ID ${chosenTask.task_id} ("${chosenTask.task_name}") with highest score ${chosen.score}. Aging bonus: +${chosen.components.agingContribution}. Ready candidates: ${candidatesSummary}`
    });

    // 6. Execute task (Non-preemptive)
    const startTime = currentTime;
    const completionTime = startTime + chosenTask.burst_time;
    const waitingTime = startTime - chosenTask.arrival_time;
    const turnaroundTime = completionTime - chosenTask.arrival_time;
    const responseTime = waitingTime;
    const deadlineMet = completionTime <= chosenTask.deadline;

    ganttChart.push({
      taskId: chosenTask.task_id,
      taskName: chosenTask.task_name,
      start: startTime,
      end: completionTime,
      burstTime: chosenTask.burst_time,
      isIdle: false
    });

    executionResults.push({
      taskId: chosenTask.task_id,
      taskName: chosenTask.task_name,
      importance: chosenTask.importance,
      arrivalTime: chosenTask.arrival_time,
      burstTime: chosenTask.burst_time,
      deadline: chosenTask.deadline,
      startTime,
      completionTime,
      waitingTime,
      turnaroundTime,
      responseTime,
      deadlineMet,
      finalScore: chosen.score
    });

    totalBusyTime += chosenTask.burst_time;
    completedTaskIds.add(chosenTask.task_id);
    currentTime = completionTime;
  }

  // 7. Calculate overall performance metrics
  const n = executionResults.length;
  const totalMakespan = currentTime;
  const avgWaitingTime = parseFloat((executionResults.reduce((acc, r) => acc + r.waitingTime, 0) / n).toFixed(2));
  const avgTurnaroundTime = parseFloat((executionResults.reduce((acc, r) => acc + r.turnaroundTime, 0) / n).toFixed(2));
  const avgResponseTime = parseFloat((executionResults.reduce((acc, r) => acc + r.responseTime, 0) / n).toFixed(2));
  const deadlinesMet = executionResults.filter(r => r.deadlineMet).length;
  const deadlineMisses = n - deadlinesMet;
  const cpuUtilizationPct = totalMakespan > 0 ? parseFloat(((totalBusyTime / totalMakespan) * 100).toFixed(2)) : 0;

  return {
    ganttChart,
    executionResults,
    schedulingLog,
    summaryMetrics: {
      totalTasks: n,
      avgWaitingTime,
      avgTurnaroundTime,
      avgResponseTime,
      cpuUtilizationPct,
      deadlinesMet,
      deadlineMisses,
      totalMakespan,
      totalBusyTime
    }
  };
}

module.exports = {
  DEFAULT_WEIGHTS,
  calculateDynamicScore,
  areDependenciesMet,
  runSimulation
};
