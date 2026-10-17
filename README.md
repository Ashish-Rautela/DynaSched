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

### Dynamic Priority Formula
$$\text{Dynamic Priority Score} = (w_I \times I) + (w_A \times W) + (w_U \times U) - (w_B \times B)$$

- **$w_I = 3.0$**: Weight for base task importance
- **$w_A = 1.5$**: Aging factor per unit of waiting time (starvation prevention)
- **$w_U = 2.0$**: Deadline urgency factor (increases as deadline slack tightens)
- **$w_B = 0.5$**: Burst time penalty factor

---

## 🏗️ System Architecture: MVC & Modular Services

The application follows an **MVC (Model-View-Controller)** pattern with clean **Frontend / Backend separation**, **modular backend services** (instead of a single monolithic service), and **HTTP Basic Authentication (RFC 7617)**.

```
pbl/
├── backend/
│   ├── config/
│   │   └── db.js                 # PostgreSQL connection pool configuration
│   ├── models/                   # [M in MVC] Data access layer
│   │   ├── userModel.js          # Users entity queries & lookups
│   │   ├── taskModel.js          # Task CRUD & dependency aggregation
│   │   ├── dependencyModel.js    # Task dependencies queries & constraints
│   │   └── historyModel.js       # Execution & scheduling history records
│   ├── services/                 # Business logic divided into dedicated services
│   │   ├── authService.js        # Basic Auth header parsing & credentials verification
│   │   ├── userService.js        # User retrieval operations
│   │   ├── taskService.js        # Task validation, transaction-based creation & updates
│   │   ├── dependencyService.js  # Prerequisite cycle & constraint management
│   │   ├── schedulerService.js   # Simulation orchestration & transaction logging
│   │   └── historyService.js     # Performance aggregation, queue reset & workload seeding
│   ├── controllers/              # [C in MVC] HTTP request / response handlers
│   │   ├── authController.js     # /api/auth/login, /api/auth/me
│   │   ├── userController.js     # /api/users
│   │   ├── taskController.js     # /api/tasks (GET, POST, PUT, DELETE)
│   │   ├── dependencyController.js # /api/dependencies (POST, DELETE)
│   │   ├── schedulerController.js  # /api/simulate
│   │   └── historyController.js    # /api/history, /api/reset, /api/seed
│   ├── middlewares/
│   │   └── authMiddleware.js     # Standard HTTP Basic Auth (RFC 7617) guard
│   ├── scheduler/
│   │   └── schedulerEngine.js    # Core non-preemptive dynamic priority algorithm
│   ├── routes/
│   │   └── apiRoutes.js          # Express API route declarations
│   └── server.js                 # Express server & static asset mount
│
├── frontend/                     # [V in MVC] Clean separated Frontend View layer
│   ├── index.html                # Semantic UI, auth badge, Gantt chart, metrics cards
│   ├── style.css                 # Dark theme responsive styling & modal dialogs
│   └── app.js                    # Client-side controller, Basic Auth token handling & Gantt rendering
├── test.js                       # Comprehensive test suite (scheduler, services, auth, models)
├── db-init.js                    # Database schema & user seed runner
└── schema.sql                    # PostgreSQL schema, views, triggers, and constraints
```

---

## 🔐 HTTP Basic Authentication

The API is protected using RFC 7617 **HTTP Basic Authentication**:
- **Header format**: `Authorization: Basic <base64(username:password)>`
- Unauthenticated requests receive `401 Unauthorized` with `WWW-Authenticate: Basic realm="DynaSched System"`.
- The frontend features an interactive login modal, persistent session storage, and an in-app auth status pill.

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

The system actively utilizes PostgreSQL features (relational integrity, foreign keys, CHECK constraints, views, indexes, triggers, and transactions).

### 1. Tables
- **`users`**: Team members (`user_id`, `name`, `email`, `password`, `role`).
- **`tasks`**: Task metadata (`task_id`, `task_name`, `importance`, `arrival_time`, `burst_time`, `deadline`, `status`, `user_id`).
- **`task_dependencies`**: Directed prerequisite graph preventing execution of blocked tasks.
- **`execution_history`**: Simulated run results (`start_time`, `completion_time`, `waiting_time`, `turnaround_time`, `response_time`, `deadline_met`).
- **`scheduling_history`**: Log of each scheduling event at time $t$, dynamic score, and reason.

### 2. Views & Triggers
- **`ready_tasks_view`**: Computes eligible tasks whose prerequisite dependencies are satisfied.
- **`performance_summary_view`**: Aggregates average waiting time, average turnaround time, average response time, total makespan, and deadline misses.
- **`trg_after_execution_insert`**: Database trigger automatically updating task status to `'COMPLETED'` on execution log insert.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **PostgreSQL 16** (running locally on port 5432)

### 2. Configuration
Check or edit `.env`:
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=dynasched_db
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=admin123
```

### 3. Initialize Database
Create and seed schema, views, triggers, and default users:
```bash
npm run init-db
```

### 4. Run Self-Check Verification Test
Executes test suites covering the scheduling algorithm, aging starvation prevention, Basic Auth header parsing & verification, input validation, and service modularity:
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
- **HTTP Basic Authentication**: Integrated login/logout modal, user role display, and credentials guidance.
- **One-Click Demo Workload**: Seeds realistic tasks showcasing dependency chains, aging boosts, and tight deadline alerts.
- **Interactive Gantt Chart**: Visualizes CPU execution timeline, active tasks, and idle time units.
- **Real-Time Performance KPIs**: Average Waiting Time, Turnaround Time, CPU Utilization, and Deadline Success Rate.
- **Dynamic Score Tuning**: Live sliders for fine-tuning weights ($w_I, w_A, w_U, w_B$).
- **Scheduling Decisions Log**: Step-by-step breakdown of how each scheduling decision was calculated.
- **Task Management**: Full task creation with dependency picker and deletion controls.
