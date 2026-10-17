// DynaSched Frontend Client Controller
// Manages UI rendering, simulation execution, and HTTP Basic Auth

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', 
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
];

let tasksData = [];
let usersData = [];
let currentUser = null;

// Auth token stored as base64 credentials (defaults to admin:admin123 if not set)
let authHeaderToken = localStorage.getItem('dynasched_basic_token') || btoa('admin:admin123');

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

// DOM Elements - Add Task Modal
const addTaskModal = document.getElementById('addTaskModal');
const btnOpenAddTask = document.getElementById('btnOpenAddTask');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const addTaskForm = document.getElementById('addTaskForm');
const assignedUserSelect = document.getElementById('assignedUser');
const dependenciesSelect = document.getElementById('dependencies');

// DOM Elements - Action Buttons
const btnRunSim = document.getElementById('btnRunSim');
const btnSeed = document.getElementById('btnSeed');
const btnReset = document.getElementById('btnReset');

// ---------------------------------------------------------------------------
// HTTP API HELPER WITH BASIC AUTH
// ---------------------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};

  // Inject HTTP Basic Auth header if token exists
  if (authHeaderToken) {
    headers['Authorization'] = `Basic ${authHeaderToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401) {
    // Basic Auth failure: open login modal
    openLoginModal('Authentication failed. Please verify your credentials.');
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

  // Weights slider listeners
  toggleWeightsBtn.addEventListener('click', () => {
    weightsDrawer.classList.toggle('hidden');
  });

  weightImportance.addEventListener('input', (e) => valWI.textContent = parseFloat(e.target.value).toFixed(1));
  weightAging.addEventListener('input', (e) => valWA.textContent = parseFloat(e.target.value).toFixed(1));
  weightUrgency.addEventListener('input', (e) => valWU.textContent = parseFloat(e.target.value).toFixed(1));
  weightBurst.addEventListener('input', (e) => valWB.textContent = parseFloat(e.target.value).toFixed(1));

  // Add Task Modal handlers
  btnOpenAddTask.addEventListener('click', openAddTaskModal);
  btnCloseModal.addEventListener('click', closeAddTaskModal);
  btnCancelModal.addEventListener('click', closeAddTaskModal);
  addTaskForm.addEventListener('submit', handleAddTaskSubmit);

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
// AUTHENTICATION LOGIC
// ---------------------------------------------------------------------------
async function initAuth() {
  if (!authHeaderToken) {
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

    // Save token and update state
    authHeaderToken = data.basicToken;
    localStorage.setItem('dynasched_basic_token', authHeaderToken);
    currentUser = data.user;

    closeLoginModal();
    updateAuthUI(currentUser);
    await loadInitialData();
  } catch (err) {
    loginErrorBanner.textContent = 'Network error: ' + err.message;
    loginErrorBanner.classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('dynasched_basic_token');
  authHeaderToken = null;
  currentUser = null;
  updateAuthUI(null);
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
    usersData = await res.json();
    populateUserSelect();
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

async function fetchTasks() {
  try {
    const res = await apiFetch('/api/tasks');
    tasksData = await res.json();
    renderTasksTable();
    populateDependenciesSelect();
  } catch (err) {
    console.error('Failed to load tasks:', err);
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
      body: JSON.stringify({ weights })
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
    
    // Refresh tasks table to show COMPLETED status
    await fetchTasks();
    ganttStatusBadge.textContent = 'Simulation Completed';
    ganttStatusBadge.style.color = '#34d399';
  } catch (err) {
    alert('Simulation error: ' + err.message);
  } finally {
    btnRunSim.disabled = false;
    btnRunSim.textContent = '▶ Run Scheduler';
  }
}

async function resetSimulation() {
  try {
    const res = await apiFetch('/api/reset', { method: 'POST' });
    if (res.ok) {
      await fetchTasks();
      resetUI();
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
    if (res.ok) {
      await fetchTasks();
      resetUI();
      // Auto run simulation to show immediate value
      await runSimulation();
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
    }
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
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

  try {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_name,
        importance,
        arrival_time,
        burst_time,
        deadline,
        user_id,
        dependencies
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to add task.');
      return;
    }

    closeAddTaskModal();
    addTaskForm.reset();
    await fetchTasks();
  } catch (err) {
    alert('Error adding task: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// RENDERING FUNCTIONS
// ---------------------------------------------------------------------------
function renderTasksTable() {
  taskCountBadge.textContent = `${tasksData.length} Tasks`;

  if (tasksData.length === 0) {
    tasksTableBody.innerHTML = `<tr><td colspan="9" class="text-center">No tasks available. Click "Load Demo Workload" or "+ Add Task".</td></tr>`;
    return;
  }

  tasksTableBody.innerHTML = tasksData.map(t => {
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
          <div style="font-weight: 500;">${escapeHtml(t.task_name)}</div>
          <div style="font-size: 11px; color: var(--text-dim);">${t.user_name ? 'Assigned: ' + escapeHtml(t.user_name) : 'Unassigned'}</div>
        </td>
        <td><span class="imp-badge ${impClass}">${t.importance} / 10</span></td>
        <td><code>t=${t.arrival_time}</code></td>
        <td><code>${t.burst_time} units</code></td>
        <td><code>t=${t.deadline}</code></td>
        <td>${depsHtml}</td>
        <td><span class="status-pill ${statusClass}">${t.status}</span></td>
        <td>
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
  kpiMakespan.textContent = `Total Makespan: ${metrics.totalMakespan} units (Busy: ${metrics.totalBusyTime})`;

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
      block.title = `Task ${item.taskId}: ${item.taskName}\nStart: ${item.start}, Completion: ${item.end}, Burst: ${duration}`;
    } else {
      block.innerHTML = `
        <span class="gantt-block-title">IDLE</span>
        <span class="gantt-block-time">[${item.start} → ${item.end}]</span>
      `;
      block.title = `CPU Idle period from t=${item.start} to t=${item.end}`;
    }

    ganttChartEl.appendChild(block);
  });

  // Render Time Axis Ticks
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
    schedulingLogEl.innerHTML = `<div class="empty-state">No decisions logged.</div>`;
    return;
  }

  schedulingLogEl.innerHTML = logEntries.map(log => `
    <div class="log-item">
      <div class="log-item-time">⏱ Simulated Time: t = ${log.simulatedTime} | Selected: T${log.selectedTaskId} (Score: ${log.priorityScore})</div>
      <div class="log-item-body">${escapeHtml(log.decisionReason)}</div>
    </div>
  `).join('');
}

function renderResultsTable(results) {
  if (!results || results.length === 0) {
    resultsTableBody.innerHTML = `<tr><td colspan="10" class="text-center">No simulation results available.</td></tr>`;
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
      <td><span style="color: #60a5fa; font-weight: 600;">${r.waitingTime}</span></td>
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

function resetUI() {
  kpiAvgWait.textContent = '-';
  kpiAvgTurnaround.textContent = '-';
  kpiCpuUtil.textContent = '-';
  kpiMakespan.textContent = 'Makespan: -';
  kpiDeadlines.textContent = '-';
  kpiDeadlineRatio.textContent = 'Met vs Missed';

  ganttChartEl.innerHTML = `<div class="empty-state">Click "Run Scheduler" or "Load Demo Workload" to view simulation timeline</div>`;
  ganttTimeAxisEl.innerHTML = '';
  ganttStatusBadge.textContent = 'Waiting for simulation run';
  ganttStatusBadge.style.color = 'var(--text-muted)';

  decisionsCountBadge.textContent = '0 Events';
  schedulingLogEl.innerHTML = `<div class="empty-state">No scheduling decisions recorded yet. Run simulation to inspect dynamic priority scoring and aging behavior.</div>`;

  resultsTableBody.innerHTML = `<tr><td colspan="10" class="text-center">No simulation results available.</td></tr>`;
}

function populateUserSelect() {
  assignedUserSelect.innerHTML = '<option value="">Select Member...</option>' +
    usersData.map(u => `<option value="${u.user_id}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`).join('');
}

function populateDependenciesSelect() {
  dependenciesSelect.innerHTML = tasksData.map(t => 
    `<option value="${t.task_id}">T${t.task_id}: ${escapeHtml(t.task_name)} (Burst: ${t.burst_time})</option>`
  ).join('');
}

function openAddTaskModal() {
  populateDependenciesSelect();
  addTaskModal.classList.remove('hidden');
}

function closeAddTaskModal() {
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
