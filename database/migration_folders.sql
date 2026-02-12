-- Folders: group projects (lists) under sidebar Spaces
CREATE TABLE IF NOT EXISTS folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_folders_user ON folders(user_id);

-- Add folder_id to projects (nullable = root-level list)
ALTER TABLE projects ADD COLUMN folder_id INT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_folder
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;
