const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requiredString, validateEmail } = require("../utils/validators");
const { publicDatabaseError } = require("../utils/dbErrors");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev-secret-change-me",
    { expiresIn: "7d" }
  );
}

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const errors = [
    requiredString(name, "Name", 80),
    validateEmail(email),
    requiredString(password, "Password", 120)
  ].filter(Boolean);

  if (password && password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (errors.length) {
    return res.status(400).json({ error: errors[0], errors });
  }

  try {
    const countResult = await db.query("SELECT COUNT(*)::int AS count FROM users");
    const role = countResult.rows[0].count === 0 ? "admin" : "member";
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, LOWER($2), $3, $4)
       RETURNING id, name, email, role`,
      [name.trim(), email.trim(), passwordHash, role]
    );
    const user = result.rows[0];

    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    console.error(error);
    const publicError = publicDatabaseError(error, "Could not create account.");
    res.status(publicError.status).json({ error: publicError.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const emailError = validateEmail(email);

  if (emailError || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required." });
  }

  let user;
  try {
    const result = await db.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = LOWER($1)",
      [email.trim()]
    );
    user = result.rows[0];
  } catch (error) {
    console.error(error);
    const publicError = publicDatabaseError(error, "Could not login.");
    return res.status(publicError.status).json({ error: publicError.message });
  }

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  delete user.password_hash;
  res.json({ token: signToken(user), user });
});

router.get("/me", requireAuth, async (req, res) => {
  const result = await db.query("SELECT id, name, email, role FROM users WHERE id = $1", [req.user.id]);

  if (!result.rows[0]) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user: result.rows[0] });
});

module.exports = router;
