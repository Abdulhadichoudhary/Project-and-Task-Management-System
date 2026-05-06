const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  view: "dashboard",
  projects: [],
  users: [],
  tasks: [],
  membersByProject: {}
};

const app = document.querySelector("#app");

function api(path, options = {}) {
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }
    return data;
  });
}

function setSession({ token, user }) {
  state.token = token;
  state.user = user;
  localStorage.setItem("ttm_token", token);
  localStorage.setItem("ttm_user", JSON.stringify(user));
}

function logout() {
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
  state.token = null;
  state.user = null;
  render();
}

function fmtDate(date) {
  if (!date) return "No due date";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task) {
  return task.due_date && task.status !== "done" && new Date(`${task.due_date}T00:00:00`) < new Date(new Date().toDateString());
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderAuth(mode = "login", error = "") {
  app.innerHTML = `
    <section class="auth-shell">
      <div class="auth-panel">
        <h1>Project Task Manager</h1>
        <p>Create projects, assign work, and keep delivery visible.</p>
        <div class="tabs">
          <button class="${mode === "login" ? "active" : ""}" data-auth-tab="login">Login</button>
          <button class="${mode === "signup" ? "active" : ""}" data-auth-tab="signup">Signup</button>
        </div>
        ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
        <form class="form-grid" id="authForm">
          <label class="${mode === "login" ? "hidden" : ""}">Name
            <input name="name" autocomplete="name" ${mode === "signup" ? "required" : ""}>
          </label>
          <label>Email
            <input name="email" type="email" autocomplete="email" required>
          </label>
          <label>Password
            <input name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="8">
          </label>
          <button type="submit">${mode === "login" ? "Login" : "Create account"}</button>
        </form>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authTab));
  });

  document.querySelector("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const data = await api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      setSession(data);
      await loadCore();
      render();
    } catch (err) {
      renderAuth(mode, err.message);
    }
  });
}

async function loadCore() {
  const [projects, users, tasks] = await Promise.all([
    api("/projects"),
    api("/users"),
    api("/tasks")
  ]);
  state.projects = projects.projects;
  state.users = users.users;
  state.tasks = tasks.tasks;
}

function shell(content) {
  app.innerHTML = `
    <section class="app-shell">
      <aside class="sidebar">
        <div class="brand">Team Task Manager</div>
        <div class="user-card">
          <strong>${escapeHtml(state.user.name)}</strong>
          <span>${escapeHtml(state.user.email)} · ${state.user.role}</span>
        </div>
        <nav class="nav">
          ${["dashboard", "projects", "tasks", "team"].map((view) => `
            <button class="${state.view === view ? "active" : ""}" data-view="${view}">${view[0].toUpperCase() + view.slice(1)}</button>
          `).join("")}
        </nav>
        <button class="secondary" id="logoutBtn">Logout</button>
      </aside>
      <section class="content">${content}</section>
    </section>
  `;

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      await loadCore();
      render();
    });
  });
  document.querySelector("#logoutBtn").addEventListener("click", logout);
}

async function renderDashboard() {
  const { stats, dueSoon } = await api("/dashboard");
  shell(`
    <div class="topbar">
      <div class="page-title">
        <h1>Dashboard</h1>
        <p>${state.user.role === "admin" ? "All team work across projects." : "Your project workload and assigned tasks."}</p>
      </div>
    </div>
    <section class="grid stats">
      ${[
        ["Total", stats.total],
        ["To do", stats.todo],
        ["In progress", stats.in_progress],
        ["Done", stats.done],
        ["Overdue", stats.overdue]
      ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("")}
    </section>
    <section class="panel" style="margin-top:16px">
      <h2>Next tasks</h2>
      <div class="item-list">${dueSoon.length ? dueSoon.map(taskCard).join("") : `<div class="empty">No active tasks yet.</div>`}</div>
    </section>
  `);
}

function projectOptions(selected = "") {
  return state.projects.map((project) => `<option value="${project.id}" ${selected === project.id ? "selected" : ""}>${escapeHtml(project.name)}</option>`).join("");
}

function userOptions(selected = "") {
  return `<option value="">Unassigned</option>` + state.users.map((user) => `<option value="${user.id}" ${selected === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`).join("");
}

function renderProjects() {
  shell(`
    <div class="topbar">
      <div class="page-title">
        <h1>Projects</h1>
        <p>Manage project spaces and team membership.</p>
      </div>
    </div>
    <section class="grid two-col">
      <div class="panel ${state.user.role !== "admin" ? "hidden" : ""}">
        <h2>New project</h2>
        <form class="form-grid" id="projectForm">
          <label>Name<input name="name" maxlength="120" required></label>
          <label>Description<textarea name="description"></textarea></label>
          <button>Create project</button>
        </form>
      </div>
      <div class="item-list">
        ${state.projects.length ? state.projects.map((project) => `
          <article class="item">
            <header>
              <div>
                <h3>${escapeHtml(project.name)}</h3>
                <p>${escapeHtml(project.description || "No description")}</p>
              </div>
              <span class="pill">${project.member_count || 0} members</span>
            </header>
            ${state.user.role === "admin" ? `
              <form class="row-actions addMemberForm" data-project-id="${project.id}">
                <select name="userId" aria-label="User">${state.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join("")}</select>
                <button>Add member</button>
              </form>
            ` : ""}
          </article>
        `).join("") : `<div class="empty">No projects yet.</div>`}
      </div>
    </section>
  `);

  const projectForm = document.querySelector("#projectForm");
  if (projectForm) {
    projectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api("/projects", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(projectForm))) });
      await loadCore();
      renderProjects();
    });
  }

  document.querySelectorAll(".addMemberForm").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/projects/${form.dataset.projectId}/members`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadCore();
      renderProjects();
    });
  });
}

function taskCard(task) {
  return `
    <article class="item">
      <header>
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.description || task.project_name || "")}</p>
        </div>
        <span class="pill ${task.status}">${task.status.replace("_", " ")}</span>
      </header>
      <div class="meta">
        <span class="pill">${escapeHtml(task.project_name || "Project")}</span>
        <span class="pill ${task.priority}">${task.priority}</span>
        <span class="pill ${isOverdue(task) ? "overdue" : ""}">${fmtDate(task.due_date)}</span>
        <span class="pill">${escapeHtml(task.assignee_name || "Unassigned")}</span>
      </div>
      <form class="row-actions statusForm" data-task-id="${task.id}">
        <select name="status">
          ${["todo", "in_progress", "done"].map((status) => `<option value="${status}" ${task.status === status ? "selected" : ""}>${status.replace("_", " ")}</option>`).join("")}
        </select>
        <button class="secondary">Update</button>
      </form>
    </article>
  `;
}

function renderTasks() {
  shell(`
    <div class="topbar">
      <div class="page-title">
        <h1>Tasks</h1>
        <p>Create assignments and move work through delivery.</p>
      </div>
    </div>
    <section class="grid two-col">
      <div class="panel ${state.user.role !== "admin" ? "hidden" : ""}">
        <h2>New task</h2>
        <form class="form-grid" id="taskForm">
          <label>Project<select name="projectId" required>${projectOptions()}</select></label>
          <label>Title<input name="title" maxlength="140" required></label>
          <label>Description<textarea name="description"></textarea></label>
          <label>Assign to<select name="assignedTo">${userOptions()}</select></label>
          <label>Priority<select name="priority"><option>low</option><option selected>medium</option><option>high</option></select></label>
          <label>Due date<input name="dueDate" type="date"></label>
          <button ${state.projects.length ? "" : "disabled"}>Create task</button>
        </form>
      </div>
      <div class="item-list">
        ${state.tasks.length ? state.tasks.map(taskCard).join("") : `<div class="empty">No tasks yet.</div>`}
      </div>
    </section>
  `);

  const taskForm = document.querySelector("#taskForm");
  if (taskForm) {
    taskForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api("/tasks", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(taskForm))) });
      await loadCore();
      renderTasks();
    });
  }

  bindStatusForms(renderTasks);
}

function renderTeam() {
  shell(`
    <div class="topbar">
      <div class="page-title">
        <h1>Team</h1>
        <p>People with access to the workspace.</p>
      </div>
    </div>
    <section class="item-list">
      ${state.users.map((user) => `
        <article class="item">
          <header>
            <div>
              <h3>${escapeHtml(user.name)}</h3>
              <p>${escapeHtml(user.email)}</p>
            </div>
            <span class="pill">${user.role}</span>
          </header>
          ${state.user.role === "admin" && user.id !== state.user.id ? `
            <form class="row-actions roleForm" data-user-id="${user.id}">
              <select name="role">
                <option value="member" ${user.role === "member" ? "selected" : ""}>member</option>
                <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
              </select>
              <button class="secondary">Save role</button>
            </form>
          ` : ""}
        </article>
      `).join("")}
    </section>
  `);

  document.querySelectorAll(".roleForm").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/users/${form.dataset.userId}/role`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadCore();
      renderTeam();
    });
  });
}

function bindStatusForms(afterSave) {
  document.querySelectorAll(".statusForm").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await api(`/tasks/${form.dataset.taskId}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadCore();
      afterSave();
    });
  });
}

async function render() {
  if (!state.token || !state.user) {
    renderAuth();
    return;
  }

  try {
    if (!state.projects.length && !state.tasks.length) {
      await loadCore();
    }
    if (state.view === "dashboard") await renderDashboard();
    if (state.view === "projects") renderProjects();
    if (state.view === "tasks") renderTasks();
    if (state.view === "team") renderTeam();
  } catch (err) {
    if (err.message.toLowerCase().includes("auth")) {
      logout();
      return;
    }
    shell(`<div class="error">${escapeHtml(err.message)}</div>`);
  }
}

render();
