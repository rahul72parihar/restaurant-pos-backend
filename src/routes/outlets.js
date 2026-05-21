const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const prisma = new PrismaClient();

// GET /api/outlets
router.get("/", authenticate, async (req, res) => {
  try {
    const outlets = await prisma.outlet.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { tables: true, orders: true, users: true } },
      },
    });
    res.json(outlets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/outlets
router.post("/", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const outlet = await prisma.outlet.create({ data: req.body });
    res.status(201).json(outlet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/outlets/:id
router.patch("/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    const outlet = await prisma.outlet.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(outlet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
