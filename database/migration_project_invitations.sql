-- Project invitations: email invite with token and permission. Accept link adds user to project.
-- Run once. Optional: add permission to project_members for view/comment/edit/full_edit.

CREATE TABLE IF NOT EXISTS project_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  task_id INT NULL,
  email VARCHAR(255) NOT NULL,
  permission ENUM('view', 'comment', 'edit', 'full_edit') NOT NULL DEFAULT 'full_edit',
  token VARCHAR(64) NOT NULL,
  invited_by_user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invite_token (token),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add permission column (run only if not exists; ignore error if already present)
ALTER TABLE project_members ADD COLUMN permission ENUM('view', 'comment', 'edit', 'full_edit') NULL;
