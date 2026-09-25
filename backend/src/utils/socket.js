let ioInstance;

export const setSocketInstance = (io) => {
  ioInstance = io;
};

export const getSocketInstance = () => ioInstance;

export const emitStockUpdate = (payload) => {
  if (ioInstance) {
    ioInstance.emit("stock:update", payload);
  }
};

/**
 * Emit a notification event to all connected clients.
 * Clients filter based on their own user ID / role.
 */
export const emitNotification = (notification) => {
  if (ioInstance) {
    ioInstance.emit("notification:new", notification);
  }
};
