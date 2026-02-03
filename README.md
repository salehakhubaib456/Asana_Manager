# Asanamanager

Next.js application with **MySQL** database (direct **mysql2**) and **TypeScript**. Prisma use nahi ho raha.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **MySQL database**
   - MySQL run karein aur database banaein:
   ```sql
   CREATE DATABASE asanamanager;
   ```
   - `.env` file banaein (`.env.example` copy karein):
   ```bash
   copy .env.example .env
   ```
   - `.env` mein apna MySQL user/password set karein:
   ```
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=asanamanager
   ```

3. **Users table banaein**  
   MySQL mein ye SQL chalaein (ya `database/schema.sql` use karein):
   ```sql
   CREATE TABLE users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(255) NOT NULL UNIQUE,
     name VARCHAR(255) NULL,
     createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
     updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   );
   ```

4. **Dev server**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |

## API

- `GET /api/health` – Health + DB connection check
- `GET /api/users` – Users list
- `POST /api/users` – User create (body: `{ "email": "...", "name": "..." }`)

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **MySQL** (direct **mysql2**, no Prisma)
"# Asana_Manager" 
