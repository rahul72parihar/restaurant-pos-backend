const router = require("express").Router();
const prisma = require("../utils/prisma");
const { authenticate, authorize } = require("../middleware/auth");

// GET /api/coupons
router.get("/", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({
      include: { _count: { select: { uses: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(coupons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coupons/validate
router.post("/validate", authenticate, async (req, res) => {
  try {
    const { code, orderAmount, customerId } = req.body;
    const coupon = await prisma.coupon.findUnique({ where: { code } });

    if (!coupon) return res.status(404).json({ error: "Invalid coupon code" });
    if (!coupon.isActive) return res.status(400).json({ error: "Coupon is inactive" });
    if (new Date() > coupon.validUntil) return res.status(400).json({ error: "Coupon expired" });
    if (new Date() < coupon.validFrom) return res.status(400).json({ error: "Coupon not yet active" });
    if (orderAmount < coupon.minOrder) {
      return res.status(400).json({ error: `Minimum order ₹${coupon.minOrder} required` });
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    const discount =
      coupon.type === "PERCENT"
        ? Math.min((orderAmount * coupon.value) / 100, orderAmount)
        : Math.min(coupon.value, orderAmount);

    res.json({ valid: true, coupon, discount: parseFloat(discount.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/coupons
router.post("/", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const coupon = await prisma.coupon.create({ data: req.body });
    res.status(201).json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/coupons/:id
router.patch("/:id", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data: req.body });
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
