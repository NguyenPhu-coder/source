"""
PostgreSQL Schema for Agent Data Sync
Creates tables in PostgreSQL that mirror MySQL Learn Platform structure
"""

-- Users table (sync from MySQL)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_updated ON users(updated_at);

-- Courses table (sync from MySQL)
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY,
    title_en TEXT,
    title_vi TEXT,
    instructor_id INTEGER REFERENCES users(id),
    category_id INTEGER,
    price DECIMAL(10,2),
    level VARCHAR(50),
    language VARCHAR(10),
    rating DECIMAL(3,2),
    total_students INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_courses_published ON courses(is_published);
CREATE INDEX idx_courses_level ON courses(level);

-- Enrollments table (sync from MySQL)
CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    progress DECIMAL(5,2) DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    enrolled_at TIMESTAMP,
    completed_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_completed ON enrollments(completed);
CREATE INDEX idx_enrollments_progress ON enrollments(progress);

-- Lessons table (sync from MySQL)
CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    title_en TEXT,
    title_vi TEXT,
    lesson_type VARCHAR(50),
    duration INTEGER,
    order_index INTEGER,
    is_free BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lessons_course ON lessons(course_id);
CREATE INDEX idx_lessons_type ON lessons(lesson_type);

-- Lesson Progress table (sync from MySQL)
CREATE TABLE IF NOT EXISTS lesson_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    lesson_id INTEGER REFERENCES lessons(id),
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(lesson_id);

-- Quiz Attempts table (sync from MySQL)
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    quiz_id INTEGER,
    score DECIMAL(5,2),
    passed BOOLEAN,
    completed_at TIMESTAMP,
    time_taken INTEGER,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- Analytics Events table (new for agents)
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100),
    event_data JSONB,
    course_id INTEGER REFERENCES courses(id),
    lesson_id INTEGER REFERENCES lessons(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_course ON analytics_events(course_id);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- User Analytics table (aggregated data)
CREATE TABLE IF NOT EXISTS user_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    total_courses_enrolled INTEGER DEFAULT 0,
    total_courses_completed INTEGER DEFAULT 0,
    total_lessons_completed INTEGER DEFAULT 0,
    total_quizzes_taken INTEGER DEFAULT 0,
    average_quiz_score DECIMAL(5,2),
    total_study_time_minutes INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP,
    dropout_risk_score DECIMAL(5,4),
    engagement_score DECIMAL(5,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_analytics_user ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_dropout ON user_analytics(dropout_risk_score);
CREATE INDEX idx_user_analytics_engagement ON user_analytics(engagement_score);

-- Course Analytics table (aggregated data)
CREATE TABLE IF NOT EXISTS course_analytics (
    id SERIAL PRIMARY KEY,
    course_id INTEGER UNIQUE REFERENCES courses(id),
    total_enrollments INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    completion_rate DECIMAL(5,2),
    average_completion_time_days DECIMAL(10,2),
    average_rating DECIMAL(3,2),
    dropout_rate DECIMAL(5,2),
    engagement_score DECIMAL(5,2),
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_course_analytics_course ON course_analytics(course_id);
CREATE INDEX idx_course_analytics_completion_rate ON course_analytics(completion_rate);

-- Personalization Recommendations table
CREATE TABLE IF NOT EXISTS personalization_recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    course_id INTEGER REFERENCES courses(id),
    recommendation_type VARCHAR(50), -- 'next_course', 'similar', 'personalized'
    score DECIMAL(5,4),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_personalization_user ON personalization_recommendations(user_id);
CREATE INDEX idx_personalization_course ON personalization_recommendations(course_id);
CREATE INDEX idx_personalization_score ON personalization_recommendations(score);
CREATE INDEX idx_personalization_type ON personalization_recommendations(recommendation_type);

-- Content Quality Checks table
CREATE TABLE IF NOT EXISTS content_quality_checks (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50), -- 'course', 'lesson', 'quiz'
    content_id INTEGER,
    check_type VARCHAR(100), -- 'plagiarism', 'toxicity', 'bias', 'factcheck'
    status VARCHAR(50), -- 'passed', 'failed', 'warning'
    score DECIMAL(5,4),
    details JSONB,
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_content ON content_quality_checks(content_type, content_id);
CREATE INDEX idx_quality_type ON content_quality_checks(check_type);
CREATE INDEX idx_quality_status ON content_quality_checks(status);

-- Learning Path table
CREATE TABLE IF NOT EXISTS learning_paths (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    path_name VARCHAR(255),
    course_ids INTEGER[],
    current_course_index INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_paths_user ON learning_paths(user_id);

-- Knowledge Graph Cache table
CREATE TABLE IF NOT EXISTS knowledge_graph_cache (
    id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(id),
    graph_data JSONB,
    prerequisites INTEGER[],
    related_concepts TEXT[],
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kg_cache_course ON knowledge_graph_cache(course_id);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_user_analytics_updated_at 
    BEFORE UPDATE ON user_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learning_paths_updated_at 
    BEFORE UPDATE ON learning_paths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
