const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const prisma = require("../utils/prisma");

// GET /api/menu/categories
router.get("/categories", authenticate, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
        _count: { select: { menuItems: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/menu/categories
router.post("/categories", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { name, parentId, image, sortOrder } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    const cat = await prisma.category.create({
      data: { name, slug, parentId: parentId || null, image, sortOrder: sortOrder || 0 },
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/menu/items
router.get("/items", authenticate, async (req, res) => {
  try {
    const { categoryId, isAvailable, isVeg, search } = req.query;
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (isAvailable !== undefined) where.isAvailable = isAvailable === "true";
    if (isVeg !== undefined) where.isVeg = isVeg === "true";
    if (search) where.name = { contains: search, mode: "insensitive" };

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true, variants: true, addons: true },
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/menu/items
router.post("/items", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { name, description, price, categoryId, isVeg, gstRate, hsnCode, variants, addons } = req.body;
    const item = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        categoryId,
        isVeg: isVeg !== false,
        gstRate: gstRate || 5,
        hsnCode,
        variants: variants?.length ? { create: variants } : undefined,
        addons: addons?.length ? { create: addons } : undefined,
      },
      include: { variants: true, addons: true, category: true },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/menu/items/:id
router.patch("/items/:id", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: req.body,
      include: { variants: true, addons: true },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/menu/items/:id/toggle
router.patch("/items/:id/toggle", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const item = await prisma.menuItem.findUnique({ where: { id: req.params.id } });
    const updated = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: { isAvailable: !item.isAvailable },
    });
    req.app.get("io").emit("menu:updated", updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/menu/items/:id
router.delete("/items/:id", authenticate, authorize("ADMIN"), async (req, res) => {
  try {
    await prisma.menuItem.update({
      where: { id: req.params.id },
      data: { isAvailable: false },
    });
    res.json({ message: "Item disabled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
