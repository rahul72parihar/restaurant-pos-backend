const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
import { prisma } from "../utils/prisma.js";
const { authenticate } = require("../middleware/auth");


// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await prisma.user.findUnique({
      where: { email },
      include: { outlet: true },
    });

    if (!user || !user.isActive)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const { passwordHash, ...userSafe } = user;
    res.json({ token, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register (Admin only in prod)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, outletId } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email, password required" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists)
      return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role || "CASHIER", outletId },
    });

    const { passwordHash: _, ...userSafe } = user;
    res.status(201).json({ user: userSafe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  const { passwordHash, ...userSafe } = req.user;
  res.json({ user: userSafe });
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res) => {
  // Stateless JWT - client drops token
  res.json({ message: "Logged out" });
});

module.exports = router;
