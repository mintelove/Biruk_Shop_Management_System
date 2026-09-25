import express from "express";
import { getCategories, createCategory, deleteCategory, updateCategory } from "../controllers/categoryController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getCategories);
router.post("/", protect, authorize("admin", "purchaser", "salesman"), createCategory);
router.put("/:id", protect, authorize("admin", "purchaser", "salesman"), updateCategory);
router.delete("/:id", protect, authorize("admin", "purchaser", "salesman"), deleteCategory);

export default router;
