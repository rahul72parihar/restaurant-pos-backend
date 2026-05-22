const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const prisma = require("../utils/prisma");

// GET /api/inventory
router.get("/", authenticate, async (req, res) => {
  try {
    const { outletId, lowStock } = req.query;
    const where = {};
    if (outletId) where.outletId = outletId;
    if (lowStock === "true") {
      where.currentStock = { lte: prisma.inventoryItem.fields.minStock };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: { supplier: true },
      orderBy: { name: "asc" },
    });

    // Flag low stock
    const flagged = items.map((item) => ({
      ...item,
      isLowStock: item.currentStock <= item.minStock,
    }));

    res.json(flagged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/low-stock
router.get("/low-stock", authenticate, async (req, res) => {
  try {
    const items = await prisma.$queryRaw`
      SELECT * FROM "InventoryItem" WHERE "currentStock" <= "minStock"
    `;
    res.json(items);
  } catch (err) {
    // Fallback for SQLite
    const items = await prisma.inventoryItem.findMany();
    res.json(items.filter((i) => i.currentStock <= i.minStock));
  }
});

// POST /api/inventory
router.post("/", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { name, unit, currentStock, minStock, costPerUnit, supplierId, outletId } = req.body;
    const item = await prisma.inventoryItem.create({
      data: {
        name,
        unit,
        currentStock: parseFloat(currentStock) || 0,
        minStock: parseFloat(minStock) || 0,
        costPerUnit: parseFloat(costPerUnit) || 0,
        supplierId: supplierId || null,
        outletId,
      },
      include: { supplier: true },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/inventory/:id
router.patch("/:id", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: req.body,
      include: { supplier: true },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/:id/adjust
router.post("/:id/adjust", authenticate, async (req, res) => {
  try {
    const { qty, reason, type } = req.body; // type: "add" | "remove"
    const item = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    const newStock = type === "add"
      ? item.currentStock + parseFloat(qty)
      : item.currentStock - parseFloat(qty);

    const updated = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: { currentStock: Math.max(0, newStock) },
    });

    if (type === "remove") {
      await prisma.wastageLog.create({
        data: { inventoryItemId: req.params.id, qty: parseFloat(qty), reason },
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/suppliers
router.get("/suppliers", authenticate, async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { isActive: true },
      include: { _count: { select: { inventory: true, purchases: true } } },
      orderBy: { name: "asc" },
    });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/suppliers
router.post("/suppliers", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/purchases
router.post("/purchases", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { outletId, supplierId, items, invoice, notes } = req.body;
    const total = items.reduce((s, i) => s + i.qty * i.unitCost, 0);

    const purchase = await prisma.purchase.create({
      data: {
        outletId,
        supplierId: supplierId || null,
        total,
        invoice,
        notes,
        items: {
          create: items.map((i) => ({
            inventoryItemId: i.inventoryItemId,
            qty: parseFloat(i.qty),
            unitCost: parseFloat(i.unitCost),
          })),
        },
      },
      include: { items: { include: { inventoryItem: true } } },
    });

    // Update stock
    for (const item of items) {
      await prisma.inventoryItem.update({
        where: { id: item.inventoryItemId },
        data: { currentStock: { increment: parseFloat(item.qty) } },
      });
    }

    res.status(201).json(purchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/purchases
router.get("/purchases", authenticate, async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
      },
      orderBy: { purchasedAt: "desc" },
      take: 50,
    });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/wastage
router.get("/wastage", authenticate, async (req, res) => {
  try {
    const logs = await prisma.wastageLog.findMany({
      include: { inventoryItem: true },
      orderBy: { loggedAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
