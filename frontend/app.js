// DynaSched Frontend Client Controller
// Manages UI rendering, simulation execution, Comparative Analysis & JWT Authentication

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

let tasksData = [];
let usersData = [];
let currentUser = null;
let editingTaskId = null;
let lastComparisonData = null;

// JWT token storage
let jwtToken = localStorage.getItem('dynasched_jwt_token') || null;

// Algorithm selector
let selectedAlgorithm = 'dynamic';

// DOM Elements - Auth
const authBadge = document.getElementById('authBadge');
const userRoleBadge = document.getElementById('userRoleBadge');
const userNameLabel = document.getElementById('userNameLabel');
const btnAuthToggle = document.getElementById('btnAuthToggle');
const loginModal = document.getElementById('loginModal');
const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
const btnCancelLogin = document.getElementById('btnCancelLogin');
const loginForm = document.getElementById('loginForm');
const authUsernameInput = document.getElementById('authUsername');
const authPasswordInput = document.getElementById('authPassword');
const loginErrorBanner = document.getElementById('loginError');

// DOM Elements - Tables & Badges
const tasksTableBody = document.getElementById('tasksTableBody');
const resultsTableBody = document.getElementById('resultsTableBody');
const schedulingLogEl = document.getElementById('schedulingLog');
const ganttChartEl = document.getElementById('ganttChart');
const ganttTimeAxisEl = document.getElementById('ganttTimeAxis');
const ganttStatusBadge = document.getElementById('ganttStatusBadge');
const taskCountBadge = document.getElementById('taskCountBadge');
const decisionsCountBadge = document.getElementById('decisionsCount');
const taskSearchInput = document.getElementById('taskSearchInput');

// DOM Elements - KPIs
const kpiAvgWait = document.getElementById('kpiAvgWait');
const kpiAvgTurnaround = document.getElementById('kpiAvgTurnaround');
const kpiCpuUtil = document.getElementById('kpiCpuUtil');
const kpiMakespan = document.getElementById('kpiMakespan');
const kpiDeadlines = document.getElementById('kpiDeadlines');
const kpiDeadlineRatio = document.getElementById('kpiDeadlineRatio');

// DOM Elements - Weights
const toggleWeightsBtn = document.getElementById('toggleWeightsBtn');
const weightsDrawer = document.getElementById('weightsDrawer');
const weightImportance = document.getElementById('weightImportance');
const weightAging = document.getElementById('weightAging');
const weightUrgency = document.getElementById('weightUrgency');
const weightBurst = document.getElementById('weightBurst');
const valWI = document.getElementById('valWI');
const valWA = document.getElementById('valWA');
const valWU = document.getElementById('valWU');
const valWB = document.getElementById('valWB');

// DOM Elements - Add/Edit Task Modal
const addTaskModal = document.getElementById('addTaskModal');
const btnOpenAddTask = document.getElementById('btnOpenAddTask');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const addTaskForm = document.getElementById('addTaskForm');
const assignedUserSelect = document.getElementById('assignedUser');
const dependenciesSelect = document.getElementById('dependencies');
const modalTaskTitle = document.getElementById('modalTaskTitle');

// DOM Elements - Action Buttons
const btnRunSim = document.getElementById('btnRunSim');
const btnSeed = document.getElementById('btnSeed');
const btnReset = document.getElementById('btnReset');
const btnCompare = document.getElementById('btnCompare');
const btnExportReport = document.getElementById('btnExportReport');
const algoSelector = document.getElementById('algoSelector');
const toastNotification = document.getElementById('toastNotification');

// ---------------------------------------------------------------------------
// HTTP API HELPER WITH JWT AUTH
// ---------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    jwtToken = null;
    localStorage.removeItem('dynasched_jwt_token');
    openLoginModal('Session expired. Please sign in again.');
    throw new Error('Unauthorized (401)');
  }

  return response;
}

// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initAuth();
});

function setupEventListeners() {
  btnRunSim.addEventListener('click', runSimulation);
  btnSeed.addEventListener('click', seedSampleWorkload);
  btnReset.addEventListener('click', resetSimulation);
  btnCompare.addEventListener('click', runComparison);

  if (btnExportReport) {
    btnExportReport.addEventListener('click', exportComparativeReport);
  }

  // Algorithm selector
  const algoDescriptions = {
    dynamic: 'Dynamic Priority with Aging (Non-Preemptive)',
    fcfs: 'First-Come, First-Served (FCFS)',
    sjf: 'Shortest Job First (SJF)',
    staticPriority: 'Static Priority Scheduling'
  };

  algoSelector.addEventListener('change', (e) => {
    selectedAlgorithm = e.target.value;
    const labelEl = document.getElementById('currentAlgoLabel');
    if (labelEl) labelEl.textContent = algoDescriptions[selectedAlgorithm] || selectedAlgorithm;
  });

  // Search filter
  if (taskSearchInput) {
    taskSearchInput.addEventListener('input', () => {
      renderTasksTable();
    });
  }

  // Weights slider listeners
  toggleWeightsBtn.addEventListener('click', () => {
    weightsDrawer.classList.toggle('hidden');
  });

  weightImportance.addEventListener('input', (e) => valWI.textContent = parseFloat(e.target.value).toFixed(1));
  weightAging.addEventListener('input', (e) => valWA.textContent = parseFloat(e.target.value).toFixed(1));
  weightUrgency.addEventListener('input', (e) => valWU.textContent = parseFloat(e.target.value).toFixed(1));
  weightBurst.addEventListener('input', (e) => valWB.textContent = parseFloat(e.target.value).toFixed(1));

  // Add/Edit Task Modal handlers
  btnOpenAddTask.addEventListener('click', openAddTaskModal);
  btnCloseModal.addEventListener('click', closeAddTaskModal);
  btnCancelModal.addEventListener('click', closeAddTaskModal);
  addTaskForm.addEventListener('submit', handleAddTaskSubmit);

  const btnMagicFill = document.getElementById('btnMagicFill');
  if (btnMagicFill) {
    btnMagicFill.addEventListener('click', magicFillModal);
  }

  // Quick Preset Chips
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Real-time automatic deadline adjustment on Importance, Burst, or Arrival change
  const impInput = document.getElementById('importance');
  const burstInput = document.getElementById('burstTime');
  const arrInput = document.getElementById('arrivalTime');
  if (impInput) impInput.addEventListener('input', () => autoAdjustDeadline());
  if (burstInput) burstInput.addEventListener('input', () => autoAdjustDeadline());
  if (arrInput) arrInput.addEventListener('input', () => autoAdjustDeadline());

  // Auth Handlers
  btnAuthToggle.addEventListener('click', () => {
    if (currentUser) {
      logout();
    } else {
      openLoginModal();
    }
  });
  btnCloseLoginModal.addEventListener('click', closeLoginModal);
  btnCancelLogin.addEventListener('click', closeLoginModal);
  loginForm.addEventListener('submit', handleLoginSubmit);
}

// ---------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// ---------------------------------------------------------------------------
function showToast(message, duration = 3000) {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.classList.remove('hidden');
  setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, duration);
}

// ---------------------------------------------------------------------------
// AUTHENTICATION LOGIC (JWT)
// ---------------------------------------------------------------------------
async function initAuth() {
  if (!jwtToken) {
    updateAuthUI(null);
    openLoginModal();
    return;
  }

  try {
    const res = await apiFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateAuthUI(currentUser);
      await loadInitialData();
    } else {
      openLoginModal();
    }
  } catch (err) {
    console.warn('Initial auth check failed:', err.message);
    updateAuthUI(null);
  }
}

function updateAuthUI(user) {
  if (user) {
    userRoleBadge.textContent = user.role || 'Member';
    userNameLabel.textContent = user.name || user.email;
    btnAuthToggle.textContent = 'Logout';
  } else {
    userRoleBadge.textContent = 'Guest';
    userNameLabel.textContent = 'Not signed in';
    btnAuthToggle.textContent = 'Login';
  }
}

function openLoginModal(errorMessage = '') {
  if (errorMessage) {
    loginErrorBanner.textContent = errorMessage;
    loginErrorBanner.classList.remove('hidden');
  } else {
    loginErrorBanner.classList.add('hidden');
  }
  loginModal.classList.remove('hidden');
}

function closeLoginModal() {
  loginModal.classList.add('hidden');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      loginErrorBanner.textContent = data.error || 'Authentication failed.';
      loginErrorBanner.classList.remove('hidden');
      return;
    }

    jwtToken = data.token;
    localStorage.setItem('dynasched_jwt_token', jwtToken);
    currentUser = data.user;

    closeLoginModal();
    updateAuthUI(currentUser);
    showToast(`Welcome back, ${currentUser.name}!`);
    await loadInitialData();
  } catch (err) {
    loginErrorBanner.textContent = 'Network error: ' + err.message;
    loginErrorBanner.classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('dynasched_jwt_token');
  jwtToken = null;
  currentUser = null;
  updateAuthUI(null);
  showToast('Logged out successfully.');
  openLoginModal('You have been logged out.');
}

async function loadInitialData() {
  await fetchUsers();
  await fetchTasks();
}

// ---------------------------------------------------------------------------
// DATA API CALLS
// ---------------------------------------------------------------------------
async function fetchUsers() {
  try {
    const res = await apiFetch('/api/users');
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      usersData = data;
      populateUserSelect();
    } else {
      console.warn('Could not load users list:', data.error || data);
      usersData = [];
    }
  } catch (err) {
    console.error('Failed to load users:', err);
    usersData = [];
  }
}

async function fetchTasks() {
  try {
    const res = await apiFetch('/api/tasks');
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      tasksData = data;
      renderTasksTable();
      populateDependenciesSelect();
    } else {
      console.error('Failed to load tasks:', data.error || data);
      tasksData = [];
      const errorMsg = data.error || 'Server error 500';
      tasksTableBody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 24px;">
        ⚠️ <strong>Database Error:</strong> ${escapeHtml(errorMsg)}<br>
        <span style="font-size: 12px; color: var(--text-dim);">Please verify that PostgreSQL is running and credentials in <code>.env</code> are correct.</span>
      </td></tr>`;
    }
  } catch (err) {
    console.error('Failed to load tasks:', err);
    tasksData = [];
  }
}

async function runSimulation() {
  btnRunSim.disabled = true;
  btnRunSim.textContent = 'Simulating...';

  const weights = {
    w_importance: parseFloat(weightImportance.value),
    w_aging: parseFloat(weightAging.value),
    w_urgency: parseFloat(weightUrgency.value),
    w_burst: parseFloat(weightBurst.value)
  };

  try {
    const res = await apiFetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights, algorithm: selectedAlgorithm })
    });
    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Failed to run simulation');
      return;
    }

    const { ganttChart, executionResults, schedulingLog, summaryMetrics } = result.data;
    renderKPIs(summaryMetrics);
    renderGanttChart(ganttChart, summaryMetrics.totalMakespan);
    renderSchedulingLog(schedulingLog);
    renderResultsTable(executionResults);

    await fetchTasks();
    ganttStatusBadge.textContent = `Completed (${selectedAlgorithm})`;
    ganttStatusBadge.style.color = '#34d399';
    showToast(`Simulation completed using ${selectedAlgorithm}!`);
  } catch (err) {
    alert('Simulation error: ' + err.message);
  } finally {
    btnRunSim.disabled = false;
    btnRunSim.textContent = '▶ Run Scheduler';
  }
}

async function runComparison() {
  btnCompare.disabled = true;
  btnCompare.textContent = '⏳ Benchmarking...';

  const weights = {
    w_importance: parseFloat(weightImportance.value),
    w_aging: parseFloat(weightAging.value),
    w_urgency: parseFloat(weightUrgency.value),
    w_burst: parseFloat(weightBurst.value)
  };

  try {
    const res = await apiFetch('/api/simulate/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weights })
    });
    const result = await res.json();

    if (!res.ok) {
      alert(result.error || 'Failed to run comparison');
      return;
    }

    lastComparisonData = result.data || result;
    renderComparisonSection(lastComparisonData);
    showToast('Comparative benchmark analysis generated!');
  } catch (err) {
    alert('Comparison error: ' + err.message);
  } finally {
    btnCompare.disabled = false;
    btnCompare.textContent = '⚖ Compare All 4 Algorithms';
  }
}

async function resetSimulation() {
  try {
    const res = await apiFetch('/api/reset', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      await fetchTasks();
      resetUI();
      showToast('Queue & simulation history reset.');
    } else {
      alert('Reset failed: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Reset failed: ' + err.message);
  }
}

async function seedSampleWorkload() {
  btnSeed.disabled = true;
  btnSeed.textContent = 'Seeding...';
  try {
    const res = await apiFetch('/api/seed', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      await fetchTasks();
      resetUI();
      await runSimulation();
      showToast('Demo workload seeded successfully!');
    } else {
      alert('Seeding failed: ' + (data.error || 'Server error'));
    }
  } catch (err) {
    alert('Seeding failed: ' + err.message);
  } finally {
    btnSeed.disabled = false;
    btnSeed.textContent = '🌱 Load Demo Workload';
  }
}

async function deleteTask(taskId) {
  if (!confirm(`Are you sure you want to delete Task ID ${taskId}?`)) return;
  try {
    const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchTasks();
      showToast(`Task T${taskId} deleted.`);
    }
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

async function editTask(taskId) {
  const task = tasksData.find(t => t.task_id === taskId);
  if (!task) return;

  editingTaskId = taskId;
  if (modalTaskTitle) modalTaskTitle.textContent = `Edit Task T${taskId}`;

  document.getElementById('taskName').value = task.task_name || '';
  document.getElementById('importance').value = task.importance || 5;
  document.getElementById('arrivalTime').value = task.arrival_time ?? 0;
  document.getElementById('burstTime').value = task.burst_time || 4;
  document.getElementById('deadline').value = task.deadline || 20;

  populateUserSelect();
  if (task.user_id) {
    assignedUserSelect.value = task.user_id;
  }

  populateDependenciesSelect();
  if (task.dependencies && task.dependencies.length > 0) {
    const depIds = task.dependencies.map(d => String(d.depends_on_task_id));
    Array.from(dependenciesSelect.options).forEach(opt => {
      opt.selected = depIds.includes(opt.value);
    });
  }

  addTaskModal.classList.remove('hidden');
}

async function handleAddTaskSubmit(e) {
  e.preventDefault();

  const task_name = document.getElementById('taskName').value.trim();
  const importance = parseInt(document.getElementById('importance').value, 10);
  const arrival_time = parseInt(document.getElementById('arrivalTime').value, 10);
  const burst_time = parseInt(document.getElementById('burstTime').value, 10);
  const deadline = parseInt(document.getElementById('deadline').value, 10);
  const user_id = assignedUserSelect.value ? parseInt(assignedUserSelect.value, 10) : null;

  const selectedOptions = Array.from(dependenciesSelect.selectedOptions);
  const dependencies = selectedOptions.map(opt => parseInt(opt.value, 10));

  const payload = { task_name, importance, arrival_time, burst_time, deadline, user_id, dependencies };

  try {
    let res;
    if (editingTaskId !== null) {
      res = await apiFetch(`/api/tasks/${editingTaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to save task.');
      return;
    }

    closeAddTaskModal();
    addTaskForm.reset();
    await fetchTasks();
    showToast(editingTaskId ? 'Task updated successfully!' : 'New task created successfully!');
  } catch (err) {
    alert('Error saving task: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// RENDERING FUNCTIONS
// ---------------------------------------------------------------------------
function renderTasksTable() {
  const query = taskSearchInput ? taskSearchInput.value.toLowerCase().trim() : '';
  const filteredTasks = query
    ? tasksData.filter(t =>
      t.task_name.toLowerCase().includes(query) ||
      String(t.task_id).includes(query) ||
      t.status.toLowerCase().includes(query) ||
      (t.user_name && t.user_name.toLowerCase().includes(query))
    )
    : tasksData;

  taskCountBadge.textContent = `${filteredTasks.length} / ${tasksData.length} Tasks`;

  if (filteredTasks.length === 0) {
    tasksTableBody.innerHTML = `<tr><td colspan="9" class="text-center empty-state">
      ${query ? 'No tasks match search query.' : 'No tasks available. Click "🌱 Load Demo Workload" or "+ Add Task".'}
    </td></tr>`;
    return;
  }

  tasksTableBody.innerHTML = filteredTasks.map(t => {
    let impClass = 'imp-low';
    if (t.importance >= 8) impClass = 'imp-high';
    else if (t.importance >= 5) impClass = 'imp-med';

    const statusClass = `status-${t.status.toLowerCase()}`;

    const depsHtml = t.dependencies && t.dependencies.length > 0
      ? t.dependencies.map(d => `<span class="dep-tag" title="Depends on: ${d.depends_on_task_name}">T${d.depends_on_task_id}</span>`).join('')
      : '<span style="color: var(--text-dim);">-</span>';

    return `
      <tr>
        <td><strong>T${t.task_id}</strong></td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(t.task_name)}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${t.user_name ? 'Assigned: ' + escapeHtml(t.user_name) : 'Unassigned'}</div>
        </td>
        <td><span class="imp-badge ${impClass}">${t.importance} / 10</span></td>
        <td><code>t=${t.arrival_time}</code></td>
        <td><code>${t.burst_time}u</code></td>
        <td><code>t=${t.deadline}</code></td>
        <td>${depsHtml}</td>
        <td><span class="status-pill ${statusClass}">${t.status}</span></td>
        <td>
          <button class="btn-edit-sm" onclick="editTask(${t.task_id})">Edit</button>
          <button class="btn-danger-sm" onclick="deleteTask(${t.task_id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderKPIs(metrics) {
  kpiAvgWait.textContent = `${metrics.avgWaitingTime} ms`;
  kpiAvgTurnaround.textContent = `${metrics.avgTurnaroundTime} ms`;
  kpiCpuUtil.textContent = `${metrics.cpuUtilizationPct}%`;
  kpiMakespan.textContent = `Makespan: ${metrics.totalMakespan}u (Busy: ${metrics.totalBusyTime}u)`;

  const deadlineMetPct = metrics.totalTasks > 0
    ? Math.round((metrics.deadlinesMet / metrics.totalTasks) * 100)
    : 100;

  kpiDeadlines.textContent = `${metrics.deadlinesMet} / ${metrics.totalTasks}`;
  kpiDeadlineRatio.textContent = `${metrics.deadlineMisses} Misses (${deadlineMetPct}% Success Rate)`;
}

function renderGanttChart(ganttItems, totalMakespan) {
  if (!ganttItems || ganttItems.length === 0 || totalMakespan === 0) {
    ganttChartEl.innerHTML = `<div class="empty-state">No execution data to display.</div>`;
    ganttTimeAxisEl.innerHTML = '';
    return;
  }

  ganttChartEl.innerHTML = '';
  ganttTimeAxisEl.innerHTML = '';

  ganttItems.forEach((item) => {
    const duration = item.end - item.start;
    const widthPct = (duration / totalMakespan) * 100;

    const block = document.createElement('div');
    block.className = `gantt-block ${item.isIdle ? 'idle' : ''}`;
    block.style.width = `${widthPct}%`;

    if (!item.isIdle) {
      const color = COLORS[(item.taskId - 1) % COLORS.length] || '#3b82f6';
      block.style.backgroundColor = color;
      block.innerHTML = `
        <span class="gantt-block-title">T${item.taskId}: ${escapeHtml(item.taskName)}</span>
        <span class="gantt-block-time">[${item.start} → ${item.end}]</span>
      `;
      block.title = `Task ${item.taskId}: ${item.taskName}\nStart: t=${item.start}, End: t=${item.end}\nDuration: ${duration} units`;
    } else {
      block.innerHTML = `
        <span class="gantt-block-title">CPU IDLE</span>
        <span class="gantt-block-time">[${item.start} → ${item.end}]</span>
      `;
      block.title = `CPU Idle period from t=${item.start} to t=${item.end} (${duration} units)`;
    }

    ganttChartEl.appendChild(block);
  });

  const tickStep = totalMakespan <= 20 ? 2 : Math.ceil(totalMakespan / 10);
  for (let t = 0; t <= totalMakespan; t += tickStep) {
    const posPct = (t / totalMakespan) * 100;
    const tick = document.createElement('div');
    tick.className = 'gantt-tick';
    tick.style.left = `${posPct}%`;
    tick.textContent = t;
    ganttTimeAxisEl.appendChild(tick);
  }
}

function renderSchedulingLog(logEntries) {
  decisionsCountBadge.textContent = `${logEntries.length} Decisions`;

  if (!logEntries || logEntries.length === 0) {
    schedulingLogEl.innerHTML = `<div class="empty-state">No decisions logged yet.</div>`;
    return;
  }

  schedulingLogEl.innerHTML = logEntries.map(log => `
    <div class="log-item">
      <div class="log-item-header">
        <span class="log-time">t = ${log.simulatedTime}</span>
        <span class="log-task">T${log.selectedTaskId}: "${escapeHtml(log.selectedTaskName)}"</span>
        <span class="log-score">Score: ${log.priorityScore}</span>
      </div>
      <div class="log-reason">${escapeHtml(log.decisionReason)}</div>
    </div>
  `).join('');
}

function renderResultsTable(results) {
  if (!results || results.length === 0) {
    resultsTableBody.innerHTML = `<tr><td colspan="10" class="text-center empty-state">No simulation results available.</td></tr>`;
    return;
  }

  resultsTableBody.innerHTML = results.map(r => `
    <tr>
      <td><strong>T${r.taskId}:</strong> ${escapeHtml(r.taskName)}</td>
      <td><code>${r.arrivalTime}</code></td>
      <td><code>${r.burstTime}</code></td>
      <td><code>${r.deadline}</code></td>
      <td><code>${r.startTime}</code></td>
      <td><code>${r.completionTime}</code></td>
      <td><span style="color: #60a5fa; font-weight: 700;">${r.waitingTime}</span></td>
      <td><code>${r.turnaroundTime}</code></td>
      <td><code>${r.responseTime}</code></td>
      <td>
        ${r.deadlineMet
      ? '<span class="status-pill status-completed">✓ Met</span>'
      : '<span class="status-pill status-blocked">✗ Missed</span>'}
      </td>
    </tr>
  `).join('');
}

// ---------------------------------------------------------------------------
// COMPREHENSIVE COMPARATIVE ANALYSIS RENDERING
// ---------------------------------------------------------------------------
function renderComparisonSection(data) {
  const comparisonSection = document.getElementById('comparisonSection');
  const compPodiumGrid = document.getElementById('compPodiumGrid');
  const comparisonTableBody = document.getElementById('comparisonTableBody');
  const stackedGanttContainer = document.getElementById('stackedGanttContainer');
  const insightsContent = document.getElementById('insightsContent');

  const algoKeys = ['dynamic', 'fcfs', 'sjf', 'staticPriority'];
  const algoLabels = {
    dynamic: 'Dynamic Priority (Aging)',
    fcfs: 'First-Come, First-Served',
    sjf: 'Shortest Job First',
    staticPriority: 'Static Priority'
  };

  const defaultStarvationRisk = {
    dynamic: '<span class="status-pill status-completed">None (Aging Active)</span>',
    fcfs: '<span class="status-pill status-ready">None (Queue Order)</span>',
    sjf: '<span class="status-pill status-blocked">High (Long Jobs Starve)</span>',
    staticPriority: '<span class="status-pill status-blocked">Severe (Low Importance Starves)</span>'
  };

  // 1. Compile Rows
  const rows = algoKeys.map(key => {
    const algoData = data[key] || {};
    const m = algoData.summaryMetrics || {};
    return {
      key,
      label: algoLabels[key],
      gantt: algoData.ganttChart || [],
      avgWait: typeof m.avgWaitingTime === 'number' ? m.avgWaitingTime : '-',
      avgTurnaround: typeof m.avgTurnaroundTime === 'number' ? m.avgTurnaroundTime : '-',
      avgResponse: typeof m.avgResponseTime === 'number' ? m.avgResponseTime : '-',
      cpuUtil: typeof m.cpuUtilizationPct === 'number' ? m.cpuUtilizationPct : '-',
      deadlinesMet: typeof m.deadlinesMet === 'number' ? m.deadlinesMet : '-',
      deadlineMisses: typeof m.deadlineMisses === 'number' ? m.deadlineMisses : '-',
      maxWait: typeof m.maxWaitingTime === 'number' ? m.maxWaitingTime : '-',
      totalMakespan: m.totalMakespan || 0,
      starvationRisk: defaultStarvationRisk[key]
    };
  });

  // Calculate Bests
  const minWaitRow = [...rows].filter(r => r.avgWait !== '-').sort((a, b) => a.avgWait - b.avgWait)[0];
  const minTATRow = [...rows].filter(r => r.avgTurnaround !== '-').sort((a, b) => a.avgTurnaround - b.avgTurnaround)[0];
  const minMissesRow = [...rows].filter(r => r.deadlineMisses !== '-').sort((a, b) => a.deadlineMisses - b.deadlineMisses)[0];
  const maxWaitRow = [...rows].filter(r => r.maxWait !== '-').sort((a, b) => b.maxWait - a.maxWait)[0];

  // Assign Ranking (Composite Score based on wait + turnaround + misses)
  rows.forEach(r => {
    let score = 0;
    if (r.avgWait !== '-') score += r.avgWait * 1.5;
    if (r.avgTurnaround !== '-') score += r.avgTurnaround;
    if (r.deadlineMisses !== '-') score += r.deadlineMisses * 10;
    r.compositeScore = score;
  });
  const rankedRows = [...rows].sort((a, b) => a.compositeScore - b.compositeScore);
  const rankMap = new Map();
  rankedRows.forEach((r, idx) => rankMap.set(r.key, idx + 1));

  // 2. Render Winner Podium Grid
  compPodiumGrid.innerHTML = `
    <div class="podium-card winner">
      <span class="podium-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">🏆 Lowest Wait Time</span>
      <div class="podium-icon">⏱️</div>
      <div class="podium-title">Avg Waiting Time Winner</div>
      <div class="podium-algo">${minWaitRow ? minWaitRow.label : 'N/A'}</div>
      <div class="podium-stat">${minWaitRow ? minWaitRow.avgWait + ' ms' : '-'}</div>
      <div class="podium-desc">Minimizes ready-queue delay across the task set.</div>
    </div>

    <div class="podium-card">
      <span class="podium-badge" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd;">⚡ Best Turnaround</span>
      <div class="podium-icon">🚀</div>
      <div class="podium-title">Turnaround Efficiency</div>
      <div class="podium-algo">${minTATRow ? minTATRow.label : 'N/A'}</div>
      <div class="podium-stat">${minTATRow ? minTATRow.avgTurnaround + ' ms' : '-'}</div>
      <div class="podium-desc">Shortest average time from arrival to completion.</div>
    </div>

    <div class="podium-card winner">
      <span class="podium-badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">🛡️ Starvation Champion</span>
      <div class="podium-icon">🛡️</div>
      <div class="podium-title">Starvation Prevention</div>
      <div class="podium-algo">Dynamic Priority + Aging</div>
      <div class="podium-stat">Aging Weight: ${weightAging.value}</div>
      <div class="podium-desc">Dynamically elevates waiting low-priority tasks to guarantee execution.</div>
    </div>

    <div class="podium-card">
      <span class="podium-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24;">🎯 Deadline Success</span>
      <div class="podium-icon">🎯</div>
      <div class="podium-title">Lowest Deadline Misses</div>
      <div class="podium-algo">${minMissesRow ? minMissesRow.label : 'N/A'}</div>
      <div class="podium-stat">${minMissesRow ? minMissesRow.deadlineMisses + ' missed' : '-'}</div>
      <div class="podium-desc">Meets tight delivery windows by factoring slack time.</div>
    </div>
  `;

  // 3. Render Visual Metric Meters (Bar Charts)
  renderVisualMeters('meterWaitTime', rows, 'avgWait', 'ms', 'min');
  renderVisualMeters('meterTurnaround', rows, 'avgTurnaround', 'ms', 'min');
  renderVisualMeters('meterMaxWait', rows, 'maxWait', 'ms', 'min');

  // 4. Render Multi-Algorithm Stacked Gantt Timelines
  const maxMakespan = Math.max(...rows.map(r => r.totalMakespan || 1));
  stackedGanttContainer.innerHTML = rows.map(r => {
    const blocksHtml = r.gantt.map(item => {
      const dur = item.end - item.start;
      const wPct = (dur / maxMakespan) * 100;
      if (item.isIdle) {
        return `<div class="gantt-block idle" style="width: ${wPct}%;" title="CPU Idle: t=${item.start}→${item.end}">IDLE</div>`;
      }
      const color = COLORS[(item.taskId - 1) % COLORS.length] || '#3b82f6';
      return `<div class="gantt-block" style="width: ${wPct}%; background-color: ${color};" title="T${item.taskId}: ${item.taskName} [${item.start}→${item.end}]">T${item.taskId}</div>`;
    }).join('');

    return `
      <div class="stacked-row">
        <div class="stacked-label">${r.label}</div>
        <div class="stacked-track">${blocksHtml}</div>
      </div>
    `;
  }).join('');

  // 5. Render Comparison Matrix Table
  const numCols = ['avgWait', 'avgTurnaround', 'avgResponse', 'maxWait'];
  const bests = {};
  numCols.forEach(col => {
    const vals = rows.map(r => r[col]).filter(v => v !== '-' && !isNaN(Number(v))).map(Number);
    bests[col] = vals.length > 0 ? Math.min(...vals) : null;
  });

  comparisonTableBody.innerHTML = rows.map(r => {
    const rank = rankMap.get(r.key) || 1;
    const rankClass = `rank-${rank}`;
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '4';

    function cellCls(col, val) {
      if (val === '-' || isNaN(Number(val))) return '';
      return bests[col] !== null && Number(val) === bests[col] ? 'algo-best' : '';
    }

    return `
      <tr>
        <td><span class="rank-badge ${rankClass}">${rankIcon}</span></td>
        <td><strong>${r.label}</strong></td>
        <td class="${cellCls('avgWait', r.avgWait)}">${r.avgWait}</td>
        <td class="${cellCls('avgTurnaround', r.avgTurnaround)}">${r.avgTurnaround}</td>
        <td class="${cellCls('avgResponse', r.avgResponse)}">${r.avgResponse}</td>
        <td>${r.cpuUtil !== '-' ? r.cpuUtil + '%' : '-'}</td>
        <td><span class="status-pill status-completed">${r.deadlinesMet} Met</span></td>
        <td><span class="status-pill ${r.deadlineMisses > 0 ? 'status-blocked' : 'status-completed'}">${r.deadlineMisses} Misses</span></td>
        <td class="${cellCls('maxWait', r.maxWait)}">${r.maxWait}</td>
        <td>${r.starvationRisk}</td>
      </tr>
    `;
  }).join('');

  // 6. Generate Dynamic Algorithmic Insights
  const dynamicRow = rows.find(r => r.key === 'dynamic');
  const staticRow = rows.find(r => r.key === 'staticPriority');
  const sjfRow = rows.find(r => r.key === 'sjf');
  const fcfsRow = rows.find(r => r.key === 'fcfs');

  let starvationProofText = '';
  if (staticRow && dynamicRow && staticRow.maxWait !== '-' && dynamicRow.maxWait !== '-') {
    if (staticRow.maxWait > dynamicRow.maxWait) {
      const diff = staticRow.maxWait - dynamicRow.maxWait;
      starvationProofText = `Under Static Priority, low-importance tasks suffered a maximum wait of <strong>${staticRow.maxWait} ms</strong>. Dynamic Priority with Aging reduced maximum wait time to <strong>${dynamicRow.maxWait} ms</strong> (a relief of ${diff} ms), successfully preventing starvation.`;
    } else {
      starvationProofText = `Dynamic Priority with Aging balanced task importance with waiting time, ensuring consistent execution without starving lower-importance tasks.`;
    }
  }

  insightsContent.innerHTML = `
    <div class="insight-point">
      <strong>🛡️ Aging Mechanism & Starvation:</strong> ${starvationProofText || 'Aging ensures tasks that sit idle gain priority progressively, eliminating indefinite postponement.'}
    </div>
    <div class="insight-point">
      <strong>⚡ Shortest Job First (SJF) Trade-off:</strong> SJF achieved an average waiting time of <strong>${sjfRow ? sjfRow.avgWait : '-'} ms</strong>. While optimal for batch waiting metrics, pure SJF is vulnerable to starvation when long-burst tasks are repeatedly displaced.
    </div>
    <div class="insight-point">
      <strong>⏱️ FCFS Convoy Effect:</strong> First-Come First-Served posted an average waiting time of <strong>${fcfsRow ? fcfsRow.avgWait : '-'} ms</strong>. FCFS eliminates starvation but suffers from convoy delays when long burst tasks arrive early.
    </div>
    <div class="insight-point">
      <strong>🎯 Multi-Factor Optimization:</strong> The proposed Dynamic Priority model balances 4 critical variables: importance (${weightImportance.value}), waiting aging (${weightAging.value}), deadline risk (${weightUrgency.value}), and burst penalty (${weightBurst.value}), providing robust performance in constrained real-time environments.
    </div>
  `;

  comparisonSection.style.display = 'block';
  comparisonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderVisualMeters(containerId, rows, metricKey, unit, prefer = 'min') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const validVals = rows.map(r => r[metricKey]).filter(v => v !== '-' && !isNaN(Number(v))).map(Number);
  if (validVals.length === 0) {
    container.innerHTML = '<div class="text-dim font-xs">No metrics available.</div>';
    return;
  }

  const maxVal = Math.max(...validVals, 1);
  const bestVal = prefer === 'min' ? Math.min(...validVals) : Math.max(...validVals);

  container.innerHTML = rows.map(r => {
    const val = r[metricKey];
    if (val === '-' || isNaN(Number(val))) return '';
    const num = Number(val);
    const widthPct = Math.max(12, Math.round((num / maxVal) * 100));
    const isBest = num === bestVal;
    const fillClass = isBest ? 'meter-fill-best' : num > maxVal * 0.8 ? 'meter-fill-warn' : 'meter-fill-normal';

    return `
      <div class="meter-row">
        <div class="meter-info">
          <span class="meter-algo-name">${r.label}</span>
          <span class="meter-val ${isBest ? 'text-success' : ''}">${val} ${unit}</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill ${fillClass}" style="width: ${widthPct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------------------------
// EXPORT COMPARATIVE REPORT
// ---------------------------------------------------------------------------
function exportComparativeReport() {
  if (!lastComparisonData) {
    alert('Please run "⚖ Compare All 4 Algorithms" first to generate the benchmark data.');
    return;
  }

  const dateStr = new Date().toLocaleString();
  const reportText = `
========================================================================
DYNASCHED: ALGORITHM PERFORMANCE BENCHMARK & EVALUATION REPORT
Generated: ${dateStr}
Project Team: Avengers (Nitin, Ashish Rautela, Rishi Raj Thakuri, Sahil Negi)
========================================================================

1. SUMMARY OF SCHEDULING ALGORITHMS
------------------------------------------------------------------------
- Dynamic Priority with Aging (Weights: w_I=${weightImportance.value}, w_A=${weightAging.value}, w_U=${weightUrgency.value}, w_B=${weightBurst.value})
- First-Come, First-Served (FCFS)
- Shortest Job First (SJF)
- Static Priority Scheduling

2. COMPARATIVE BENCHMARK METRICS
------------------------------------------------------------------------
${['dynamic', 'fcfs', 'sjf', 'staticPriority'].map(k => {
    const d = lastComparisonData[k] || {};
    const m = d.summaryMetrics || {};
    const names = { dynamic: 'Dynamic Priority (Aging)', fcfs: 'FCFS', sjf: 'SJF', staticPriority: 'Static Priority' };
    return `[${names[k]}]
  • Average Waiting Time   : ${m.avgWaitingTime ?? '-'} ms
  • Average Turnaround Time: ${m.avgTurnaroundTime ?? '-'} ms
  • Average Response Time  : ${m.avgResponseTime ?? '-'} ms
  • CPU Utilization        : ${m.cpuUtilizationPct ?? '-'}%
  • Deadlines Met / Misses : ${m.deadlinesMet ?? 0} Met / ${m.deadlineMisses ?? 0} Misses
  • Maximum Waiting Time   : ${m.maxWaitingTime ?? '-'} ms
  • Total Makespan         : ${m.totalMakespan ?? '-'} units`;
  }).join('\n\n')}

3. KEY OBSERVATIONS & STARVATION ANALYSIS
------------------------------------------------------------------------
- Starvation Mitigation: Dynamic Priority successfully prevents indefinite 
  postponement of low-priority tasks via its waiting-time aging accumulator.
- SJF Performance: Achieved optimal waiting time for short jobs, but risks 
  starving long-burst tasks under high queue load.
- Real-Time Slack Compliance: Urgency factor prioritizes tasks with tightening 
  deadlines to minimize delivery misses.
========================================================================
`;

  navigator.clipboard.writeText(reportText.trim()).then(() => {
    showToast('📋 Benchmark report copied to clipboard!');
  }).catch(() => {
    alert('Benchmark Report:\n\n' + reportText);
  });
}

function resetUI() {
  kpiAvgWait.textContent = '-';
  kpiAvgTurnaround.textContent = '-';
  kpiCpuUtil.textContent = '-';
  kpiMakespan.textContent = 'Makespan: -';
  kpiDeadlines.textContent = '-';
  kpiDeadlineRatio.textContent = 'Met vs Missed';

  ganttChartEl.innerHTML = `<div class="empty-state">Click "▶ Run Scheduler" or "🌱 Load Demo Workload" to view simulation timeline</div>`;
  ganttTimeAxisEl.innerHTML = '';
  ganttStatusBadge.textContent = 'Waiting for simulation run';
  ganttStatusBadge.style.color = 'var(--text-muted)';

  decisionsCountBadge.textContent = '0 Decisions';
  schedulingLogEl.innerHTML = `<div class="empty-state">No scheduling decisions recorded yet. Run simulation to inspect dynamic priority scoring and aging behavior.</div>`;

  resultsTableBody.innerHTML = `<tr><td colspan="10" class="text-center empty-state">No simulation results available.</td></tr>`;

  const comparisonSection = document.getElementById('comparisonSection');
  if (comparisonSection) comparisonSection.style.display = 'none';
}

function populateUserSelect() {
  assignedUserSelect.innerHTML = '<option value="">Select Member...</option>' +
    usersData.map(u => `<option value="${u.user_id}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`).join('');
}

function populateDependenciesSelect() {
  dependenciesSelect.innerHTML = tasksData
    .filter(t => editingTaskId === null || t.task_id !== editingTaskId)
    .map(t =>
      `<option value="${t.task_id}">T${t.task_id}: ${escapeHtml(t.task_name)} (Burst: ${t.burst_time})</option>`
    ).join('');
}

// ---------------------------------------------------------------------------
// REAL-TIME SYSTEMS (RTOS) AUTOMATIC DEADLINE CALCULATION
// Academic Reference: G. Buttazzo, "Hard Real-Time Computing Systems", Springer
// Formal Laxity Factor: alpha = 1 + (10 - Importance) / 5
// Deadline = Arrival + ceil(Burst * alpha)
// ---------------------------------------------------------------------------
function calculateRTOSDeadline(arrival, burst, importance) {
  const imp = Math.min(10, Math.max(1, parseInt(importance, 10) || 5));
  const arr = Math.max(0, parseInt(arrival, 10) || 0);
  const b = Math.max(1, parseInt(burst, 10) || 1);
  const laxityFactor = 1 + (10 - imp) / 5;
  return Math.ceil(arr + (b * laxityFactor));
}

function autoAdjustDeadline() {
  const impInput = document.getElementById('importance');
  const arrInput = document.getElementById('arrivalTime');
  const burstInput = document.getElementById('burstTime');
  const dlineInput = document.getElementById('deadline');
  const liveNote = document.getElementById('deadlineFormulaLive');

  if (!arrInput || !burstInput || !dlineInput) return;

  const arr = parseInt(arrInput.value, 10) || 0;
  const burst = parseInt(burstInput.value, 10) || 1;
  const imp = impInput ? (parseInt(impInput.value, 10) || 5) : 5;

  const autoDeadline = calculateRTOSDeadline(arr, burst, imp);
  dlineInput.value = autoDeadline;

  if (liveNote) {
    liveNote.textContent = `Formula: ${arr} + ${burst} × (1 + (10 - ${imp})/5) = ${autoDeadline}`;
  }
}

function applyPreset(presetType) {
  const presets = {
    hotfix: { name: 'Critical Production Hotfix', importance: 10, burst: 2, arrival: 0 },
    feature: { name: 'Payment Gateway Integration', importance: 7, burst: 5, arrival: 0 },
    test: { name: 'Regression Test Suite', importance: 4, burst: 3, arrival: 0 },
    cleanup: { name: 'Database Log Archiver', importance: 2, burst: 8, arrival: 0 }
  };
  const p = presets[presetType];
  if (!p) return;

  document.getElementById('taskName').value = p.name;
  document.getElementById('importance').value = p.importance;
  document.getElementById('arrivalTime').value = p.arrival;
  document.getElementById('burstTime').value = p.burst;
  autoAdjustDeadline();
}

function magicFillModal() {
  const taskNames = [
    'OAuth Token Refresh Service',
    'Redis Cache Invalidation Worker',
    'Stripe Webhook Event Consumer',
    'Elasticsearch Re-indexing Pipeline',
    'PDF Invoice Rendering Service',
    'User Session Cleanup Worker',
    'Real-time WebSocket Heartbeat',
    'CDN Static Asset Purge'
  ];

  const randomName = taskNames[Math.floor(Math.random() * taskNames.length)];
  const randomImp = Math.floor(Math.random() * 8) + 3; // 3 to 10
  const randomBurst = Math.floor(Math.random() * 6) + 2; // 2 to 7
  const randomArrival = Math.floor(Math.random() * 4); // 0 to 3

  document.getElementById('taskName').value = randomName;
  document.getElementById('importance').value = randomImp;
  document.getElementById('arrivalTime').value = randomArrival;
  document.getElementById('burstTime').value = randomBurst;

  if (usersData && usersData.length > 0) {
    const randomUser = usersData[Math.floor(Math.random() * usersData.length)];
    assignedUserSelect.value = randomUser.user_id;
  }

  autoAdjustDeadline();
  showToast('✨ Task parameters auto-filled!');
}

function openAddTaskModal() {
  editingTaskId = null;
  addTaskForm.reset();
  if (modalTaskTitle) modalTaskTitle.textContent = 'Create New Task';
  document.getElementById('importance').value = 5;
  document.getElementById('arrivalTime').value = 0;
  document.getElementById('burstTime').value = 4;
  autoAdjustDeadline();
  populateUserSelect();
  populateDependenciesSelect();
  addTaskModal.classList.remove('hidden');
}

function closeAddTaskModal() {
  editingTaskId = null;
  addTaskModal.classList.add('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
