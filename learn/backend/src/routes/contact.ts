import { Router } from "express";
import { contactController } from "../controllers/contactController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Public route - submit contact form
router.post("/", contactController.submitContact);

// Admin routes
router.get(
  "/messages",
  authenticate,
  authorize("admin"),
  contactController.getAllMessages
);

router.put(
  "/messages/:id/status",
  authenticate,
  authorize("admin"),
  contactController.updateMessageStatus
);

router.delete(
  "/messages/:id",
  authenticate,
  authorize("admin"),
  contactController.deleteMessage
);

export default router;
