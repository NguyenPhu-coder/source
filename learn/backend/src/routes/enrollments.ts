import { Router } from "express";
import { enrollmentController } from "../controllers/enrollmentController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/", authenticate, enrollmentController.enroll);
router.delete("/:course_id", authenticate, enrollmentController.unenroll);
router.get("/my-courses", authenticate, enrollmentController.getMyCourses);
router.get("/:user_id", authenticate, enrollmentController.getUserEnrollments);
router.patch(
  "/:id/progress",
  authenticate,
  enrollmentController.updateProgress
);

export default router;


