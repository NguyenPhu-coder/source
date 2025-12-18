import { Router } from "express";
import { reviewController } from "../controllers/reviewController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticate, reviewController.create);
router.get("/course/:course_id", reviewController.getByCourseId);
router.delete("/:id", authenticate, reviewController.delete);

export default router;


