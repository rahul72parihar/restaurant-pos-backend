const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const prisma = require("../utils/prisma");

const dayRange = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date();
  return {
    gte: new Date(new Date(d).setHours(0, 0, 0, 0)),
    lte: new Date(new Date(d).setHours(23, 59, 59, 999)),
  };
};

const monthRange = (year, month) => {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return { gte: from, lte: to };
};

// GET /api/reports/dashboard - KPI summary
router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const { outletId, date } = req.query;
    const createdAt = dayRange(date);
    const where = { createdAt, status: { notIn: ["CANCELLED"] } };
    if (outletId) where.outletId = outletId;

    const [orders, totalRevenue, paidOrders, topItems, tableStats] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.aggregate({ where: { ...where, status: "PAID" }, _sum: { total: true } }),
      prisma.order.count({ where: { ...where, status: "PAID" } }),
      prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { order: { createdAt, status: "PAID" } },
        _sum: { qty: true },
        _count: { menuItemId: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
      prisma.table.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const topMenuItems = await Promise.all(
      topItems.map(async (t) => {
        const item = await prisma.menuItem.findUnique({ where: { id: t.menuItemId } });
        return { ...item, qtySold: t._sum.qty };
      })
    );

    res.json({
      todayOrders: orders,
      todayRevenue: totalRevenue._sum.total || 0,
      paidOrders,
      avgOrderValue: paidOrders ? (totalRevenue._sum.total || 0) / paidOrders : 0,
      topItems: topMenuItems,
      tableStats: tableStats.reduce((acc, t) => ({ ...acc, [t.status]: t._count.status }), {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales - Daily/Monthly sales
router.get("/sales", authenticate, async (req, res) => {
  try {
    const { outletId, from, to, groupBy = "day" } = req.query;
    const where = {
      status: "PAID",
      createdAt: {
        gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: to ? new Date(to) : new Date(),
      },
    };
    if (outletId) where.outletId = outletId;

    const orders = await prisma.order.findMany({
      where,
      select: { total: true, subtotal: true, gstAmt: true, discountAmt: true, type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const grouped = {};
    orders.forEach((o) => {
      const key = o.createdAt.toISOString().slice(0, 10);
      if (!grouped[key]) grouped[key] = { date: key, revenue: 0, orders: 0, gst: 0, discount: 0 };
      grouped[key].revenue += o.total;
      grouped[key].orders += 1;
      grouped[key].gst += o.gstAmt;
      grouped[key].discount += o.discountAmt;
    });

    res.json({
      data: Object.values(grouped),
      total: orders.reduce((s, o) => s + o.total, 0),
      totalOrders: orders.length,
      totalGst: orders.reduce((s, o) => s + o.gstAmt, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/gst - GST report
router.get("/gst", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { from, to, outletId } = req.query;
    const where = {
      status: "PAID",
      createdAt: {
        gte: from ? new Date(from) : new Date(new Date().setDate(1)),
        lte: to ? new Date(to) : new Date(),
      },
    };
    if (outletId) where.outletId = outletId;

    const orders = await prisma.order.findMany({
      where,
      select: { orderNumber: true, total: true, gstAmt: true, subtotal: true, createdAt: true },
    });

    const totalGst = orders.reduce((s, o) => s + o.gstAmt, 0);
    const cgst = totalGst / 2;
    const sgst = totalGst / 2;

    res.json({
      orders,
      summary: {
        taxableAmount: orders.reduce((s, o) => s + o.subtotal, 0),
        cgst,
        sgst,
        igst: 0,
        totalGst,
        totalRevenue: orders.reduce((s, o) => s + o.total, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/items - Top selling items
router.get("/items", authenticate, async (req, res) => {
  try {
    const { from, to, outletId, limit = 20 } = req.query;
    const dateWhere = {
      gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lte: to ? new Date(to) : new Date(),
    };

    const items = await prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: { order: { createdAt: dateWhere, status: "PAID" } },
      _sum: { qty: true, unitPrice: true },
      _count: { menuItemId: true },
      orderBy: { _sum: { qty: "desc" } },
      take: Number(limit),
    });

    const enriched = await Promise.all(
      items.map(async (i) => {
        const item = await prisma.menuItem.findUnique({
          where: { id: i.menuItemId },
          include: { category: true },
        });
        return {
          ...item,
          qtySold: i._sum.qty,
          revenue: i._sum.unitPrice * i._sum.qty,
          orderCount: i._count.menuItemId,
        };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/staff - Staff performance
router.get("/staff", authenticate, authorize("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateWhere = {
      gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      lte: to ? new Date(to) : new Date(),
    };

    const staffOrders = await prisma.order.groupBy({
      by: ["createdById"],
      where: { createdAt: dateWhere, status: "PAID" },
      _count: { id: true },
      _sum: { total: true },
    });

    const enriched = await Promise.all(
      staffOrders.map(async (s) => {
        const user = await prisma.user.findUnique({
          where: { id: s.createdById },
          select: { id: true, name: true, role: true },
        });
        return { ...user, orderCount: s._count.id, revenue: s._sum.total };
      })
    );
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/payment-methods
router.get("/payment-methods", authenticate, async (req, res) => {
  try {
    const { from, to, outletId } = req.query;
    const dateWhere = {
      gte: from ? new Date(from) : new Date(new Date().setDate(1)),
      lte: to ? new Date(to) : new Date(),
    };

    const payments = await prisma.payment.groupBy({
      by: ["method"],
      where: { createdAt: dateWhere },
      _sum: { amount: true },
      _count: { method: true },
    });

    res.json(payments.map((p) => ({
      method: p.method,
      total: p._sum.amount,
      count: p._count.method,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
