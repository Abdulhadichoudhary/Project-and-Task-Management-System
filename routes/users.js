const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await db.query(
    "SELECT id, name, email, role, created_at FROM users ORDER BY name ASC"
  );
  res.json({ users: result.rows });
});

router.patch("/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const { role } = req.body;

  if (!["admin", "member"].includes(role)) {
    return res.status(400).json({ error: "Role must be admin or member." });
  }

  const result = await db.query(
    "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role",
    [role, req.params.id]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user: result.rows[0] });
});

module.exports = router;
