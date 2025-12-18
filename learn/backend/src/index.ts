import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import enrollmentRoutes from "./routes/enrollments.js";
import reviewRoutes from "./routes/reviews.js";
import dashboardRoutes from "./routes/dashboard.js";
import categoryRoutes from "./routes/categories.js";
import lessonProgressRoutes from "./routes/lessonProgress.js";
import gamificationRoutes from "./routes/gamification.js";
import quizRoutes from "./routes/quizzes.js";
import adminRoutes from "./routes/admin.js";
import instructorRoutes from "./routes/instructor.js";
import cartRoutes from "./routes/cart.js";
import orderRoutes from "./routes/orders.js";
import notificationRoutes from "./routes/notifications.js";
import contactRoutes from "./routes/contact.js";
import couponRoutes from "./routes/coupons.js";
import blogRoutes from "./routes/blogs.js";
import agentRoutes from "./routes/agents.js";
import avatarTeacherRoutes from "./routes/avatarTeacher.js";
import wishlistRoutes from "./routes/wishlist.js";
import walletRoutes from "./routes/wallet.js"; // [NEW] Wallet routes
import notesRoutes from "./routes/notes.js";
import assignmentsRoutes from "./routes/assignments.js";
import chatbotRoutes from "./routes/chatbot.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { eventPublisher } from "./services/eventPublisher.js";
import logger from "./services/logger.js";
import "./config/db.js"; // Initialize database connection

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve static files (uploads)
  app.use("/uploads", express.static("uploads"));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "OK", message: "Server is running" });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/courses", courseRoutes);
  app.use("/api/enrollments", enrollmentRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/lesson-progress", lessonProgressRoutes);
  app.use("/api/gamification", gamificationRoutes);
  app.use("/api/quizzes", quizRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/instructor", instructorRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/coupons", couponRoutes);
  app.use("/api/blogs", blogRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/avatar-teacher", avatarTeacherRoutes);
  app.use("/api/wishlist", wishlistRoutes);
  app.use("/api/wallet", walletRoutes); // [NEW] Register wallet routes
  app.use("/api/notes", notesRoutes);
  app.use("/api/assignments", assignmentsRoutes);
  app.use("/api/chatbot", chatbotRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Start server if running directly
const app = createServer();
const PORT = process.env.PORT || 3000;

// Initialize Kafka event publisher
async function initializeServices() {
  try {
    await eventPublisher.connect();
    logger.info('Event publisher connected successfully');
  } catch (error) {
    logger.error('Failed to initialize event publisher:', error);
    // Continue without Kafka - non-critical
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await eventPublisher.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await eventPublisher.disconnect();
  process.exit(0);
});

app.listen(PORT, async () => {
  logger.info(`🚀 Backend server running on http://localhost:${PORT}`);
  logger.info(`📚 API available at http://localhost:${PORT}/api/health`);
  logger.info(`🤖 Agent API available at http://localhost:${PORT}/api/agents/health`);

  // Initialize services after server starts
  await initializeServices();
});
