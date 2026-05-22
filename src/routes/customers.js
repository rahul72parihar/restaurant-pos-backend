const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const prisma = require("../utils/prisma");

// GET /api/customers
router.get("/", authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { totalSpend: "desc" },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ customers, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        orders: {
          include: { items: { include: { menuItem: true } }, payments: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        coupons: { include: { coupon: true } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/phone/:phone
router.get("/phone/:phone", authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { phone: req.params.phone },
    });
    res.json(customer || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post("/", authenticate, async (req, res) => {
  try {
    const { name, phone, email, dob, notes } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone required" });

    const exists = await prisma.customer.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ error: "Customer already exists", customer: exists });

    const customer = await prisma.customer.create({
      data: { name, phone, email, dob: dob ? new Date(dob) : null, notes },
    });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/customers/:id
router.patch("/:id", authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/:id/redeem-points
router.post("/:id/redeem-points", authenticate, async (req, res) => {
  try {
    const { points } = req.body;
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (customer.loyaltyPoints < points)
      return res.status(400).json({ error: "Insufficient loyalty points" });

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { loyaltyPoints: { decrement: parseInt(points) } },
    });
    const discountValue = parseFloat(points) / 10; // 10 pts = ₹1
    res.json({ customer: updated, discountValue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
