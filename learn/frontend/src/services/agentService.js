/**
 * Agent Service API Client
 * Handles all communication with AI agent system
 */

const API_BASE_URL = "http://127.0.0.1:3000/api";

class AgentService {
    constructor() {
        this.baseURL = `${API_BASE_URL}/agents`;
    }

    getHeaders() {
        const token = localStorage.getItem("token");
        return {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(),
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Agent request failed");
            }

            return data;
        } catch (error) {
            console.error("Agent API Error:", error);
            throw error;
        }
    }

    // ============================================
    // HEALTH & STATUS
    // ============================================

    async checkHealth() {
        return this.request("/health");
    }

    // ============================================
    // CONTENT QUALITY
    // ============================================

    async validateContent(contentData) {
        return this.request("/validate-content", {
            method: "POST",
            body: JSON.stringify(contentData),
        });
    }

    async checkPlagiarism(text, contentId) {
        return this.request("/check-plagiarism", {
            method: "POST",
            body: JSON.stringify({ text, contentId }),
        });
    }

    // ============================================
    // PERSONALIZATION
    // ============================================

    async getRecommendations(params = {}) {
        return this.request("/recommendations", {
            method: "POST",
            body: JSON.stringify(params),
        });
    }

    async getLearningPath(goalTopic) {
        return this.request("/learning-path", {
            method: "POST",
            body: JSON.stringify({ goalTopic }),
        });
    }

    // ============================================
    // ASSESSMENT
    // ============================================

    async generateQuiz(quizData) {
        return this.request("/generate-quiz", {
            method: "POST",
            body: JSON.stringify(quizData),
        });
    }

    async getAdaptiveQuiz(courseId, lessonId) {
        return this.request("/adaptive-quiz", {
            method: "POST",
            body: JSON.stringify({ courseId, lessonId }),
        });
    }

    // ============================================
    // ANALYTICS
    // ============================================

    async getUserAnalytics(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/analytics/user?${queryString}`);
    }

    async getCourseAnalytics(courseId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/analytics/course/${courseId}?${queryString}`);
    }

    async getDropoutRisk(courseId) {
        return this.request(`/analytics/dropout-risk?courseId=${courseId}`);
    }

    async getEngagementMetrics() {
        return this.request("/analytics/engagement");
    }

    // ============================================
    // KNOWLEDGE GRAPH
    // ============================================

    async getPrerequisites(courseId) {
        return this.request(`/prerequisites/${courseId}`);
    }

    async getRelatedCourses(courseId, limit = 5) {
        return this.request(`/related-courses/${courseId}?limit=${limit}`);
    }

    // ============================================
    // TRANSLATION
    // ============================================

    async translate(text, targetLang, sourceLang = "auto") {
        return this.request("/translate", {
            method: "POST",
            body: JSON.stringify({ text, sourceLang, targetLang }),
        });
    }

    async translateCourse(courseId, targetLang) {
        return this.request(`/translate-course/${courseId}`, {
            method: "POST",
            body: JSON.stringify({ targetLang }),
        });
    }

    // ============================================
    // VISUAL GENERATION
    // ============================================

    async generateThumbnail(courseId, title, category) {
        return this.request("/generate-thumbnail", {
            method: "POST",
            body: JSON.stringify({ courseId, title, category }),
        });
    }

    // ============================================
    // MINDMAP
    // ============================================

    async getMindmap(courseId) {
        return this.request(`/mindmap/${courseId}`);
    }
}

export const agentService = new AgentService();
export default agentService;
