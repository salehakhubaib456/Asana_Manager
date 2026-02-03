# Asanamanager – Project Management System Architecture

## 1. System Overview

**Asanamanager** is an Asana-style project management and execution system for product teams. It covers:

- **Projects** with status (On Track / At Risk / Off Track)
- **Teams & roles** (Project Owner, members, assignees)
- **Task lifecycle** (To Do → Doing → Done) with priority, due dates, status
- **Task types** (software dev, datasets, video, coaching, research)
- **Views**: List, Board (Kanban), Timeline (Gantt), Calendar
- **Dashboard & analytics** (totals, completed, overdue, by assignee, over time)
- **Communication** (project messages, comments, file storage)
- **AI-ready** (activity log for summaries, risk alerts)

The app is **Next.js + MySQL (mysql2)**. All logic and reporting are driven by a single, clear database schema. Priority, status, and task_type use **ENUMs**; for dynamic types at scale, consider lookup tables later.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                               │
│  Views: List | Board | Timeline | Calendar | Dashboard | Messages        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API LAYER (Next.js API Routes)                    │
│  /api/projects | /api/tasks | /api/sections | /api/users | /api/dashboard│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (mysql2 pool)                          │
│  src/lib/db.ts → MySQL (Aiven)                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         MySQL DATABASE                                    │
│  users, projects, sections, tasks, comments, attachments, messages, …    │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Frontend**: Same dataset shown in different views (list, board, timeline, calendar, dashboard).
- **API**: REST-style routes; each returns JSON. Dashboard and analytics are derived from the same task/section/project tables.
- **Database**: Single source of truth; no Prisma, only raw SQL via mysql2.

---

## 3. Entity Relationship (Conceptual)

```
┌──────────┐       ┌─────────────────┐       ┌──────────┐
│  User    │───┬───│ project_members  │───┬───│ Project  │
└──────────┘   │   └─────────────────┘   │   └──────────┘
      │        │           │             │         │
      │        │           │             │         │ 1:N
      │        │           │             │         ▼
      │        │           │             │   ┌──────────┐
      │        │           │             │   │ Section  │  (To Do, Doing, Done)
      │        │           │             │   └──────────┘
      │        │           │             │         │
      │        │           │             │         │ 1:N
      │        │           │             │         ▼
      │        │           │             │   ┌──────────┐
      │        └───────────┼─────────────┼──│  Task    │
      │                    │             │   └──────────┘
      │                    │             │         │
      │              (assignee)          │         │ 1:N
      │                    │             │         ├──────────► Comments
      │                    │             │         ├──────────► Attachments
      │                    │             │         └──────────► Dependencies
      │                    │             │
      │                    │             │   ┌──────────┐
      │                    └─────────────┼──│ Message │  (project-level)
      │                                   │   └──────────┘
      │                                   │   ┌──────────────┐
      └───────────────────────────────────┼──│ project_files│
                                          │   └──────────────┘
```

- **User**: One table; used as project owner, member, and task assignee.
- **Project**: Any project (name set by user); has status and overview; linked to users via `project_members`.
- **Section**: Columns/phases (e.g. To Do, Doing, Done); belong to a project; order by `position`.
- **Task**: Lives in one section; has assignee (User), due date, priority, status, type; can have comments, attachments, dependencies.
- **Message**: Project-level feed; linked to project (and optionally to a user).
- **Project files**: Stored at project level; can optionally link to a task.

---

## 4. Database Schema (Table-by-Table)

### 4.1 Core: Users

| Column        | Type         | Purpose                    |
|---------------|--------------|----------------------------|
| id            | INT PK       | Unique user id             |
| email         | VARCHAR(255) | Login / unique              |
| name          | VARCHAR(255) | Display name               |
| avatar_url    | VARCHAR(500) | Optional profile image     |
| password_hash | VARCHAR(255) | bcrypt/argon2 hash; never plain text |
| created_at    | DATETIME     | Created                    |
| updated_at    | DATETIME     | Last updated               |

**Relations:**  
- Owner of many **projects** (project.owner_id → user.id).  
- Member of many **projects** via **project_members**.  
- Assignee of many **tasks** (task.assignee_id → user.id).  
- Author of **comments**, **attachments**, **messages**.

**Auth:** Password-based login uses **password_hash** (bcrypt/argon2). See **email_verifications**, **user_sessions** / **refresh_tokens**, **password_resets** below.

---

### 4.1b Login / Signup – Auth Tables

| Table                | Purpose |
|----------------------|--------|
| **email_verifications** | Token + expires_at + verified_at; professional email verification. |
| **user_sessions**    | Session-based login: session_token, ip_address, user_agent, expires_at. |
| **refresh_tokens**   | JWT refresh tokens: token, revoked, expires_at (modern SaaS). |
| **password_resets**  | Forgot password: token, expires_at, used_at. |

**Usage:**  
- Signup: create user with **password_hash** (bcrypt/argon2); optionally create **email_verifications** row, send link, set verified_at on click.  
- Login: verify password against **password_hash**; create **user_sessions** row (Option A) or issue JWT + store **refresh_tokens** (Option B).  
- Forgot password: create **password_resets** row, send link, on submit set new **password_hash** and used_at.

---

### 4.2 Projects

| Column       | Type         | Purpose                                      |
|-------------|--------------|----------------------------------------------|
| id          | INT PK       | Unique project id                            |
| name        | VARCHAR(255) | Project name (user-defined)                 |
| description | TEXT         | Purpose, scope, overview                     |
| status      | ENUM         | `on_track` \| `at_risk` \| `off_track`        |
| owner_id    | INT FK       | Project Owner (user.id)                       |
| settings    | JSON         | Optional: workflow, custom fields, views      |
| created_at  | DATETIME     | Created                                      |
| updated_at  | DATETIME     | Last updated                                 |
| deleted_at  | DATETIME NULL| Soft delete; NULL = active (data recovery)    |

**Relations:**  
- **owner_id** → users.id (Project Owner).  
- **project_members** (project_id, user_id, role): team members and roles.  
- **sections**: 1:N (To Do, Doing, Done, etc.).  
- **messages**: 1:N project-level feed.  
- **project_files**: 1:N.

---

### 4.3 Project Members (Team & Roles)

| Column     | Type    | Purpose                          |
|------------|---------|----------------------------------|
| id         | INT PK  | Unique row id                    |
| project_id | INT FK  | Project                          |
| user_id    | INT FK  | Team member                      |
| role       | ENUM    | `owner` \| `admin` \| `member`    |
| created_at | DATETIME| Joined at                        |

**Relations:**  
- **project_id** → projects.id.  
- **user_id** → users.id.  

**Usage:**  
- One **owner** per project (usually same as project.owner_id; can sync).  
- **admin**: can manage members, sections, settings.  
- **member**: can manage own tasks, comment, attach files.  
- Accountability: every task has an **assignee** (user_id); due dates on tasks.

---

### 4.4 Sections (To Do / Doing / Done)

| Column      | Type         | Purpose                    |
|------------|--------------|----------------------------|
| id         | INT PK       | Unique section id          |
| project_id | INT FK       | Project                    |
| name       | VARCHAR(100) | e.g. "To Do", "Doing", "Done" |
| position   | INT          | Order in list/board        |
| created_at | DATETIME     | Created                    |
| updated_at | DATETIME     | Last updated               |

**Relations:**  
- **project_id** → projects.id.  
- **tasks**: 1:N; each task has section_id.

**Usage:**  
- List view: sections as groups, tasks under each.  
- Board view: sections = columns; tasks = cards (same section_id).  
- Moving a task = updating task.section_id (and optionally position).

---

### 4.5 Tasks (Heart of the System)

| Column        | Type         | Purpose                                              |
|---------------|--------------|------------------------------------------------------|
| id            | INT PK       | Unique task id                                       |
| project_id    | INT FK       | Project (denormalized for easy queries)              |
| section_id    | INT FK       | To Do / Doing / Done                                 |
| title         | VARCHAR(500) | Task title                                           |
| description   | TEXT         | Full description                                     |
| priority      | ENUM         | `low` \| `medium` \| `high`                          |
| status        | ENUM         | `on_track` \| `still_waiting` \| `completed`          |
| assignee_id   | INT FK       | Owner of the task (user.id)                          |
| due_date      | DATE         | Due date                                             |
| start_date    | DATE         | Optional; for Gantt / timeline                        |
| position      | INT          | Order within section                                 |
| task_type     | ENUM         | software_dev, dataset, video_processing, sports_coaching, research_docs |
| created_at    | DATETIME     | Created                                              |
| updated_at    | DATETIME     | Last updated                                         |
| deleted_at    | DATETIME NULL| Soft delete; NULL = active (data recovery)           |

**Relations:**  
- **project_id** → projects.id.  
- **section_id** → sections.id.  
- **assignee_id** → users.id.  

**Task types (task_type):**  
- **software_dev** – Development, bugs, features.  
- **dataset** – Data set creation, labeling, QA.  
- **video_processing** – Video pipeline, filters, encoding.  
- **sports_coaching** – Coaching workflows, drills, plans.  
- **research_docs** – Research and documentation.

**Usage:**  
- List: filter by section, assignee, priority, status, task_type; exclude `deleted_at IS NOT NULL` for soft-deleted.  
- Board: section = column; drag-drop = update section_id + position (log in task_history).  
- Timeline/Gantt: start_date, due_date, dependencies.  
- Calendar: due_date (and optionally start_date).  
- Dashboard: aggregate by status, assignee, overdue (due_date < today, status != completed).  
- **Soft delete:** set `deleted_at = NOW()` instead of DELETE; list/dashboard filter `WHERE deleted_at IS NULL`. **Task history:** on status/assignee/section change, insert into task_history for audit.

---

### 4.6 Task Dependencies (Timeline / Gantt)

| Column          | Type    | Purpose                |
|-----------------|---------|------------------------|
| id              | INT PK  | Unique row             |
| task_id         | INT FK  | Task that depends      |
| depends_on_id   | INT FK  | Task it depends on     |
| created_at      | DATETIME| Created                |

**Relations:**  
- **task_id** → tasks.id.  
- **depends_on_id** → tasks.id (same project in practice).

**Usage:**  
- Timeline view: draw links between tasks; block “task_id” until “depends_on_id” is done.  
- Risk: if “depends_on_id” is late, “task_id” is at risk; can drive alerts.

---

### 4.6b Task History (Audit / Status & Assignee Changes)

| Column        | Type         | Purpose                |
|---------------|--------------|------------------------|
| id            | INT PK       | Unique row             |
| task_id       | INT FK       | Task                   |
| user_id       | INT FK       | Who made the change    |
| field_changed | VARCHAR(50)  | e.g. status, assignee_id, section_id |
| old_value     | TEXT NULL    | Previous value         |
| new_value     | TEXT NULL    | New value              |
| created_at    | DATETIME     | When                   |

**Relations:**  
- **task_id** → tasks.id.  
- **user_id** → users.id.

**Usage:**  
- On task update (status, assignee, section, priority), insert a row.  
- Enables audit trail and who-changed-what-when.

---

### 4.7 Comments (Per Task)

| Column     | Type         | Purpose        |
|------------|--------------|----------------|
| id         | INT PK       | Unique comment |
| task_id    | INT FK       | Task           |
| user_id    | INT FK       | Author         |
| content    | TEXT         | Comment body   |
| created_at | DATETIME     | Created        |
| updated_at | DATETIME     | Last updated   |

**Relations:**  
- **task_id** → tasks.id.  
- **user_id** → users.id.

---

### 4.8 Attachments (Per Task)

| Column     | Type         | Purpose                    |
|------------|--------------|----------------------------|
| id         | INT PK       | Unique attachment          |
| task_id    | INT FK       | Task                       |
| user_id    | INT FK       | Uploader                   |
| file_name  | VARCHAR(255) | Original name              |
| file_url   | VARCHAR(500) | Storage path / URL         |
| file_type  | VARCHAR(50) | MIME or extension          |
| file_size  | INT          | Optional bytes             |
| created_at | DATETIME     | Created                    |

**Relations:**  
- **task_id** → tasks.id.  
- **user_id** → users.id.

**Usage:**  
- Store files in storage (e.g. local/S3); store only URL and metadata in DB.  
- Link attachments to task; show in task detail and in “project files” if needed.

---

### 4.9 Messages (Project-Level Feed)

| Column      | Type         | Purpose              |
|-------------|--------------|----------------------|
| id          | INT PK       | Unique message       |
| project_id  | INT FK       | Project              |
| user_id     | INT FK       | Author               |
| content     | TEXT         | Message body         |
| created_at  | DATETIME     | Created              |
| updated_at  | DATETIME     | Last updated         |

**Relations:**  
- **project_id** → projects.id.  
- **user_id** → users.id.

**Usage:**  
- Central project feed; can optionally reference a task (e.g. task_id nullable later if needed).

---

### 4.10 Project Files (Centralized Storage)

| Column        | Type         | Purpose                    |
|---------------|--------------|----------------------------|
| id            | INT PK       | Unique file                |
| project_id    | INT FK       | Project                    |
| task_id       | INT FK NULL  | Optional link to task      |
| uploaded_by   | INT FK       | User                       |
| file_name     | VARCHAR(255) | Original name              |
| file_url      | VARCHAR(500) | Storage path / URL         |
| file_type     | VARCHAR(50)  | MIME or extension          |
| created_at    | DATETIME     | Created                    |

**Relations:**  
- **project_id** → projects.id.  
- **task_id** → tasks.id (optional).  
- **uploaded_by** → users.id.

**Usage:**  
- All project assets (images, PDFs, datasets); some linked to tasks, some project-level only.

---

### 4.11 Activity Log (Recent Activity & AI)

| Column     | Type    | Purpose                          |
|------------|---------|----------------------------------|
| id         | INT PK  | Unique event                     |
| project_id | INT FK  | Project                          |
| task_id    | INT FK  | Optional task                    |
| user_id    | INT FK  | Who did it                       |
| action     | VARCHAR(50) | e.g. task_created, task_moved, comment_added |
| metadata   | JSON    | Extra context (old/new section, etc.) |
| created_at | DATETIME| When                              |

**Relations:**  
- **project_id** → projects.id.  
- **task_id** → tasks.id.  
- **user_id** → users.id.

**Usage:**  
- “Recent activity” feed.  
- Input for AI summaries (e.g. “last 7 days: X tasks completed, Y moved to Doing”).  
- Risk: many “task_moved” but few “completed” → possible blockage.

---

### 4.12 Risk Alerts (AI / Automation)

| Column     | Type         | Purpose                    |
|------------|--------------|----------------------------|
| id         | INT PK       | Unique alert               |
| task_id    | INT FK       | Task                       |
| project_id | INT FK       | Project                    |
| alert_type | VARCHAR(50) | e.g. overdue, blocked, delayed |
| message    | TEXT         | Human-readable message     |
| resolved   | TINYINT(1)   | 0 = open, 1 = resolved     |
| created_at | DATETIME     | Created                    |

**Relations:**  
- **task_id** → tasks.id.  
- **project_id** → projects.id.

**Usage:**  
- Cron/job: find overdue tasks, blocked (dependency not done), or stuck in “Doing” too long → insert row.  
- Dashboard: show open risk_alerts; AI summary can aggregate these.

---

## 5. How Components Work Together

### 5.1 Project Setup

1. Create **project** row: name (user-defined), description = purpose & scope, status = on_track, owner_id = chosen user.  
2. Create **project_members**: owner + admins + members.  
3. Create **sections**: e.g. “To Do”, “Doing”, “Done” with position 1, 2, 3.

### 5.2 Task Flow

1. **Create task**: section_id = “To Do”, assignee_id, due_date, priority, status = on_track, task_type.  
2. **Move to “Doing”**: update section_id (and optionally log in activity_log).  
3. **Complete**: update section_id = “Done”, status = completed (and activity_log).  
4. **List view**: query tasks by project_id, order by section.position, task.position.  
5. **Board view**: same data; group by section; drag-drop PATCH task (section_id, position).  
6. **Timeline**: tasks with start_date, due_date; dependencies from task_dependencies.  
7. **Calendar**: tasks by due_date (and start_date if needed).

### 5.3 Dashboard & Analytics

- **Total tasks**: COUNT(*) WHERE project_id = X.  
- **Completed**: status = completed (or section name = “Done”).  
- **Incomplete**: status != completed.  
- **Overdue**: due_date < CURDATE() AND status != completed.  
- **By assignee**: GROUP BY assignee_id, COUNT(*).  
- **Completion over time**: GROUP BY DATE(updated_at) or completed_at if you add it; filter status = completed.  
- All from **tasks** (and optionally **risk_alerts** for “at risk” count).

### 5.4 Communication & Files

- **Comments**: always linked to task_id; show in task detail and in activity.  
- **Attachments**: task_id; store file, save file_url in DB.  
- **Messages**: project_id; show in project “Messages” view.  
- **Project files**: project_id + optional task_id; one place for all assets; filter by task when needed.

### 5.5 AI & Automation (How It Fits)

- **Activity log**: every important action (task created/moved/completed, comment added) → insert activity_log.  
- **Summaries**: query activity_log + tasks for last N days → feed to AI or simple template (“X completed, Y in Doing, Z overdue”).  
- **Risk alerts**: job finds overdue / blocked / stuck tasks → insert risk_alerts; dashboard shows them; same data can drive “At Risk” project status.

### 5.6 Scalability & Reuse

- **Multi-project**: same schema; add more projects; filter everything by project_id.  
- **Templates**: create a “template” project with sections and maybe default tasks; clone project (and optionally tasks) for new initiatives.  
- **Customization**: project.settings JSON for extra workflow steps, custom fields, or view preferences.

---

## 6. Summary Table

| Entity               | Main purpose                          | Key relations                    |
|----------------------|----------------------------------------|----------------------------------|
| users                | People; password_hash for login        | projects, project_members, tasks |
| email_verifications  | Email verification tokens             | user                             |
| user_sessions        | Session-based login                    | user                             |
| refresh_tokens       | JWT refresh tokens                     | user                             |
| password_resets       | Forgot-password tokens                 | user                             |
| projects             | Status & overview (any project name)   | owner, members, sections, tasks  |
| project_members  | Team & roles                           | project, user                    |
| sections         | To Do / Doing / Done                  | project, tasks                   |
| tasks            | Work items; all fields for views       | project, section, assignee       |
| task_dependencies| Gantt & risk                           | task, depends_on task            |
| task_history     | Status / assignee audit trail          | task, user                       |
| comments         | Task discussion                        | task, user                       |
| attachments      | Files on tasks                         | task, user                       |
| messages         | Project feed                           | project, user                    |
| project_files    | Central files; optional task link      | project, task, user              |
| activity_log     | Recent activity & AI input             | project, task, user              |
| risk_alerts      | Overdue / blocked / delayed            | task, project                    |

---

## 7. Next Steps (Implementation)

1. **Apply schema**: Run the full SQL in `database/schema_pm.sql` (create/alter all tables).  
2. **API**: Implement routes for projects, sections, tasks, comments, attachments, messages, project_files, dashboard (aggregates), activity log, risk_alerts.  
3. **Views**: List, Board, Timeline, Calendar, Dashboard, Messages UI that call these APIs.  
4. **AI/automation**: Background job for risk_alerts; optional endpoint that reads activity_log and returns (or generates) summary.

This document is the single reference for “schema kya hai, relations kaise hain, aur system kaise ek saath kaam karega” for Asanamanager.
