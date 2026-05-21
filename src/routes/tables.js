const router = require("express").Router();
const { PrismaClient } = require("@prisma/client");
const { authenticate, authorize } = require("../middleware/auth");

const prisma = new PrismaClient();

// GET /api/tables
router.get("/", authenticate, async (req, res) => {
  try {
    const { outletId, status, section } = req.query;
    const where = {};
    if (outletId) where.outletId = outletId;
    if (status) where.status = status;
    if (section) where.section = section;

    const tables = await prisma.table.findMany({
      where,
      include: {
        orders: {
          where: { status: { notIn: ["PAID", "CANCELLED"] } },
          include: { items: { include: { menuItem: true } }, payments: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        assignments: { include: { waiter: { select: { id: true, name: true } } } },
        bookings: {
          where: { status: { in: ["PENDING", "CONFIRMED"] } },
          orderBy: { date: "asc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    });
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables
router.post("/", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { number, name, capacity, section, outletId, posX, posY } = req.body;
    const table = await prisma.table.create({
      data: {
        number: parseInt(number),
        name,
        capacity: parseInt(capacity),
        section: section || "Main",
        outletId,
        posX: posX || 0,
        posY: posY || 0,
      },
    });
    res.status(201).json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tables/:id
router.patch("/:id", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const table = await prisma.table.update({
      where: { id: req.params.id },
      data: req.body,
    });
    req.app.get("io").emit("table:updated", table);
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tables/:id/status
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const table = await prisma.table.update({
      where: { id: req.params.id },
      data: { status },
    });
    req.app.get("io").emit("table:updated", table);
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables/:id/assign
router.post("/:id/assign", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { waiterId, orderId } = req.body;
    await prisma.tableAssignment.deleteMany({ where: { tableId: req.params.id } });
    const assignment = await prisma.tableAssignment.create({
      data: { tableId: req.params.id, waiterId, orderId: orderId || null },
      include: { waiter: { select: { id: true, name: true } } },
    });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables/merge
router.post("/merge", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { sourceTableId, targetTableId } = req.body;
    // Move all active orders from source to target
    await prisma.order.updateMany({
      where: { tableId: sourceTableId, status: { notIn: ["PAID", "CANCELLED"] } },
      data: { tableId: targetTableId },
    });
    await prisma.table.update({ where: { id: sourceTableId }, data: { status: "AVAILABLE" } });
    req.app.get("io").emit("tables:merged", { sourceTableId, targetTableId });
    res.json({ message: "Tables merged" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tables/bookings
router.post("/bookings", authenticate, async (req, res) => {
  try {
    const { tableId, customerName, phone, guestCount, date, notes } = req.body;
    const booking = await prisma.booking.create({
      data: {
        tableId,
        customerName,
        phone,
        guestCount: parseInt(guestCount),
        date: new Date(date),
        notes,
        status: "CONFIRMED",
      },
      include: { table: true },
    });
    await prisma.table.update({ where: { id: tableId }, data: { status: "RESERVED" } });
    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tables/bookings
router.get("/bookings", authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const where = {};
    if (date) {
      const d = new Date(date);
      where.date = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: { table: true },
      orderBy: { date: "asc" },
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
