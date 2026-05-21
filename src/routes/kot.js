const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");

const prisma = new PrismaClient();

// GET /api/kot - All active KOTs (kitchen display)
router.get("/", authenticate, async (req, res) => {
  try {
    const { kitchen, status, outletId } = req.query;
    const where = {};
    if (kitchen) where.kitchen = kitchen;
    if (status) where.status = status;
    else where.status = { notIn: ["DELIVERED"] };

    const kots = await prisma.kOT.findMany({
      where,
      include: {
        items: {
          include: { menuItem: { select: { id: true, name: true, isVeg: true } } },
        },
        order: {
          include: { table: { select: { number: true, name: true } } },
        },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json(kots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/kot/:id/status
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date();
    const updateData = { status };
    if (status === "PREPARING") updateData.startedAt = now;
    if (status === "READY") updateData.readyAt = now;

    const kot = await prisma.kOT.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        items: { include: { menuItem: true } },
        order: { include: { table: true } },
      },
    });

    // Update order items status
    const itemStatusMap = {
      PREPARING: "PREPARING",
      READY: "READY",
      DELIVERED: "SERVED",
    };
    if (itemStatusMap[status]) {
      await prisma.orderItem.updateMany({
        where: { kotId: kot.id },
        data: { status: itemStatusMap[status] },
      });
    }

    // Update parent order status
    if (status === "PREPARING") {
      await prisma.order.update({ where: { id: kot.orderId }, data: { status: "PREPARING" } });
    }
    if (status === "READY") {
      const allKots = await prisma.kOT.findMany({ where: { orderId: kot.orderId } });
      if (allKots.every((k) => ["READY", "DELIVERED"].includes(k.status))) {
        await prisma.order.update({ where: { id: kot.orderId }, data: { status: "READY" } });
      }
    }

    req.app.get("io").emit("kot:updated", kot);
    res.json(kot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/kot/:id/priority
router.patch("/:id/priority", authenticate, async (req, res) => {
  try {
    const { priority } = req.body;
    const kot = await prisma.kOT.update({
      where: { id: req.params.id },
      data: { priority: parseInt(priority) },
    });
    req.app.get("io").emit("kot:updated", kot);
    res.json(kot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kot/kitchens - List all kitchen stations
router.get("/kitchens", authenticate, async (req, res) => {
  try {
    const kitchens = await prisma.kOT.groupBy({
      by: ["kitchen"],
      _count: { kitchen: true },
    });
    res.json(kitchens.map((k) => k.kitchen));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
