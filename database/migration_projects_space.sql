-- Lists (projects) can belong to a Space (location)
ALTER TABLE projects ADD COLUMN space_id INT NULL;
ALTER TABLE projects ADD CONSTRAINT fk_projects_space
  FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE SET NULL;
