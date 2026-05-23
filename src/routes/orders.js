const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const { generateOrderNumber, calculateGST } = require("../utils/helpers");
const prisma = require("../utils/prisma");

// GET /api/orders
router.get("/", authenticate, async (req, res) => {
  try {
    const { status, type, tableId, outletId, date, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (tableId) where.tableId = tableId;
    if (outletId) where.outletId = outletId;
    if (date) {
      const d = new Date(date);
      where.createdAt = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { menuItem: true } },
          table: true,
          customer: true,
          payments: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { menuItem: { include: { variants: true, addons: true } } } },
        table: true,
        customer: true,
        payments: true,
        kot: true,
        invoice: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders - Create new order
router.post("/", authenticate, async (req, res) => {
  try {
    const { type, tableId, customerId, items, couponCode, notes, deliveryAddr } = req.body;
    if (!items?.length) return res.status(400).json({ error: "Items required" });

    const outletId = req.user.outletId || req.body.outletId;

    // Validate & price items
    let subtotal = 0;
    const priceItems = [];

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
        include: { variants: true, addons: true },
      });
      if (!menuItem) return res.status(400).json({ error: `Item ${item.menuItemId} not found` });

      let unitPrice = menuItem.price;
      if (item.variantId) {
        const variant = menuItem.variants.find((v) => v.id === item.variantId);
        if (variant) unitPrice += variant.priceAdj;
      }
      if (item.addonIds?.length) {
        for (const addonId of item.addonIds) {
          const addon = menuItem.addons.find((a) => a.id === addonId);
          if (addon) unitPrice += addon.price;
        }
      }

      subtotal += unitPrice * item.qty;
      priceItems.push({
        menuItemId: item.menuItemId,
        qty: item.qty,
        unitPrice,
        variantId: item.variantId || null,
        addons: item.addonIds ? JSON.stringify(item.addonIds) : null,
        notes: item.notes || null,
        status: "PENDING",
      });
    }

    // Coupon
    let discountAmt = 0;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (coupon && coupon.isActive && new Date() <= coupon.validUntil && subtotal >= coupon.minOrder) {
        discountAmt = coupon.type === "PERCENT"
          ? Math.min(subtotal * (coupon.value / 100), subtotal)
          : Math.min(coupon.value, subtotal);
      }
    }

    const afterDiscount = subtotal - discountAmt;
    const gstAmt = calculateGST(afterDiscount);
    const total = afterDiscount + gstAmt;

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        type: type || "DINE_IN",
        status: "PENDING",
        tableId: tableId || null,
        outletId,
        createdById: req.user.id,
        customerId: customerId || null,
        subtotal,
        discountAmt,
        gstAmt,
        total,
        couponCode: couponCode || null,
        notes: notes || null,
        deliveryAddr: deliveryAddr || null,
        items: { create: priceItems },
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        customer: true,
      },
    });

    // Update table status
    if (tableId && type === "DINE_IN") {
      await prisma.table.update({ where: { id: tableId }, data: { status: "OCCUPIED" } });
    }

    // Emit socket event
    req.app.get("io").emit("order:created", order);

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", authenticate, authorize("ADMIN", "MANAGER", "CASHIER"), async (req, res) => {

  try {
    const { status } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        completedAt: ["PAID", "CANCELLED"].includes(status) ? new Date() : undefined,
      },
    });

    // Free table if order completed
    if (["PAID", "CANCELLED"].includes(status) && order.tableId) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: "AVAILABLE" },
      });
    }

    req.app.get("io").emit("order:updated", order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/:id/payment - Process payment
router.post("/:id/payment", authenticate, async (req, res) => {
  try {
    const { payments } = req.body; // [{ method, amount, reference }]
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    const [paymentsCreated] = await prisma.$transaction([
      prisma.payment.createMany({
        data: payments.map((p) => ({
          orderId: order.id,
          method: p.method,
          amount: p.amount,
          reference: p.reference || null,
        })),
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAmount: totalPaid,
          completedAt: new Date(),
        },
      }),
    ]);

    // Update loyalty points
    if (order.customerId) {
      const pts = Math.floor(totalPaid / 10);
      await prisma.customer.update({
        where: { id: order.customerId },
        data: {
          loyaltyPoints: { increment: pts },
          totalSpend: { increment: totalPaid },
          visitCount: { increment: 1 },
        },
      });
    }

    // Generate invoice number
    const invCount = await prisma.invoice.count();
    await prisma.invoice.create({
      data: {
        orderId: order.id,
        invoiceNo: `INV-${String(invCount + 1).padStart(6, "0")}`,
      },
    });

    req.app.get("io").emit("order:paid", { orderId: order.id });
    res.json({ message: "Payment processed", totalPaid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/:id/kot - Send items to kitchen
router.post("/:id/kot", authenticate, async (req, res) => {
  try {
    const { itemIds, kitchen } = req.body;
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const kotCount = await prisma.kOT.count();
    const kot = await prisma.kOT.create({
      data: {
        kotNumber: `KOT-${String(kotCount + 1).padStart(4, "0")}`,
        orderId: order.id,
        kitchen: kitchen || "Main Kitchen",
        status: "PENDING",
      },
    });

    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds }, orderId: order.id },
      data: { status: "SENT_TO_KITCHEN", kotId: kot.id },
    });

    await prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });

    const fullKot = await prisma.kOT.findUnique({
      where: { id: kot.id },
      include: { items: { include: { menuItem: true } }, order: { include: { table: true } } },
    });

    req.app.get("io").emit("kot:new", fullKot);
    res.status(201).json(fullKot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
