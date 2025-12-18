import { Router } from "express";
import { lessonProgressController } from "../controllers/lessonProgressController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post(
  "/complete",
  authenticate,
  lessonProgressController.markLessonCompleted,
);
router.post(
  "/incomplete",
  authenticate,
  lessonProgressController.markLessonIncomplete,
);
router.get(
  "/course/:course_id",
  authenticate,
  lessonProgressController.getCourseProgress,
);

export default router;


