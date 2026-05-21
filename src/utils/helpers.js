const { v4: uuidv4 } = require("uuid");

/**
 * Generates a unique order number like ORD-20240521-0001
 */
const generateOrderNumber = () => {
  const date = new Date();
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${datePart}-${rand}`;
};

/**
 * Calculate GST breakdown (CGST + SGST for intra-state)
 * @param {number} amount - taxable amount
 * @param {number} rate - total GST rate (e.g. 5 for 5%)
 */
const calculateGST = (amount, rate = 5) => {
  return parseFloat(((amount * rate) / 100).toFixed(2));
};

const gstBreakup = (amount, rate = 5) => {
  const total = calculateGST(amount, rate);
  return {
    cgst: parseFloat((total / 2).toFixed(2)),
    sgst: parseFloat((total / 2).toFixed(2)),
    igst: 0,
    total,
  };
};

/**
 * Format currency in INR
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

/**
 * Paginate helper
 */
const paginate = (page = 1, limit = 20) => ({
  skip: (Number(page) - 1) * Number(limit),
  take: Number(limit),
});

module.exports = { generateOrderNumber, calculateGST, gstBreakup, formatCurrency, paginate };
