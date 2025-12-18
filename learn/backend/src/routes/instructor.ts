import { Router } from "express";
import { instructorController } from "../controllers/instructorController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { uploadVideo, uploadDocument } from "../middleware/upload.js";

const router = Router();

// All instructor routes require authentication and instructor/admin role
router.use((req, res, next) => {
  console.log("=== INSTRUCTOR ROUTE ===");
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Headers:", req.headers.authorization);
  next();
});
router.use(authenticate);
router.use(authorize("instructor", "admin"));

// Dashboard
router.get("/dashboard", instructorController.getDashboard);

// Courses
router.get("/courses", instructorController.getMyCourses);
router.get(
  "/courses/:courseId/analytics",
  instructorController.getCourseAnalytics
);
router.delete("/courses/:courseId", instructorController.deleteCourse);

// Students
router.get("/students", instructorController.getMyStudents);

// Lessons
router.post("/lessons", instructorController.createLesson);
router.put("/lessons/:lessonId", instructorController.updateLesson);
router.delete("/lessons/:lessonId", instructorController.deleteLesson);
router.post(
  "/lessons/:lessonId/upload-video",
  uploadVideo.single("video"),
  instructorController.uploadLessonVideo
);
router.post(
  "/upload-document",
  uploadDocument.single("document"),
  instructorController.uploadDocument
);

export default router;
