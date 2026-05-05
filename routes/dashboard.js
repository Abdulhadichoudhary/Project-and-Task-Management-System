const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const params = [req.user.id, req.user.role];
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE t.status = 'todo')::int AS todo,
       COUNT(*) FILTER (WHERE t.status = 'in_progress')::int AS in_progress,
       COUNT(*) FILTER (WHERE t.status = 'done')::int AS done,
       COUNT(*) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE)::int AS overdue
     FROM tasks t
     LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
     WHERE ($2 = 'admin' OR t.assigned_to = $1 OR pm.user_id IS NOT NULL)`,
    params
  );

  const dueSoon = await db.query(
    `SELECT t.id, t.title, t.status, t.priority, t.due_date, p.name AS project_name, u.name AS assignee_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assigned_to
     LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
     WHERE ($2 = 'admin' OR t.assigned_to = $1 OR pm.user_id IS NOT NULL)
       AND t.status != 'done'
     ORDER BY t.due_date NULLS LAST, t.priority DESC
     LIMIT 8`,
    params
  );

  res.json({ stats: result.rows[0], dueSoon: dueSoon.rows });
});

module.exports = router;
