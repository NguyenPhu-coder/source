import express from "express";
import { adminController } from "../controllers/adminController.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Log all admin route requests
router.use((req, res, next) => {
    console.log(`📊 Admin route: ${req.method} ${req.path}`);
    next();
});

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Users management
router.get("/users", adminController.getAllUsers);
router.get("/users/:id", adminController.getUserById);
router.put("/users/:id/role", adminController.updateUserRole);
router.delete("/users/:id", adminController.deleteUser);

// Courses management
router.get("/courses", adminController.getAllCourses);
router.put("/courses/:id/publish", adminController.toggleCoursePublish);
router.delete("/courses/:id", adminController.deleteCourse);

// Course approval
router.get("/courses/pending", adminController.getPendingCourses);
router.put("/courses/:id/approve", adminController.approveCourse);
router.put("/courses/:id/reject", adminController.rejectCourse);

// Statistics
router.get("/statistics", adminController.getStatistics);

// Lessons management
router.get("/lessons", adminController.getAllLessons);
router.get("/lessons/:id", adminController.getLessonById);
router.post("/lessons", adminController.createLesson);
router.put("/lessons/:id", adminController.updateLesson);
router.delete("/lessons/:id", adminController.deleteLesson);

// Categories management
router.get("/categories", adminController.getAllCategories);
router.post("/categories", adminController.createCategory);
router.put("/categories/:id", adminController.updateCategory);
router.delete("/categories/:id", adminController.deleteCategory);

// Enrollments management
router.get("/enrollments", adminController.getAllEnrollments);
router.post("/enrollments", adminController.createEnrollment);
router.delete("/enrollments/:id", adminController.deleteEnrollment);

// Refunds management
router.get("/refunds", adminController.getAllRefunds);
router.get("/refunds/statistics", adminController.getRefundStatistics);
router.get("/refunds/:id", adminController.getRefundById);
router.put("/refunds/:id/approve", adminController.approveRefund);
router.put("/refunds/:id/reject", adminController.rejectRefund);
router.put("/refunds/:id/complete", adminController.completeRefund);

// Orders management
router.get("/orders", adminController.getAllOrders);
router.get("/orders/statistics", adminController.getOrderStatistics);
router.get("/orders/:id", adminController.getOrderDetail);
router.put("/orders/:id/status", adminController.updateOrderStatus);

// Quiz Questions management
router.post("/quiz-questions", adminController.createQuizQuestion);

// Reviews management
router.get("/reviews", adminController.getAllReviews);
router.delete("/reviews/:id", adminController.deleteReview);

// Server resources monitoring
router.get("/server/resources", adminController.getServerResources);

export default router;
