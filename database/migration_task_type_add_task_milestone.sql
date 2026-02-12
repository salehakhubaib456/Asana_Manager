-- Add Task, Milestone, Form Response, Meeting Note to task_type ENUM.
-- Run once in MySQL. Existing rows keep current value; new tasks default to 'task' after migration.
ALTER TABLE tasks MODIFY COLUMN task_type ENUM(
  'task', 'milestone', 'form_response', 'meeting_note',
  'software_dev', 'dataset', 'video_processing', 'sports_coaching', 'research_docs'
) DEFAULT 'task';
