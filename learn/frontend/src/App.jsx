import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import LessonPlayer from "./pages/LessonPlayer";
import Analytics from "./pages/Analytics";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Categories from "./pages/Categories";
import About from "./pages/About";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import AdminUsers from "./pages/AdminUsers";
import AdminCourses from "./pages/AdminCourses";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminLessons from "./pages/admin/AdminLessons";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminEnrollments from "./pages/admin/AdminEnrollments";
import AdminSettings from "./pages/admin/AdminSettings";
import CourseApprovalManager from "./components/admin/CourseApprovalManager";
import RefundManager from "./components/admin/RefundManager";
import EnrollmentManager from "./components/admin/EnrollmentManager";
// import ServerMonitor from "./components/admin/ServerMonitor";
import OrderManager from "./components/admin/OrderManager";
import AdminLayout from "./components/admin/AdminLayout";
import InstructorLayout from "./components/instructor/InstructorLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import InstructorDashboard from "./pages/InstructorDashboard";
import MyLearning from "./pages/MyLearning";
import Settings from "./pages/Settings";
import SearchResults from "./pages/SearchResults";
import Summary from "./pages/Summary";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import CreateCourse from "./pages/instructor/CreateCourse";
import CreateCourseFromDocument from "./pages/instructor/CreateCourseFromDocument";
import AIQuizGenerator from "./pages/instructor/AIQuizGenerator";
import EditCourse from "./pages/instructor/EditCourse";
import ManageLessons from "./pages/instructor/ManageLessons";
import InstructorCourses from "./pages/instructor/InstructorCourses";
import InstructorStudents from "./pages/instructor/InstructorStudents";
import CourseAnalytics from "./pages/instructor/CourseAnalytics";
import Blogs from "./pages/Blogs";
import BlogDetail from "./pages/BlogDetail";
import CreateBlog from "./pages/CreateBlog";
import EditBlog from "./pages/EditBlogNew";
import MyBlogs from "./pages/MyBlogs";
import SavedBlogs from "./pages/SavedBlogs";
import UploadLessonVideo from "./pages/UploadLessonVideo";
import CreateQuiz from "./pages/CreateQuiz";
import TakeQuiz from "./pages/TakeQuizSimple";
import QuizResult from "./pages/QuizResultSimple";
import AIDashboardPage from "./pages/AIDashboardPage";
import WalletPage from "./pages/Wallet";
import Cart from "./pages/Cart";
import InstructorAssignments from "./pages/InstructorAssignments";
import CreateAssignment from "./pages/CreateAssignment";
import GradeSubmissions from "./pages/GradeSubmissions";
import StudentAssignments from "./pages/StudentAssignments";
import MyNotes from "./pages/MyNotes";
import Notifications from "./pages/Notifications";
import SiteMap from "./pages/SiteMap";
import Profile from "./pages/Profile";
import AutoQuizPage from "./pages/AutoQuizPage";
import MyAutoQuizzes from "./pages/MyAutoQuizzes";

const queryClient = new QueryClient();

// Replace with your actual Google OAuth Client ID
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

const App = () => (
  <ThemeProvider defaultTheme="light" storageKey="elearning-theme">
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <AuthProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/course/:id" element={<CourseDetail />} />
                  <Route
                    path="/course/:courseId/lesson/:lessonId"
                    element={<LessonPlayer />}
                  />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/summary" element={<Summary />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/search" element={<SearchResults />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/sitemap" element={<SiteMap />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Blog Routes */}
                  <Route path="/blogs" element={<Blogs />} />
                  <Route path="/blogs/:id" element={<BlogDetail />} />
                  <Route
                    path="/blogs/create"
                    element={
                      <ProtectedRoute>
                        <CreateBlog />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/blogs/edit/:id"
                    element={
                      <ProtectedRoute>
                        <EditBlog />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/blogs/my-blogs"
                    element={
                      <ProtectedRoute>
                        <MyBlogs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/blogs/saved"
                    element={
                      <ProtectedRoute>
                        <SavedBlogs />
                      </ProtectedRoute>
                    }
                  />

                  {/* AI Dashboard Route */}
                  <Route
                    path="/ai-dashboard"
                    element={
                      <ProtectedRoute>
                        <AIDashboardPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Wallet Route */}
                  <Route
                    path="/wallet"
                    element={
                      <ProtectedRoute>
                        <WalletPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Cart Route */}
                  <Route
                    path="/cart"
                    element={
                      <ProtectedRoute>
                        <Cart />
                      </ProtectedRoute>
                    }
                  />

                  {/* Protected User Routes */}
                  <Route
                    path="/my-learning"
                    element={
                      <ProtectedRoute>
                        <MyLearning />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/auto-quiz/:quizId"
                    element={
                      <ProtectedRoute>
                        <AutoQuizPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/auto-quizzes"
                    element={
                      <ProtectedRoute>
                        <MyAutoQuizzes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/quizzes/:id/take"
                    element={
                      <ProtectedRoute>
                        <TakeQuiz />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/quizzes/:id/result/:attemptId"
                    element={
                      <ProtectedRoute>
                        <QuizResult />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/checkout"
                    element={
                      <ProtectedRoute>
                        <Checkout />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/orders"
                    element={
                      <ProtectedRoute>
                        <Orders />
                      </ProtectedRoute>
                    }
                  />

                  {/* Notifications Route */}
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />

                  {/* Student Assignments Route */}
                  <Route
                    path="/courses/:courseId/assignments"
                    element={
                      <ProtectedRoute>
                        <StudentAssignments />
                      </ProtectedRoute>
                    }
                  />

                  {/* My Notes Route */}
                  <Route
                    path="/courses/:courseId/notes"
                    element={
                      <ProtectedRoute>
                        <MyNotes />
                      </ProtectedRoute>
                    }
                  />

                  {/* Instructor Routes */}
                  <Route
                    path="/instructor"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <InstructorDashboard />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <InstructorCourses />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/students"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <InstructorStudents />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/new"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <CreateCourse />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/from-document"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <CreateCourseFromDocument />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/ai-quiz-generator"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <AIQuizGenerator />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/:id/edit"
                    element={
                      <ProtectedRoute>
                        <EditCourse />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/:id/lessons"
                    element={
                      <ProtectedRoute>
                        <InstructorLayout>
                          <ManageLessons />
                        </InstructorLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/:id/analytics"
                    element={
                      <ProtectedRoute>
                        <CourseAnalytics />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/lessons/:lessonId/upload-video"
                    element={
                      <ProtectedRoute>
                        <UploadLessonVideo />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/lessons/:lessonId/create-quiz"
                    element={
                      <ProtectedRoute>
                        <CreateQuiz />
                      </ProtectedRoute>
                    }
                  />

                  {/* Instructor Assignment Routes */}
                  <Route
                    path="/instructor/courses/:courseId/assignments"
                    element={
                      <ProtectedRoute>
                        <InstructorAssignments />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/:courseId/assignments/create"
                    element={
                      <ProtectedRoute>
                        <CreateAssignment />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/courses/:courseId/assignments/:assignmentId/edit"
                    element={
                      <ProtectedRoute>
                        <CreateAssignment />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/instructor/assignments/:assignmentId/submissions"
                    element={
                      <ProtectedRoute>
                        <GradeSubmissions />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin Routes - Protected with AdminLayout */}
                  {/* Redirect /admin to /admin/analytics */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminAnalytics />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminUsers />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/courses"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminCourses />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/analytics"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminAnalytics />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/lessons"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminLessons />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/categories"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminCategories />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/enrollments"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminEnrollments />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/course-approvals"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <CourseApprovalManager />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/refunds"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <RefundManager />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/orders"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <OrderManager />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />
                  {/* <Route
                    path="/admin/server"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <ServerMonitor />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  /> */}
                  <Route
                    path="/admin/settings"
                    element={
                      <ProtectedRoute requireAdmin>
                        <AdminLayout>
                          <AdminSettings />
                        </AdminLayout>
                      </ProtectedRoute>
                    }
                  />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  </ThemeProvider>
);

export default App;
