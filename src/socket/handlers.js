/**
 * Socket.IO Real-time Event Handlers
 *
 * Rooms:
 *   outlet:{outletId}   - all staff in an outlet
 *   kitchen:{kitchen}   - kitchen display screens
 *   table:{tableId}     - table-specific updates
 *   role:{role}         - role-based broadcasts
 */

const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join outlet room
    socket.on("join:outlet", (outletId) => {
      socket.join(`outlet:${outletId}`);
      console.log(`Socket ${socket.id} joined outlet:${outletId}`);
    });

    // Join kitchen display
    socket.on("join:kitchen", (kitchen) => {
      socket.join(`kitchen:${kitchen}`);
      console.log(`Socket ${socket.id} joined kitchen:${kitchen}`);
    });

    // Join role-based room
    socket.on("join:role", (role) => {
      socket.join(`role:${role}`);
    });

    // KOT status update from kitchen
    socket.on("kot:update", (data) => {
      // { kotId, status, outletId }
      io.to(`outlet:${data.outletId}`).emit("kot:updated", data);
    });

    // Item ready notification
    socket.on("item:ready", (data) => {
      // { orderId, itemId, tableId }
      io.emit("item:ready", data);
    });

    // Table status changed
    socket.on("table:update", (data) => {
      io.emit("table:updated", data);
    });

    // Order item status
    socket.on("orderItem:update", (data) => {
      io.emit("orderItem:updated", data);
    });

    // Waiter call from QR order
    socket.on("call:waiter", (data) => {
      io.to(`role:WAITER`).emit("waiter:called", data);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupSocketHandlers };
