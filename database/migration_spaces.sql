-- Spaces: teams, departments, or groups (each with own lists/folders)
CREATE TABLE IF NOT EXISTS spaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  user_id INT NOT NULL,
  default_permission VARCHAR(50) DEFAULT 'full_edit',
  is_private TINYINT(1) DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_spaces_user ON spaces(user_id);

-- Folders can belong to a space (null = default workspace)
ALTER TABLE folders ADD COLUMN space_id INT NULL;
ALTER TABLE folders ADD CONSTRAINT fk_folders_space
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;
