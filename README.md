# DynaSched: Priority-Based Task Scheduling and Performance Analysis System

### Team Information
**Team Name:** Avengers  
- **Nitin (Team Lead)** — Section: ML-3 | Student ID: 240111870 | Roll No: 2418700 | Email: nitin892684@gmail.com
- **Ashish Rautela** — Section: D2 | Student ID: 240111842 | Roll No: 2418361 | Email: ashishrautela190@gmail.com
- **Rishi Raj Thakuri** — Section: E2 | Student ID: 240111847 | Roll No: 2418838 | Email: rishithakuri2006@gmail.com
- **Sahil Negi** — Section: A1 | Student ID: 240111876 | Roll No: 2418883 | Email: sahilnegipw@gmail.com

---

## 📌 Project Overview
**DynaSched** is a database-driven task scheduling and performance evaluation system. Instead of relying only on static priorities or basic queues, it evaluates tasks dynamically using factors such as:
1. **Task Importance** ($I \in [1, 10]$)
2. **Deadline Urgency / Risk** ($U$) based on slack time $(D - (t + \text{burst}))$
3. **Waiting Time & Aging** ($W \times \text{agingFactor}$) to prevent starvation of low-priority tasks
4. **Burst Time** ($B$) to optimize throughput
5. **Task Dependency Resolution** ensuring prerequisite tasks complete before dependents run
6. **Comparative Performance Analysis** evaluating FCFS, SJF, Static Priority, and Dynamic Priority with Aging side-by-side

### Dynamic Priority Formula
$$\text{Dynamic Priority Score} = (w_I \times I) + (w_A \times W) + (w_U \times U) - (w_B \times B)$$

- **$w_I = 3.0$**: Weight for base task importance
- **$w_A = 1.5$**: Aging factor per unit of waiting time (starvation prevention)
- **$w_U = 2.0$**: Deadline urgency factor (increases as deadline slack tightens)
- **$w_B = 0.5$**: Burst time penalty factor

---

## 🏗️ System Architecture: MVC & Modular Services

The application follows an **MVC (Model-View-Controller)** pattern with clean **Frontend / Backend separation**, **modular backend services**, and **JSON Web Token (JWT) Authentication**.

```
DynaSched/
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection pool configuration
│   ├── models/                   # [M in MVC] Data access layer
│   │   ├── userModel.js          # Users entity queries & lookups
│   │   ├── taskModel.js          # Task CRUD & dependency aggregation
│   │   ├── dependencyModel.js    # Task dependencies queries & constraints
│   │   └── historyModel.js       # Execution & scheduling history records
│   ├── services/                 # Business logic divided into dedicated services
│   │   ├── authService.js        # JWT generation, verification & credentials check
│   │   ├── userService.js        # User retrieval operations
│   │   ├── taskService.js        # Task validation, transaction-based creation & updates
│   │   ├── dependencyService.js  # Prerequisite cycle detection & constraint management
│   │   ├── schedulerService.js   # Simulation orchestration & multi-algorithm comparison
│   │   └── historyService.js     # Performance aggregation, queue reset & workload seeding
│   ├── controllers/              # [C in MVC] HTTP request / response handlers
│   │   ├── authController.js     # /api/auth/login, /api/auth/me, /api/auth/logout
│   │   ├── userController.js     # /api/users
│   │   ├── taskController.js     # /api/tasks (GET, POST, PUT, DELETE)
│   │   ├── dependencyController.js # /api/dependencies (POST, DELETE)
│   │   ├── schedulerController.js  # /api/simulate, /api/simulate/compare
│   │   └── historyController.js    # /api/history, /api/reset, /api/seed
│   ├── middlewares/
│   │   └── authMiddleware.js     # Standard JWT Bearer token authentication guard
│   ├── scheduler/
│   │   └── schedulerEngine.js    # Dynamic Priority with Aging, FCFS, SJF, Static Priority
│   ├── routes/
│   │   └── apiRoutes.js          # Express API route declarations
│   └── server.js                 # Express server & static asset mount
│
├── frontend/                     # [V in MVC] Clean separated Frontend View layer
│   ├── index.html                # Semantic UI, auth badge, Gantt chart, metrics cards, comparison table
│   ├── style.css                 # Dark theme responsive styling & modal dialogs
│   └── app.js                    # Client-side controller, JWT token handling, Gantt rendering & algorithm comparison
├── test.js                       # Comprehensive test suite (scheduler, algorithms, JWT auth, models)
├── db-init.js                    # Database schema & user seed runner
└── schema.sql                    # PostgreSQL schema, views, triggers, and stored procedures
```

---

## 🔐 JSON Web Token (JWT) Authentication

The API is protected using standard **JSON Web Tokens (JWT)**:
- **Header format**: `Authorization: Bearer <jwt_token>`
- **Token Payload**: `{ user_id, name, email, role }` signed using HMAC-SHA256 with a 24-hour expiration.
- Unauthenticated requests receive `401 Unauthorized`.
- The frontend features an interactive login modal, persistent localStorage token caching, and an in-app auth status pill.

### Default Credentials:
| Account Type | Username / Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` | `admin123` | Administrator |
| **Team Lead** | `nitin892684@gmail.com` | `password123` | Team Lead |
| **Developer** | `ashishrautela190@gmail.com` | `password123` | Developer |
| **Developer** | `rishithakuri2006@gmail.com` | `password123` | Developer |
| **Developer** | `sahilnegipw@gmail.com` | `password123` | Developer |

---

## 🗄️ PostgreSQL Database Design

The system actively utilizes PostgreSQL features (relational integrity, foreign keys, CHECK constraints, views, indexes, triggers, stored procedures, and transactions).

### 1. Tables
- **`users`**: Team members (`user_id`, `name`, `email`, `password`, `role`).
- **`tasks`**: Task metadata (`task_id`, `task_name`, `importance`, `arrival_time`, `burst_time`, `deadline`, `status`, `completion_time`, `user_id`).
- **`task_dependencies`**: Directed prerequisite graph preventing execution of blocked tasks.
- **`execution_history`**: Simulated run results (`start_time`, `completion_time`, `waiting_time`, `turnaround_time`, `response_time`, `deadline_met`).
- **`scheduling_history`**: Log of each scheduling event at time $t$, dynamic score, and reason.

### 2. Views, Triggers & Stored Procedures
- **`ready_tasks_view`**: Computes eligible tasks whose prerequisite dependencies are all satisfied.
- **`performance_summary_view`**: Aggregates average waiting time, average turnaround time, average response time, total makespan, and deadline misses.
- **`trg_after_execution_insert`**: Database trigger automatically updating task status to `'COMPLETED'` and syncing `completion_time` on execution log insert.
- **`sp_reset_simulation()`**: Stored procedure to reset all tasks to `PENDING` and clear history.
- **`sp_complete_task(p_task_id)`**: Stored procedure to manually mark a task as `COMPLETED`.
- **`sp_seed_history_snapshot(...)`**: Stored procedure for scheduling decision audit snapshots.

---

## ⚙️ Scheduling Algorithms Comparison

DynaSched implements and compares 4 scheduling approaches on identical task workloads:

| Algorithm | Selection Criterion | Starvation Risk | Best Suited For |
| :--- | :--- | :--- | :--- |
| **FCFS** | Arrival Time ($t_{\text{arr}}$) | None (fair queue) | Simple workloads, batch pipelines |
| **SJF** | Shortest Burst Time ($t_{\text{burst}}$) | High (long jobs starve) | Minimizing average waiting time |
| **Static Priority** | Fixed Importance ($I \in [1, 10]$) | Severe (low-priority jobs starve) | Strict priority environments |
| **Dynamic Priority + Aging** | $(w_I \times I) + (w_A \times W) + (w_U \times U) - (w_B \times B)$ | **Zero** (aging boosts waiting jobs) | Mixed workloads with deadlines |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **PostgreSQL** (running locally on port 5432)

### 2. Configuration
Check or edit `.env`:
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=dynasched_db
JWT_SECRET=dynasched_jwt_secret_2024
JWT_EXPIRES_IN=24h
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=admin123
```

### 3. Initialize Database
Create and seed schema, views, triggers, stored procedures, and default users:
```bash
npm run init-db
```

### 4. Run Verification Test Suite
Executes test suites covering Dynamic Priority with aging, baseline algorithms (FCFS, SJF, Static Priority), dependency cycle detection, JWT token authentication, and MVC architecture integrity:
```bash
npm test
```

### 5. Launch the Web Application
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🖥️ Web Dashboard Features
- **JWT Authentication**: Integrated login/logout modal, user role display, and credentials guidance.
- **Algorithm Selector**: Switch between Dynamic Priority, FCFS, SJF, and Static Priority directly in the toolbar.
- **Comparative Analysis Section**: One-click "⚖ Compare All" button running all 4 algorithms and displaying a side-by-side performance metrics comparison table highlighting the best metrics in green.
- **One-Click Demo Workload**: Seeds realistic tasks showcasing dependency chains, aging boosts, and tight deadline alerts.
- **Interactive Gantt Chart**: Visualizes CPU execution timeline, active tasks, and idle time units.
- **Real-Time Performance KPIs**: Average Waiting Time, Turnaround Time, CPU Utilization, and Deadline Success Rate.
- **Dynamic Score Tuning**: Live sliders for fine-tuning weights ($w_I, w_A, w_U, w_B$).
- **Scheduling Decisions Log**: Step-by-step breakdown of how each scheduling decision was calculated.
- **Task Management**: Full task creation, dependency picker, inline editing modal, and deletion controls.
