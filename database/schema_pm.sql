-- =============================================================================
-- Asanamanager – Project Management System (Asana-style)
-- Full schema: run this in your MySQL database (e.g. defaultdb)
--
-- Note: Priority / status / task_type use ENUMs. For dynamic types at scale,
-- consider lookup tables (e.g. priorities, statuses) later. ENUMs are fine
-- for current scope.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. USERS (extend existing if already present)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NULL,
  avatar_url VARCHAR(500) NULL,
  password_hash VARCHAR(255) NULL COMMENT 'bcrypt/argon2; never store plain text',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- If users table already existed, run once (order optional):
-- ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL;
-- ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL;

-- -----------------------------------------------------------------------------
-- 1b. LOGIN / SIGNUP – Email verification (professional touch)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);

-- -----------------------------------------------------------------------------
-- 1c. LOGIN – Session-based (Option A)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_token VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_expires ON user_sessions(user_id, expires_at);

-- -----------------------------------------------------------------------------
-- 1d. LOGIN – JWT refresh tokens (Option B; modern SaaS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  revoked TINYINT(1) DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked);

-- -----------------------------------------------------------------------------
-- 1e. PASSWORD RESET (forgot password)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- -----------------------------------------------------------------------------
-- 2. PROJECTS (name and count defined by user)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status ENUM('on_track', 'at_risk', 'off_track') DEFAULT 'on_track',
  owner_id INT NOT NULL,
  settings JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL COMMENT 'Soft delete; NULL = active',
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- -----------------------------------------------------------------------------
-- 3. PROJECT MEMBERS (team & roles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_user (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 4. SECTIONS (To Do, Doing, Done)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 5. TASKS (core entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  section_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('on_track', 'still_waiting', 'completed') DEFAULT 'on_track',
  assignee_id INT NULL,
  due_date DATE NULL,
  start_date DATE NULL,
  position INT NOT NULL DEFAULT 0,
  task_type ENUM('software_dev', 'dataset', 'video_processing', 'sports_coaching', 'research_docs') DEFAULT 'software_dev',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL COMMENT 'Soft delete; NULL = active',
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE RESTRICT,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 6. TASK DEPENDENCIES (for Gantt / risk)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_dependencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  depends_on_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dep (task_id, depends_on_id),
  CHECK (task_id != depends_on_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 6b. TASK HISTORY (status / assignee / section changes for audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  field_changed VARCHAR(50) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_created ON task_history(created_at);

-- -----------------------------------------------------------------------------
-- 7. COMMENTS (per task)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 8. ATTACHMENTS (per task)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NULL,
  file_size INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 9. MESSAGES (project-level feed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 10. PROJECT FILES (centralized; optional task link)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  uploaded_by INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 11. ACTIVITY LOG (recent activity & AI input)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- -----------------------------------------------------------------------------
-- 12. RISK ALERTS (overdue / blocked / delayed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  project_id INT NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  message TEXT NULL,
  resolved TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- INDEXES (for dashboard & list queries)
-- -----------------------------------------------------------------------------
CREATE INDEX idx_tasks_project_section ON tasks(project_id, section_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_activity_project_created ON activity_log(project_id, created_at);
CREATE INDEX idx_risk_alerts_project_resolved ON risk_alerts(project_id, resolved);

-- -----------------------------------------------------------------------------
-- MIGRATION: If tables already exist, add soft delete + task_history (run once)
-- -----------------------------------------------------------------------------
-- ALTER TABLE projects ADD COLUMN deleted_at DATETIME NULL;
-- ALTER TABLE tasks ADD COLUMN deleted_at DATETIME NULL;
-- Then create task_history table (block above) if not already present.

-- -----------------------------------------------------------------------------
-- SEED: Example project + default sections (run after users exist; optional)
-- -----------------------------------------------------------------------------
-- Adjust owner_id / name as needed:
-- SET @owner_id = (SELECT id FROM users LIMIT 1);
-- INSERT INTO projects (name, description, status, owner_id) VALUES ('My Project', 'Project purpose and scope.', 'on_track', @owner_id);
-- SET @project_id = LAST_INSERT_ID();
-- INSERT INTO project_members (project_id, user_id, role) VALUES (@project_id, @owner_id, 'owner');
-- INSERT INTO sections (project_id, name, position) VALUES (@project_id, 'To Do', 1), (@project_id, 'Doing', 2), (@project_id, 'Done', 3);
