-- ====================================================================
-- DynaSched: Priority-Based Task Scheduling and Performance Analysis
-- Database Schema for PostgreSQL
-- Team: Avengers
-- ====================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) DEFAULT 'password123',
    role VARCHAR(50) DEFAULT 'Developer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    task_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
    task_name VARCHAR(150) NOT NULL,
    importance INT NOT NULL CHECK (importance BETWEEN 1 AND 10),
    arrival_time INT NOT NULL DEFAULT 0 CHECK (arrival_time >= 0),
    burst_time INT NOT NULL CHECK (burst_time > 0),
    deadline INT NOT NULL CHECK (deadline >= arrival_time + burst_time),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'READY', 'RUNNING', 'COMPLETED', 'BLOCKED')),
    completion_time INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Task Dependencies Table
CREATE TABLE IF NOT EXISTS task_dependencies (
    dependency_id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    depends_on_task_id INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    CONSTRAINT unique_task_dependency UNIQUE (task_id, depends_on_task_id),
    CONSTRAINT no_self_dependency CHECK (task_id <> depends_on_task_id)
);

-- 4. Execution History Table
CREATE TABLE IF NOT EXISTS execution_history (
    execution_id SERIAL PRIMARY KEY,
    task_id INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    start_time INT NOT NULL,
    completion_time INT NOT NULL,
    waiting_time INT NOT NULL,
    turnaround_time INT NOT NULL,
    response_time INT NOT NULL,
    deadline_met BOOLEAN NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Scheduling History Table
CREATE TABLE IF NOT EXISTS scheduling_history (
    history_id SERIAL PRIMARY KEY,
    simulated_time INT NOT NULL,
    selected_task_id INT REFERENCES tasks(task_id) ON DELETE CASCADE,
    priority_score NUMERIC(10, 2) NOT NULL,
    algorithm VARCHAR(50) DEFAULT 'Dynamic Priority with Aging',
    decision_reason TEXT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Indexes for Performance and Fast Lookup
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_arrival ON tasks(arrival_time);
CREATE INDEX IF NOT EXISTS idx_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_dep ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_sched_hist_time ON scheduling_history(simulated_time);

-- 7. Views
-- View for eligible tasks: tasks whose dependencies are all completed
CREATE OR REPLACE VIEW ready_tasks_view AS
SELECT t.*
FROM tasks t
WHERE t.status IN ('PENDING', 'READY')
  AND NOT EXISTS (
      SELECT 1
      FROM task_dependencies td
      JOIN tasks dep ON td.depends_on_task_id = dep.task_id
      WHERE td.task_id = t.task_id
        AND dep.status <> 'COMPLETED'
  );

-- View for overall system performance metrics
CREATE OR REPLACE VIEW performance_summary_view AS
SELECT 
    COUNT(*)::INT AS total_executed_tasks,
    COALESCE(ROUND(AVG(waiting_time), 2), 0) AS avg_waiting_time,
    COALESCE(ROUND(AVG(turnaround_time), 2), 0) AS avg_turnaround_time,
    COALESCE(ROUND(AVG(response_time), 2), 0) AS avg_response_time,
    COALESCE(SUM(CASE WHEN deadline_met THEN 1 ELSE 0 END)::INT, 0) AS deadlines_met,
    COALESCE(SUM(CASE WHEN NOT deadline_met THEN 1 ELSE 0 END)::INT, 0) AS deadlines_missed,
    COALESCE(MAX(completion_time), 0) AS total_makespan
FROM execution_history;

-- 8. Trigger to sync task status on execution logging
CREATE OR REPLACE FUNCTION trg_sync_task_completion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tasks 
    SET status = 'COMPLETED',
        completion_time = NEW.completion_time
    WHERE task_id = NEW.task_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_execution_insert ON execution_history;
CREATE TRIGGER trg_after_execution_insert
AFTER INSERT ON execution_history
FOR EACH ROW
EXECUTE FUNCTION trg_sync_task_completion();

-- ====================================================================
-- 9. Stored Procedures
-- ====================================================================

-- Procedure: sp_reset_simulation
-- Resets all tasks to PENDING and clears execution and scheduling history
CREATE OR REPLACE PROCEDURE sp_reset_simulation()
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM execution_history;
    DELETE FROM scheduling_history;
    UPDATE tasks SET status = 'PENDING', completion_time = NULL;
END;
$$;

-- Procedure: sp_complete_task
-- Marks a specific task as COMPLETED (manual override)
CREATE OR REPLACE PROCEDURE sp_complete_task(p_task_id INT)
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE tasks SET status = 'COMPLETED' WHERE task_id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task with ID % not found', p_task_id;
    END IF;
END;
$$;

-- Procedure: sp_seed_history_snapshot
-- Records a snapshot entry in scheduling_history for audit purposes
CREATE OR REPLACE PROCEDURE sp_seed_history_snapshot(
    p_simulated_time INT,
    p_task_id INT,
    p_score NUMERIC,
    p_algorithm VARCHAR,
    p_reason TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO scheduling_history (simulated_time, selected_task_id, priority_score, algorithm, decision_reason)
    VALUES (p_simulated_time, p_task_id, p_score, p_algorithm, p_reason);
END;
$$;
