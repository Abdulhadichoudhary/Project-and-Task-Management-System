const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { requiredString, isUuid } = require("../utils/validators");

const router = express.Router();

async function canAccessTask(taskId, user) {
  const result = await db.query(
    `SELECT t.*
     FROM tasks t
     LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $2
     WHERE t.id = $1 AND ($3 = 'admin' OR pm.user_id IS NOT NULL)`,
    [taskId, user.id, user.role]
  );
  return result.rows[0];
}

router.get("/", requireAuth, async (req, res) => {
  const { projectId, assignedTo } = req.query;
  const filters = [];
  const params = [];

  if (projectId) {
    params.push(projectId);
    filters.push(`t.project_id = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    filters.push(`t.assigned_to = $${params.length}`);
  }

  if (req.user.role !== "admin") {
    params.push(req.user.id);
    filters.push(`(t.assigned_to = $${params.length} OR pm.user_id = $${params.length})`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await db.query(
    `SELECT t.*, p.name AS project_name, assignee.name AS assignee_name, creator.name AS creator_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     JOIN users creator ON creator.id = t.created_by
     LEFT JOIN users assignee ON assignee.id = t.assigned_to
     LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $${params.length + 1}
     ${where}
     ORDER BY
       CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
       t.due_date NULLS LAST,
       t.created_at DESC`,
    [...params, req.user.id]
  );

  res.json({ tasks: result.rows });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const {
    projectId,
    title,
    description = "",
    assignedTo = null,
    status = "todo",
    priority = "medium",
    dueDate = null
  } = req.body;
  const titleError = requiredString(title, "Task title", 140);

  if (!isUuid(projectId) || titleError) {
    return res.status(400).json({ error: titleError || "A valid project is required." });
  }

  if (!["todo", "in_progress", "done"].includes(status) || !["low", "medium", "high"].includes(priority)) {
    return res.status(400).json({ error: "Invalid task status or priority." });
  }

  if (assignedTo && !isUuid(assignedTo)) {
    return res.status(400).json({ error: "Assigned user is invalid." });
  }

  const projectResult = await db.query("SELECT id FROM projects WHERE id = $1", [projectId]);
  if (!projectResult.rows[0]) {
    return res.status(404).json({ error: "Project not found." });
  }

  if (assignedTo) {
    const memberResult = await db.query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [projectId, assignedTo]
    );
    if (!memberResult.rows[0]) {
      return res.status(400).json({ error: "Assignee must be a member of the project." });
    }
  }

  const result = await db.query(
    `INSERT INTO tasks (project_id, title, description, assigned_to, created_by, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [projectId, title.trim(), String(description).trim(), assignedTo || null, req.user.id, status, priority, dueDate || null]
  );

  res.status(201).json({ task: result.rows[0] });
});

router.patch("/:id", requireAuth, async (req, res) => {
  const task = await canAccessTask(req.params.id, req.user);

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  const allowedForMember = ["status"];
  const allowedForAdmin = ["title", "description", "assignedTo", "status", "priority", "dueDate"];
  const allowed = req.user.role === "admin" ? allowedForAdmin : allowedForMember;
  const updates = Object.keys(req.body).filter((key) => allowed.includes(key));

  if (!updates.length) {
    return res.status(400).json({ error: "No permitted task fields were provided." });
  }

  if (req.body.status && !["todo", "in_progress", "done"].includes(req.body.status)) {
    return res.status(400).json({ error: "Invalid task status." });
  }

  if (req.body.priority && !["low", "medium", "high"].includes(req.body.priority)) {
    return res.status(400).json({ error: "Invalid task priority." });
  }

  if (req.body.assignedTo) {
    const memberResult = await db.query(
      "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
      [task.project_id, req.body.assignedTo]
    );
    if (!memberResult.rows[0]) {
      return res.status(400).json({ error: "Assignee must be a member of the project." });
    }
  }

  const fieldMap = {
    title: "title",
    description: "description",
    assignedTo: "assigned_to",
    status: "status",
    priority: "priority",
    dueDate: "due_date"
  };
  const values = updates.map((key) => req.body[key] === "" ? null : req.body[key]);
  const setSql = updates.map((key, index) => `${fieldMap[key]} = $${index + 1}`).join(", ");
  values.push(req.params.id);

  const result = await db.query(
    `UPDATE tasks SET ${setSql}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  res.json({ task: result.rows[0] });
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING id", [req.params.id]);

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Task not found." });
  }

  res.json({ deleted: result.rows[0].id });
});

module.exports = router;
