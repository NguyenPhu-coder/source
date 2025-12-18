import { Router } from "express";
import { courseController } from "../controllers/courseController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadCourseThumbnail } from "../middleware/upload.js";

const router = Router();

router.get("/", courseController.getAll);
router.get(
  "/instructor/:instructorId",
  authenticate,
  courseController.getByInstructor
);
router.get("/:id", courseController.getById);
router.get("/:id/lessons", courseController.getLessons);
router.post(
  "/",
  authenticate,
  authorize("instructor", "admin"),
  uploadCourseThumbnail.single("thumbnail"),
  courseController.create
);
router.put(
  "/:id",
  authenticate,
  authorize("instructor", "admin"),
  uploadCourseThumbnail.single("thumbnail"),
  courseController.update
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  courseController.delete
);

export default router;
