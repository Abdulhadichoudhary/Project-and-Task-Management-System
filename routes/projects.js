const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { requiredString, isUuid } = require("../utils/validators");

const router = express.Router();

async function canAccessProject(projectId, user) {
  if (user.role === "admin") {
    const result = await db.query("SELECT id FROM projects WHERE id = $1", [projectId]);
    return Boolean(result.rows[0]);
  }

  const result = await db.query(
    "SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, user.id]
  );
  return Boolean(result.rows[0]);
}

router.get("/", requireAuth, async (req, res) => {
  const query = req.user.role === "admin"
    ? `SELECT p.*, u.name AS owner_name, COUNT(pm.user_id)::int AS member_count
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       LEFT JOIN project_members pm ON pm.project_id = p.id
       GROUP BY p.id, u.name
       ORDER BY p.created_at DESC`
    : `SELECT p.*, u.name AS owner_name, COUNT(pm_all.user_id)::int AS member_count
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       LEFT JOIN project_members pm_all ON pm_all.project_id = p.id
       GROUP BY p.id, u.name
       ORDER BY p.created_at DESC`;

  const result = await db.query(query, req.user.role === "admin" ? [] : [req.user.id]);
  res.json({ projects: result.rows });
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { name, description = "" } = req.body;
  const nameError = requiredString(name, "Project name", 120);

  if (nameError) {
    return res.status(400).json({ error: nameError });
  }

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const projectResult = await client.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), String(description).trim(), req.user.id]
    );
    await client.query(
      "INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [projectResult.rows[0].id, req.user.id]
    );
    await client.query("COMMIT");
    res.status(201).json({ project: projectResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Could not create project." });
  } finally {
    client.release();
  }
});

router.get("/:id/members", requireAuth, async (req, res) => {
  if (!isUuid(req.params.id) || !(await canAccessProject(req.params.id, req.user))) {
    return res.status(404).json({ error: "Project not found." });
  }

  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.role, pm.created_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY u.name ASC`,
    [req.params.id]
  );
  res.json({ members: result.rows });
});

router.post("/:id/members", requireAuth, requireAdmin, async (req, res) => {
  const { userId } = req.body;

  if (!isUuid(req.params.id) || !isUuid(userId)) {
    return res.status(400).json({ error: "Valid project and user IDs are required." });
  }

  const result = await db.query(
    `INSERT INTO project_members (project_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING project_id, user_id`,
    [req.params.id, userId]
  );

  if (!result.rows[0]) {
    return res.status(200).json({ message: "Member is already on this project." });
  }

  res.status(201).json({ member: result.rows[0] });
});

router.delete("/:id/members/:userId", requireAuth, requireAdmin, async (req, res) => {
  const result = await db.query(
    "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING project_id, user_id",
    [req.params.id, req.params.userId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "Project member not found." });
  }

  res.json({ removed: result.rows[0] });
});

module.exports = router;
