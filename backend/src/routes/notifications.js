import express from "express";
import { Notification } from "../models/Notification.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Get all notifications for the logged-in salesman
router.get("/", protect, authorize("salesman"), async (req, res, next) => {
  try {
    const notifications = await Notification.find({ salesman_id: req.user._id })
      .populate("transaction_id")
      .sort({ createdAt: -1 });

    res.json({ success: true, notifications });
  } catch (error) {
    next(error);
  }
});

// Mark a single notification as read
router.patch("/:id/read", protect, authorize("salesman"), async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, salesman_id: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    res.json({ success: true, notification });
  } catch (error) {
    next(error);
  }
});

export default router;
