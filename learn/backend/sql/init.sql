-- Create database
CREATE DATABASE IF NOT EXISTS elearning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE elearning;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  avatar VARCHAR(500),
  bio TEXT,
  phone VARCHAR(20),
  location VARCHAR(255),
  website VARCHAR(500),
  social_links JSON,
  role ENUM('student', 'instructor', 'admin') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  name_vi VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  icon VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title_en VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  title_vi VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  description_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  description_vi TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  thumbnail VARCHAR(500),
  category_id INT,
  instructor_id INT,
  price DECIMAL(10, 2) DEFAULT 0,
  level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  language VARCHAR(50) DEFAULT 'en',
  rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  total_students INT DEFAULT 0,
  total_lessons INT DEFAULT 0,
  duration INT DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
  approved_by INT,
  approved_at TIMESTAMP NULL,
  rejection_reason TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title_en VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  title_vi VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  description_en TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  description_vi TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  video_url VARCHAR(500),
  lesson_type ENUM('video', 'text', 'document', 'quiz') DEFAULT 'video',
  content_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  document_url VARCHAR(500),
  duration INT DEFAULT 0,
  order_index INT DEFAULT 0,
  is_free BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  progress DECIMAL(5, 2) DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (user_id, course_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_review (user_id, course_id)
);

-- Lesson Progress table
CREATE TABLE IF NOT EXISTS lesson_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  UNIQUE KEY unique_progress (user_id, lesson_id)
);

-- User Points table (Gamification)
CREATE TABLE IF NOT EXISTS user_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_points INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  level INT DEFAULT 1,
  level_name VARCHAR(50) DEFAULT 'Beginner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_points (user_id)
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_vi VARCHAR(255) NOT NULL,
  description_en TEXT,
  description_vi TEXT,
  icon VARCHAR(255),
  trigger_type ENUM('complete_first_lesson', 'complete_course', 'streak_days', 'perfect_quiz', 'help_others', 'total_points', 'courses_completed') NOT NULL,
  trigger_value INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Badges (earned badges)
CREATE TABLE IF NOT EXISTS user_badges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  badge_id INT NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_badge (user_id, badge_id)
);

-- Points History table
CREATE TABLE IF NOT EXISTS points_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  points INT NOT NULL,
  activity_type ENUM('watch_video', 'complete_lesson', 'finish_course', 'perfect_quiz', 'daily_login', 'help_others', 'review_course') NOT NULL,
  reference_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  tier ENUM('free', 'pro', 'premium', 'enterprise') DEFAULT 'free',
  status ENUM('active', 'cancelled', 'expired', 'trial') DEFAULT 'active',
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NULL,
  auto_renew BOOLEAN DEFAULT TRUE,
  payment_method VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Discussions table
CREATE TABLE IF NOT EXISTS discussions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT,
  lesson_id INT,
  user_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  is_question BOOLEAN DEFAULT FALSE,
  is_answered BOOLEAN DEFAULT FALSE,
  upvotes INT DEFAULT 0,
  views INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Discussion Comments table
CREATE TABLE IF NOT EXISTS discussion_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discussion_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  is_accepted_answer BOOLEAN DEFAULT FALSE,
  upvotes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Study Groups table
CREATE TABLE IF NOT EXISTS study_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  course_id INT,
  creator_id INT NOT NULL,
  max_members INT DEFAULT 50,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Study Group Members table
CREATE TABLE IF NOT EXISTS study_group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('member', 'moderator', 'admin') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_member (group_id, user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('course_update', 'new_reply', 'badge_earned', 'streak_reminder', 'enrollment', 'achievement') NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Course Analytics table
CREATE TABLE IF NOT EXISTS course_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  user_id INT NOT NULL,
  lesson_id INT,
  event_type ENUM('video_start', 'video_complete', 'video_pause', 'quiz_attempt', 'quiz_pass', 'drop_off') NOT NULL,
  video_position INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_id INT NOT NULL,
  title_en VARCHAR(500) NOT NULL,
  title_vi VARCHAR(500),
  title_jp VARCHAR(500),
  description_en TEXT,
  description_vi TEXT,
  description_jp TEXT,
  passing_score INT DEFAULT 70,
  time_limit INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Quiz Questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quiz_id INT NOT NULL,
  question_en TEXT NOT NULL,
  question_vi TEXT,
  question_jp TEXT,
  question_type ENUM('multiple_choice', 'true_false', 'short_answer') DEFAULT 'multiple_choice',
  order_index INT DEFAULT 0,
  points INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Quiz Options table
CREATE TABLE IF NOT EXISTS quiz_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  option_en TEXT NOT NULL,
  option_vi TEXT,
  option_jp TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

-- Quiz Attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  quiz_id INT NOT NULL,
  score INT NOT NULL,
  passed BOOLEAN DEFAULT FALSE,
  time_taken INT,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  certificate_code VARCHAR(255) UNIQUE NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_certificate (user_id, course_id)
);

-- Insert default categories
INSERT INTO categories (name_en, name_vi, icon) VALUES
('Technology', 'Công nghệ', 'Code'),
('Business', 'Kinh doanh', 'Briefcase'),
('Design', 'Thiết kế', 'Palette'),
('Marketing', 'Marketing', 'TrendingUp'),
('Personal Development', 'Phát triển cá nhân', 'Brain'),
('Health & Wellness', 'Sức khỏe & Thể chất', 'Heart');

-- Insert users (password for all: 123456)
-- Password hash for "123456": $2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K
INSERT INTO users (name, email, password, role, avatar) VALUES
('Admin User', 'admin@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'admin', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'),
('John Smith', 'john@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'instructor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'),
('Sarah Johnson', 'sarah@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'instructor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah'),
('Michael Chen', 'michael@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'instructor', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael'),
('Emily Davis', 'emily@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily'),
('David Wilson', 'david@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=David'),
('Lisa Anderson', 'lisa@learnhub.com', '$2b$10$rKvVLq8H3VqGxJ1qJ3qJ3eZYqFqY3JxH7JxH7JxH7JxH7JxH7JxH7K', 'student', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa');

-- Insert courses
INSERT INTO courses (title_en, title_vi, description_en, description_vi, thumbnail, category_id, instructor_id, price, level, language, total_lessons, duration, rating, total_reviews, total_students, is_published) VALUES
-- Technology Courses
('Python for Beginners', 'Python cho người mới bắt đầu', 'Learn Python programming from scratch with hands-on projects', 'Học lập trình Python từ đầu với các dự án thực hành', 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&h=600&fit=crop', 1, 2, 49.99, 'beginner', 'en', 24, 720, 4.8, 156, 1234, TRUE),
('Web Development Masterclass', 'Khóa học Phát triển Web toàn diện', 'Complete guide to modern web development with React, Node.js and MongoDB', 'Hướng dẫn đầy đủ về phát triển web hiện đại với React, Node.js và MongoDB', 'https://images.unsplash.com/photo-1633356122544-f134324ef6cb?w=800&h=600&fit=crop', 1, 2, 79.99, 'intermediate', 'en', 48, 1440, 4.9, 203, 2156, TRUE),
('JavaScript ES6+ Complete Course', 'Khóa học JavaScript ES6+ Hoàn chỉnh', 'Master modern JavaScript with ES6+ features', 'Làm chủ JavaScript hiện đại với các tính năng ES6+', 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&h=600&fit=crop', 1, 3, 59.99, 'intermediate', 'en', 36, 1080, 4.7, 128, 987, TRUE),
('Data Science with Python', 'Khoa học Dữ liệu với Python', 'Learn data analysis, visualization and machine learning', 'Học phân tích dữ liệu, trực quan hóa và học máy', 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop', 1, 4, 89.99, 'advanced', 'en', 52, 1560, 4.9, 187, 1543, TRUE),
('Mobile App Development with React Native', 'Phát triển Ứng dụng Di động với React Native', 'Build cross-platform mobile apps with React Native', 'Xây dựng ứng dụng di động đa nền tảng với React Native', 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop', 1, 2, 69.99, 'intermediate', 'en', 40, 1200, 4.6, 94, 756, TRUE),

-- Business Courses
('Digital Marketing Strategy', 'Chiến lược Marketing Số', 'Learn to create effective digital marketing campaigns', 'Học cách tạo các chiến dịch marketing số hiệu quả', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop', 4, 3, 54.99, 'beginner', 'en', 28, 840, 4.5, 112, 891, TRUE),
('Business Analytics and Intelligence', 'Phân tích và Thông minh Kinh doanh', 'Master data-driven decision making for business', 'Làm chủ việc ra quyết định dựa trên dữ liệu cho doanh nghiệp', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop', 2, 4, 64.99, 'intermediate', 'en', 32, 960, 4.7, 145, 1023, TRUE),
('Entrepreneurship Fundamentals', 'Cơ bản về Khởi nghiệp', 'Start and grow your own successful business', 'Bắt đầu và phát triển doanh nghiệp thành công của riêng bạn', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=600&fit=crop', 2, 3, 49.99, 'beginner', 'en', 24, 720, 4.6, 98, 765, TRUE),

-- Design Courses
('UI/UX Design Fundamentals', 'Cơ bản về Thiết kế UI/UX', 'Master the fundamentals of user interface and experience design', 'Làm chủ các nguyên tắc cơ bản về thiết kế giao diện và trải nghiệm người dùng', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop', 3, 3, 59.99, 'beginner', 'en', 32, 960, 4.8, 176, 1432, TRUE),
('Graphic Design Masterclass', 'Khóa học Thiết kế Đồ họa Toàn diện', 'Learn professional graphic design with Adobe Creative Suite', 'Học thiết kế đồ họa chuyên nghiệp với Adobe Creative Suite', 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&h=600&fit=crop', 3, 2, 74.99, 'intermediate', 'en', 44, 1320, 4.7, 134, 1098, TRUE),
('3D Modeling with Blender', 'Mô hình 3D với Blender', 'Create stunning 3D models and animations', 'Tạo các mô hình 3D và hoạt ảnh tuyệt đẹp', 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=600&fit=crop', 3, 4, 69.99, 'intermediate', 'en', 38, 1140, 4.6, 87, 654, TRUE),

-- Personal Development Courses
('Time Management Mastery', 'Làm chủ Quản lý Thời gian', 'Boost productivity and achieve your goals', 'Tăng năng suất và đạt được mục tiêu của bạn', 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=600&fit=crop', 5, 3, 39.99, 'beginner', 'en', 20, 600, 4.5, 156, 1876, TRUE),
('Public Speaking and Presentation Skills', 'Kỹ năng Thuyết trình và Nói trước Công chúng', 'Become a confident and effective speaker', 'Trở thành diễn giả tự tin và hiệu quả', 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=600&fit=crop', 5, 2, 44.99, 'beginner', 'en', 22, 660, 4.7, 198, 2134, TRUE),

-- Health & Wellness Courses
('Yoga for Beginners', 'Yoga cho người mới bắt đầu', 'Start your yoga journey with basic poses and breathing techniques', 'Bắt đầu hành trình yoga với các tư thế cơ bản và kỹ thuật thở', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop', 6, 4, 34.99, 'beginner', 'en', 18, 540, 4.8, 223, 2567, TRUE),
('Nutrition and Healthy Eating', 'Dinh dưỡng và Ăn uống Lành mạnh', 'Learn the science of nutrition and create healthy meal plans', 'Học khoa học dinh dưỡng và tạo kế hoạch bữa ăn lành mạnh', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop', 6, 3, 39.99, 'beginner', 'en', 24, 720, 4.6, 167, 1543, TRUE);

-- Insert lessons for Python course (course_id = 1)
INSERT INTO lessons (course_id, title_en, title_vi, description_en, description_vi, video_url, duration, order_index, is_free) VALUES
(1, 'Introduction to Python', 'Giới thiệu về Python', 'Overview of Python and setup', 'Tổng quan về Python và cài đặt', 'https://www.youtube.com/watch?v=YYXdXT2l-Gg', 30, 1, TRUE),
(1, 'Variables and Data Types', 'Biến và Kiểu dữ liệu', 'Learn about Python variables and basic data types', 'Học về biến Python và các kiểu dữ liệu cơ bản', 'https://www.youtube.com/watch?v=example2', 35, 2, TRUE),
(1, 'Control Flow - If Statements', 'Cấu trúc Điều khiển - Câu lệnh If', 'Master conditional statements in Python', 'Làm chủ câu lệnh điều kiện trong Python', 'https://www.youtube.com/watch?v=example3', 40, 3, FALSE),
(1, 'Loops in Python', 'Vòng lặp trong Python', 'Understanding for and while loops', 'Hiểu về vòng lặp for và while', 'https://www.youtube.com/watch?v=example4', 45, 4, FALSE),
(1, 'Functions and Modules', 'Hàm và Module', 'Create reusable code with functions', 'Tạo code tái sử dụng với hàm', 'https://www.youtube.com/watch?v=example5', 50, 5, FALSE);

-- Insert lessons for Web Development course (course_id = 2)
INSERT INTO lessons (course_id, title_en, title_vi, description_en, description_vi, video_url, duration, order_index, is_free) VALUES
(2, 'HTML Fundamentals', 'Cơ bản về HTML', 'Learn the building blocks of web pages', 'Học các khối xây dựng trang web', 'https://www.youtube.com/watch?v=example6', 35, 1, TRUE),
(2, 'CSS Styling Basics', 'Cơ bản về CSS', 'Style your web pages with CSS', 'Tạo kiểu cho trang web với CSS', 'https://www.youtube.com/watch?v=example7', 40, 2, TRUE),
(2, 'JavaScript Introduction', 'Giới thiệu JavaScript', 'Add interactivity to your websites', 'Thêm tính tương tác cho website', 'https://www.youtube.com/watch?v=example8', 45, 3, FALSE),
(2, 'React Components', 'Thành phần React', 'Build reusable UI components', 'Xây dựng thành phần UI tái sử dụng', 'https://www.youtube.com/watch?v=example9', 50, 4, FALSE);

-- Insert enrollments
INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES
(5, 1, 75.5, FALSE),
(5, 2, 100, TRUE),
(5, 10, 45.0, FALSE),
(6, 1, 30.0, FALSE),
(6, 3, 60.5, FALSE),
(6, 4, 100, TRUE),
(7, 2, 85.0, FALSE),
(7, 5, 20.0, FALSE),
(7, 10, 100, TRUE);

-- Insert reviews
INSERT INTO reviews (user_id, course_id, rating, comment) VALUES
(5, 1, 5, 'Excellent course! Very clear explanations and great examples. Perfect for beginners.'),
(5, 2, 5, 'Best web development course I have taken. The instructor is amazing and the projects are very practical.'),
(5, 10, 4, 'Great design course. Would love to see more advanced topics covered.'),
(6, 1, 4, 'Good introduction to Python. Some sections could be more detailed.'),
(6, 3, 5, 'JavaScript course is fantastic! Learned so much about modern ES6+ features.'),
(6, 4, 5, 'Amazing course on data science. The practical examples really helped me understand the concepts.'),
(7, 2, 5, 'Comprehensive web development course. Covers everything from basics to advanced topics.'),
(7, 5, 4, 'Good course on React Native. The instructor explains complex concepts very well.'),
(7, 10, 5, 'Perfect UI/UX course for beginners. Love the hands-on approach!');

-- Insert default badges
INSERT INTO badges (name_en, name_vi, description_en, description_vi, icon, trigger_type, trigger_value) VALUES
('First Steps', 'Bước Đầu Tiên', 'Complete your first lesson', 'Hoàn thành bài học đầu tiên', '🎯', 'complete_first_lesson', 1),
('Week Warrior', 'Chiến Binh Tuần', 'Maintain a 7-day learning streak', 'Duy trì chuỗi học 7 ngày', '🔥', 'streak_days', 7),
('Month Master', 'Bậc Thầy Tháng', 'Maintain a 30-day learning streak', 'Duy trì chuỗi học 30 ngày', '⚡', 'streak_days', 30),
('Course Crusher', 'Người Chinh Phục', 'Complete 5 courses', 'Hoàn thành 5 khóa học', '🏆', 'courses_completed', 5),
('Quiz Master', 'Bậc Thầy Quiz', 'Score 100% on 10 quizzes', 'Đạt 100% trong 10 bài kiểm tra', '🎓', 'perfect_quiz', 10),
('Community Helper', 'Người Giúp Đỡ', 'Get 50 upvotes on your answers', 'Nhận 50 upvotes cho câu trả lời', '💡', 'help_others', 50),
('Rising Star', 'Ngôi Sao Mới', 'Earn 1000 total points', 'Đạt 1000 điểm tổng', '⭐', 'total_points', 1000),
('Super Learner', 'Người Học Siêu Đẳng', 'Earn 5000 total points', 'Đạt 5000 điểm tổng', '🌟', 'total_points', 5000),
('Knowledge Seeker', 'Người Tìm Kiếm Tri Thức', 'Complete your first course', 'Hoàn thành khóa học đầu tiên', '📚', 'complete_course', 1),
('Dedicated Learner', 'Người Học Tận Tụy', 'Complete 10 courses', 'Hoàn thành 10 khóa học', '🎖️', 'courses_completed', 10);

-- Initialize user points for existing users
INSERT INTO user_points (user_id, total_points, current_streak, longest_streak, last_activity_date, level, level_name) VALUES
(5, 1250, 5, 12, CURDATE(), 2, 'Learner'),
(6, 3500, 10, 15, CURDATE(), 3, 'Scholar'),
(7, 2100, 7, 10, CURDATE(), 3, 'Scholar');

-- Insert some subscriptions
INSERT INTO subscriptions (user_id, tier, status, end_date) VALUES
(5, 'pro', 'active', DATE_ADD(NOW(), INTERVAL 1 MONTH)),
(6, 'premium', 'active', DATE_ADD(NOW(), INTERVAL 1 YEAR)),
(7, 'free', 'active', NULL);

-- Insert sample discussions
INSERT INTO discussions (course_id, lesson_id, user_id, title, content, is_question, is_answered, upvotes, views) VALUES
(1, 1, 5, 'How to install Python on Windows?', 'I am having trouble installing Python on my Windows machine. Can someone help?', TRUE, TRUE, 15, 245),
(1, 3, 6, 'Understanding if-else statements', 'Can someone explain the difference between if-elif-else and nested if statements?', TRUE, TRUE, 8, 123),
(2, 1, 7, 'Best code editor for web development?', 'What code editor do you recommend for web development? VS Code or Sublime?', FALSE, FALSE, 22, 567),
(10, NULL, 5, 'Resource recommendations for UI/UX', 'Looking for good books or websites to learn more about UI/UX principles', FALSE, FALSE, 12, 189);

-- Insert sample discussion comments
INSERT INTO discussion_comments (discussion_id, user_id, content, is_accepted_answer, upvotes) VALUES
(1, 2, 'You can download Python from python.org and follow the installation wizard. Make sure to check "Add Python to PATH"!', TRUE, 18),
(1, 6, 'I recommend using Python 3.11 or later for best compatibility.', FALSE, 5),
(2, 3, 'elif is used for multiple conditions in sequence, while nested if is used when you need to check conditions within conditions.', TRUE, 10),
(3, 2, 'VS Code is highly recommended! It has excellent extensions, built-in terminal, and great debugging tools.', FALSE, 25),
(3, 4, 'I use VS Code with Prettier and ESLint extensions. Game changer!', FALSE, 15);

-- Insert sample study group
INSERT INTO study_groups (name, description, course_id, creator_id, max_members, is_private) VALUES
('Python Beginners Group', 'A study group for beginners learning Python together', 1, 5, 30, FALSE),
('Web Dev Masters', 'Advanced web development study group', 2, 6, 50, FALSE),
('UI/UX Design Circle', 'Share and critique design work', 10, 7, 25, FALSE);

-- Insert study group members
INSERT INTO study_group_members (group_id, user_id, role) VALUES
(1, 5, 'admin'),
(1, 6, 'member'),
(1, 7, 'member'),
(2, 6, 'admin'),
(2, 5, 'moderator'),
(3, 7, 'admin'),
(3, 5, 'member');

-- Insert sample quizzes
INSERT INTO quizzes (lesson_id, title_en, title_vi, title_jp, description_en, description_vi, description_jp, passing_score, time_limit) VALUES
(1, 'Python Basics Quiz', 'Bài kiểm tra Python Cơ bản', 'Python基礎クイズ', 'Test your understanding of Python basics', 'Kiểm tra hiểu biết về Python cơ bản', 'Python基礎の理解をテスト', 70, 600),
(3, 'Control Flow Quiz', 'Bài kiểm tra Cấu trúc Điều khiển', '制御フロークイズ', 'Test your knowledge of if statements', 'Kiểm tra kiến thức về câu lệnh if', 'If文の知識をテスト', 70, 300),
(6, 'HTML Fundamentals Quiz', 'Bài kiểm tra HTML Cơ bản', 'HTML基礎クイズ', 'Test your HTML knowledge', 'Kiểm tra kiến thức HTML', 'HTMLの知識をテスト', 70, 450);

-- Insert quiz questions for Python Basics Quiz (quiz_id = 1)
INSERT INTO quiz_questions (quiz_id, question_en, question_vi, question_jp, question_type, order_index, points) VALUES
(1, 'What is Python?', 'Python là gì?', 'Pythonとは何ですか？', 'multiple_choice', 0, 1),
(1, 'Which of the following is a valid variable name in Python?', 'Tên biến nào sau đây hợp lệ trong Python?', 'Pythonで有効な変数名はどれですか？', 'multiple_choice', 1, 1),
(1, 'Python is a compiled language.', 'Python là ngôn ngữ biên dịch.', 'Pythonはコンパイル言語です。', 'true_false', 2, 1),
(1, 'What is the correct file extension for Python files?', 'Phần mở rộng tệp đúng cho tệp Python là gì?', 'Pythonファイルの正しい拡張子は何ですか？', 'multiple_choice', 3, 1);

-- Insert quiz options for question 1
INSERT INTO quiz_options (question_id, option_en, option_vi, option_jp, is_correct, order_index) VALUES
(1, 'A programming language', 'Một ngôn ngữ lập trình', 'プログラミング言語', TRUE, 0),
(1, 'A type of snake', 'Một loài rắn', 'ヘビの種類', FALSE, 1),
(1, 'A software application', 'Một ứng dụng phần mềm', 'ソフトウェアアプリケーション', FALSE, 2),
(1, 'A database', 'Một cơ sở dữ liệu', 'データベース', FALSE, 3);

-- Insert quiz options for question 2
INSERT INTO quiz_options (question_id, option_en, option_vi, option_jp, is_correct, order_index) VALUES
(2, 'my_variable', 'my_variable', 'my_variable', TRUE, 0),
(2, '2nd_variable', '2nd_variable', '2nd_variable', FALSE, 1),
(2, 'my-variable', 'my-variable', 'my-variable', FALSE, 2),
(2, 'my variable', 'my variable', 'my variable', FALSE, 3);

-- Insert quiz options for question 3 (True/False)
INSERT INTO quiz_options (question_id, option_en, option_vi, option_jp, is_correct, order_index) VALUES
(3, 'True', 'Đúng', '正しい', FALSE, 0),
(3, 'False', 'Sai', '間違い', TRUE, 1);

-- Insert quiz options for question 4
INSERT INTO quiz_options (question_id, option_en, option_vi, option_jp, is_correct, order_index) VALUES
(4, '.py', '.py', '.py', TRUE, 0),
(4, '.python', '.python', '.python', FALSE, 1),
(4, '.pt', '.pt', '.pt', FALSE, 2),
(4, '.pyt', '.pyt', '.pyt', FALSE, 3);

-- Insert quiz questions for Control Flow Quiz (quiz_id = 2)
INSERT INTO quiz_questions (quiz_id, question_en, question_vi, question_jp, question_type, order_index, points) VALUES
(2, 'What keyword is used for conditional statements in Python?', 'Từ khóa nào được sử dụng cho câu lệnh điều kiện trong Python?', 'Pythonの条件文に使用されるキーワードは何ですか？', 'multiple_choice', 0, 1),
(2, 'The elif keyword is short for else if.', 'Từ khóa elif là viết tắt của else if.', 'elifキーワードはelse ifの略です。', 'true_false', 1, 1);

-- Insert quiz options for Control Flow questions
INSERT INTO quiz_options (question_id, option_en, option_vi, option_jp, is_correct, order_index) VALUES
(5, 'if', 'if', 'if', TRUE, 0),
(5, 'when', 'when', 'when', FALSE, 1),
(5, 'check', 'check', 'check', FALSE, 2),
(5, 'condition', 'condition', 'condition', FALSE, 3),
(6, 'True', 'Đúng', '正しい', TRUE, 0),
(6, 'False', 'Sai', '間違い', FALSE, 1);

-- ==================== Additional Tables ====================

-- Coupons table (must be created before orders)
CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INT DEFAULT 0,
  used_count INT DEFAULT 0,
  min_purchase DECIMAL(10, 2) DEFAULT 0,
  max_discount DECIMAL(10, 2),
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Cart table
CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_cart_item (user_id, course_id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  coupon_id INT NULL,
  discount_amount DECIMAL(10, 2) DEFAULT 0.00,
  final_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(50),
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  course_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  gateway VARCHAR(100) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  gateway_response TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Coupon Usage table
CREATE TABLE IF NOT EXISTS coupon_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  coupon_id INT NOT NULL,
  user_id INT NOT NULL,
  order_id INT,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
  admin_notes TEXT,
  processed_by INT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Blogs table
CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  thumbnail VARCHAR(500),
  author_id INT NOT NULL,
  category VARCHAR(100),
  tags TEXT,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  views INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Blog Comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_id INT,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES blog_comments(id) ON DELETE CASCADE
);

-- Blog Likes table
CREATE TABLE IF NOT EXISTS blog_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_blog_like (blog_id, user_id)
);

-- Blog Bookmarks table
CREATE TABLE IF NOT EXISTS blog_bookmarks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blog_id) REFERENCES blogs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_blog_bookmark (blog_id, user_id)
);

-- Contact Messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  message TEXT NOT NULL,
  status ENUM('new', 'read', 'replied', 'archived') DEFAULT 'new',
  admin_notes TEXT,
  replied_at TIMESTAMP NULL,
  replied_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_course (user_id, course_id),
  INDEX idx_user_wishlist (user_id),
  INDEX idx_course_wishlist (course_id)
);

-- Lesson Notes table
CREATE TABLE IF NOT EXISTS lesson_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  lesson_id INT NOT NULL,
  course_id INT NOT NULL,
  content TEXT NOT NULL,
  timestamp INT, -- for video notes: at which second
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user_course_notes (user_id, course_id),
  INDEX idx_lesson_notes (lesson_id)
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  lesson_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  instructions TEXT,
  max_score INT DEFAULT 100,
  due_date TIMESTAMP,
  allow_late_submission BOOLEAN DEFAULT TRUE,
  file_types_allowed VARCHAR(255),
  max_file_size INT DEFAULT 10,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL,
  INDEX idx_course_assignments (course_id)
);

-- Auto Generated Quizzes table (AI creates quiz when course is completed)
CREATE TABLE IF NOT EXISTS auto_generated_quizzes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  passing_score INT DEFAULT 70,
  time_limit INT DEFAULT 30,
  questions_data JSON NOT NULL COMMENT 'JSON array of generated questions',
  status ENUM('pending', 'completed', 'expired') DEFAULT 'pending',
  score INT DEFAULT NULL,
  passed BOOLEAN DEFAULT NULL,
  attempted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user_auto_quiz (user_id),
  INDEX idx_course_auto_quiz (course_id),
  INDEX idx_auto_quiz_status (status)
);

-- Assignment Submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  user_id INT NOT NULL,
  file_url VARCHAR(500),
  submission_text TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_late BOOLEAN DEFAULT FALSE,
  status ENUM('submitted', 'graded', 'returned') DEFAULT 'submitted',
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_assignment (user_id, assignment_id),
  INDEX idx_assignment_submissions (assignment_id),
  INDEX idx_user_submissions (user_id)
);

-- Assignment Grades table
CREATE TABLE IF NOT EXISTS assignment_grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  instructor_id INT NOT NULL,
  score INT NOT NULL,
  feedback TEXT,
  graded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_submission_grade (submission_id)
);

-- Wallets table for user balance management
CREATE TABLE IF NOT EXISTS wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'VND',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_wallet (user_id)
);

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('deposit', 'withdrawal', 'payment', 'refund', 'commission', 'purchase', 'withdraw') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) DEFAULT 0.00,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id VARCHAR(255),
  reference_type VARCHAR(50),
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_wallet_transactions (wallet_id),
  INDEX idx_user_transactions (user_id),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_created_at (created_at)
);
