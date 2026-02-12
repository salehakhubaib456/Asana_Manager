-- Dashboards: multiple dashboards per user (ClickUp-style)
CREATE TABLE IF NOT EXISTS dashboards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  owner_id INT NOT NULL,
  settings JSON NULL,
  is_public BOOLEAN DEFAULT FALSE,
  share_token VARCHAR(64) NULL UNIQUE,
  workspace_shared BOOLEAN DEFAULT FALSE,
  last_viewed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_dashboards_owner ON dashboards(owner_id);
CREATE INDEX idx_dashboards_share_token ON dashboards(share_token);
CREATE INDEX idx_dashboards_updated ON dashboards(updated_at DESC);

-- Dashboard members (sharing)
CREATE TABLE IF NOT EXISTS dashboard_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dashboard_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dashboard_user (dashboard_id, user_id),
  FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
