const API_BASE_URL = "http://127.0.0.1:3000/api";

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem("token");
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }

  getToken() {
    return this.token || localStorage.getItem("token");
  }

  async request(endpoint, options = {}) {
    // Validate endpoint is not a data URL
    if (endpoint.startsWith("data:")) {
      console.error(
        "Invalid endpoint: data URL not allowed",
        endpoint.substring(0, 100)
      );
      throw new Error("Invalid endpoint: data URL not allowed");
    }

    const url = `${this.baseURL}${endpoint}`;
    // Always get fresh token from localStorage
    const token = localStorage.getItem("token");

    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      const data = await response.json();

      if (!response.ok) {
        // Don't throw for 404 on quiz endpoints - it's normal for lessons without quizzes
        if (response.status === 404 && endpoint.includes("/quizzes/lesson/")) {
          return {
            success: false,
            data: null,
            message: "No quiz found for this lesson",
          };
        }

        throw new Error(
          data.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      // Don't log errors for quiz 404s
      if (!(error.message && endpoint.includes("/quizzes/lesson/"))) {
        console.error("API Error:", {
          endpoint,
          url,
          hasToken: !!token,
          error: error.message,
        });
      }
      throw error;
    }
  }

  // Auth
  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    if (data.data?.token) {
      this.setToken(data.data.token);
    }
    return data;
  }

  async getMe() {
    return this.request("/auth/me");
  }

  logout() {
    this.setToken(null);
  }

  // Courses
  async getCourses(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/courses?${queryString}`);
  }

  async getCourse(id) {
    return this.request(`/courses/${id}`);
  }

  async createCourse(courseData) {
    return this.request("/courses", {
      method: "POST",
      body: JSON.stringify(courseData),
    });
  }

  async updateCourse(id, courseData) {
    return this.request(`/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(courseData),
    });
  }

  async deleteCourse(id) {
    return this.request(`/instructor/courses/${id}`, {
      method: "DELETE",
    });
  }

  async getInstructorCourses(instructorId) {
    return this.request(`/courses/instructor/${instructorId}`);
  }

  // Enrollments
  async enrollCourse(courseId) {
    return this.request("/enrollments", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId }),
    });
  }

  async unenrollCourse(courseId) {
    return this.request(`/enrollments/${courseId}`, {
      method: "DELETE",
    });
  }

  async getMyCourses() {
    return this.request("/enrollments/my-courses");
  }

  async updateProgress(enrollmentId, lessonId) {
    return this.request("/enrollments/progress", {
      method: "PUT",
      body: JSON.stringify({ enrollmentId, lessonId }),
    });
  }

  // Reviews
  async createReview(reviewData) {
    return this.request("/reviews", {
      method: "POST",
      body: JSON.stringify(reviewData),
    });
  }

  async getCourseReviews(courseId) {
    return this.request(`/reviews/course/${courseId}`);
  }

  async updateReview(id, reviewData) {
    return this.request(`/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(reviewData),
    });
  }

  // Dashboard
  async getDashboardOverview() {
    return this.request("/dashboard/overview");
  }

  // Lesson Progress
  async markLessonCompleted(lessonId, courseId) {
    return this.request("/lesson-progress/complete", {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, course_id: courseId }),
    });
  }

  async markLessonIncomplete(lessonId, courseId) {
    return this.request("/lesson-progress/incomplete", {
      method: "POST",
      body: JSON.stringify({ lesson_id: lessonId, course_id: courseId }),
    });
  }

  async getCourseProgress(courseId) {
    return this.request(`/lesson-progress/course/${courseId}`);
  }

  // Alias for getCourseProgress
  async getLessonProgress(courseId) {
    return this.getCourseProgress(courseId);
  }

  // Lessons
  async getLessons(courseId) {
    return this.request(`/courses/${courseId}/lessons`);
  }

  // Reviews
  async getCategories(lang = "en") {
    return this.request(`/categories?lang=${lang}`);
  }

  // Gamification
  async getUserPoints() {
    return this.request("/gamification/points");
  }

  async getPointsHistory(limit = 50) {
    return this.request(`/gamification/points/history?limit=${limit}`);
  }

  async updateStreak() {
    return this.request("/gamification/points/streak", {
      method: "POST",
    });
  }

  async getLeaderboard(limit = 100) {
    return this.request(`/gamification/leaderboard?limit=${limit}`);
  }

  async getAllBadges() {
    return this.request("/gamification/badges");
  }

  async getUserBadges() {
    return this.request("/gamification/badges/user");
  }

  async getBadgesProgress() {
    return this.request("/gamification/badges/progress");
  }

  async getGamificationOverview() {
    return this.request("/gamification/overview");
  }

  // Quizzes
  async getQuizByLesson(lessonId) {
    try {
      return await this.request(`/quizzes/lesson/${lessonId}`);
    } catch (error) {
      // Return null if quiz not found instead of throwing
      if (error.message && error.message.includes("404")) {
        return { success: false, data: null };
      }
      throw error;
    }
  }

  async submitQuizAttempt(quizId, answers) {
    return this.request(`/quizzes/${quizId}/submit`, {
      method: "POST",
      body: JSON.stringify(answers),
    });
  }

  async getUserQuizAttempts(quizId) {
    return this.request(`/quizzes/${quizId}/attempts`);
  }

  // Discussions
  async getCourseDiscussions(courseId) {
    return this.request(`/discussions/course/${courseId}`);
  }

  async getLessonDiscussions(lessonId) {
    return this.request(`/discussions/lesson/${lessonId}`);
  }

  async getDiscussion(discussionId) {
    return this.request(`/discussions/${discussionId}`);
  }

  async createDiscussion(data) {
    return this.request("/discussions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateDiscussion(discussionId, data) {
    return this.request(`/discussions/${discussionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteDiscussion(discussionId) {
    return this.request(`/discussions/${discussionId}`, {
      method: "DELETE",
    });
  }

  async upvoteDiscussion(discussionId) {
    return this.request(`/discussions/${discussionId}/upvote`, {
      method: "POST",
    });
  }

  async addComment(discussionId, content) {
    return this.request(`/discussions/${discussionId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  async upvoteComment(commentId) {
    return this.request(`/discussions/comments/${commentId}/upvote`, {
      method: "POST",
    });
  }

  async acceptAnswer(discussionId, commentId) {
    return this.request(
      `/discussions/${discussionId}/comments/${commentId}/accept`,
      {
        method: "POST",
      }
    );
  }

  // Quizzes
  async getQuizByLesson(lessonId) {
    return this.request(`/quizzes/lesson/${lessonId}`);
  }

  async getQuiz(quizId) {
    return this.request(`/quizzes/${quizId}`);
  }

  async submitQuiz(quizId, answers, timeTaken) {
    return this.request(`/quizzes/${quizId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers, timeTaken }),
    });
  }

  async getQuizAttempts(quizId) {
    return this.request(`/quizzes/${quizId}/attempts`);
  }

  async createQuiz(quizData) {
    return this.request("/quizzes", {
      method: "POST",
      body: JSON.stringify(quizData),
    });
  }

  // Notifications
  async getNotifications(unreadOnly = false) {
    return this.request(`/notifications?unread=${unreadOnly}`);
  }

  async getUnreadCount() {
    return this.request("/notifications/unread-count");
  }

  async markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, {
      method: "PUT",
    });
  }

  async markAllNotificationsAsRead() {
    return this.request("/notifications/read-all", {
      method: "PUT",
    });
  }

  async deleteNotification(id) {
    return this.request(`/notifications/${id}`, {
      method: "DELETE",
    });
  }

  // Certificates
  async generateCertificate(courseId) {
    return this.request("/certificates/generate", {
      method: "POST",
      body: JSON.stringify({ courseId }),
    });
  }

  async getMyCertificates() {
    return this.request("/certificates/my-certificates");
  }

  async verifyCertificate(code) {
    return this.request(`/certificates/verify/${code}`);
  }

  async getCertificate(id) {
    return this.request(`/certificates/${id}`);
  }

  // Contact
  async submitContact(data) {
    return this.request("/contact", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getContactMessages(status) {
    const query = status ? `?status=${status}` : "";
    return this.request(`/contact/messages${query}`);
  }

  async updateContactStatus(id, status) {
    return this.request(`/contact/messages/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }

  async deleteContactMessage(id) {
    return this.request(`/contact/messages/${id}`, {
      method: "DELETE",
    });
  }

  // Health Check
  async healthCheck() {
    return this.request("/health");
  }

  // Admin - Generic methods for all admin routes
  async get(endpoint) {
    return this.request(endpoint);
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: "DELETE",
    });
  }

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
}

const apiClient = new ApiClient();

export default apiClient;
export { apiClient };
