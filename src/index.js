require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const morgan = require("morgan");
const { Server } = require("socket.io");
const { setupSocketHandlers } = require("./socket/handlers");

const authRoutes = require("./routes/auth");
const orderRoutes = require("./routes/orders");
const tableRoutes = require("./routes/tables");
const menuRoutes = require("./routes/menu");
const kotRoutes = require("./routes/kot");
const inventoryRoutes = require("./routes/inventory");
const customerRoutes = require("./routes/customers");
const reportRoutes = require("./routes/reports");
const outletRoutes = require("./routes/outlets");
const couponRoutes = require("./routes/coupons");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Attach io to app so routes can emit events
app.set("io", io);

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/kot", kotRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/outlets", outletRoutes);
app.use("/api/coupons", couponRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📡 Socket.IO active`);
});
