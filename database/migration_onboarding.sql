-- Onboarding: only show for new users until they complete setup
ALTER TABLE users
  ADD COLUMN onboarding_completed_at DATETIME NULL,
  ADD COLUMN workspace_name VARCHAR(255) NULL,
  ADD COLUMN onboarding_use_case VARCHAR(50) NULL,
  ADD COLUMN onboarding_manage_types VARCHAR(500) NULL;
