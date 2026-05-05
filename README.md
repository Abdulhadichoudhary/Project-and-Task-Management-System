# Team Task Manager

A full-stack project and task management app with signup/login, PostgreSQL persistence, REST APIs, dashboards, and role-based access control.

## Features

- Authentication with JWT signup and login.
- First registered user becomes an `admin`; later users become `member`.
- Admins can create projects, add project members, create tasks, assign tasks, and change user roles.
- Members can view their projects/tasks and update task status.
- Dashboard shows total, to do, in progress, done, overdue, and next active tasks.
- SQL relationships between users, projects, project members, and tasks.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- Vanilla HTML/CSS/JavaScript frontend
- Railway deployment config

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set `DATABASE_URL` and `JWT_SECRET`.

3. Initialize the database:

   ```bash
   npm run db:init
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Railway Deployment

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Add a PostgreSQL database service.
4. Set these variables on the web service:

   ```text
   DATABASE_URL=<Railway PostgreSQL connection URL>
   JWT_SECRET=<long random secret>
   NODE_ENV=production
   ```

5. Deploy. `railway.json` runs `npm run db:init && npm start`, so the schema is prepared on startup.
6. Open the generated Railway domain and create the first account. That account is the admin account.

## REST API

Authentication:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

Users:

- `GET /api/users`
- `PATCH /api/users/:id/role` admin only

Projects:

- `GET /api/projects`
- `POST /api/projects` admin only
- `GET /api/projects/:id/members`
- `POST /api/projects/:id/members` admin only
- `DELETE /api/projects/:id/members/:userId` admin only

Tasks:

- `GET /api/tasks`
- `POST /api/tasks` admin only
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id` admin only

Dashboard:

- `GET /api/dashboard`
