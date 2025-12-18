import express from "express";
import { blogController } from "../controllers/blogController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", blogController.getAll);
router.get("/:id", blogController.getById);

// Protected routes (require authentication)
router.post("/", authenticate, blogController.create);
router.put("/:id", authenticate, blogController.update);
router.delete("/:id", authenticate, blogController.delete);

// User-specific routes
router.get("/user/my-blogs", authenticate, blogController.getMyBlogs);
router.get("/user/saved", authenticate, blogController.getSavedBlogs);

// Save/unsave blog
router.post("/:id/save", authenticate, blogController.saveBlog);
router.delete("/:id/save", authenticate, blogController.unsaveBlog);

export default router;
