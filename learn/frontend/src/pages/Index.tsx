import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import CourseCard from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import apiClient from "@/api/client";
import { motion } from "framer-motion";
import { fadeIn, slideUp, staggerContainer } from "@/utils/animations";
import { ArrowRight, Star, Users, BookOpen, CheckCircle } from "lucide-react";

export default function Index() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    fetchData();
  }, [language]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const coursesRes = await apiClient.getCourses({ limit: 12 });

      if (coursesRes.success) {
        setCourses(coursesRes.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      {/* Premium Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        {/* Abstract Background */}
        <div className="absolute inset-0 bg-background">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div variants={fadeIn} className="inline-block px-4 py-2 rounded-full glass-panel mb-6 border-primary/20">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">🌟 Nền tảng học tập số 1 Việt Nam</span>
            </motion.div>

            <motion.h1 variants={slideUp} className="text-5xl md:text-7xl font-extrabold text-foreground mb-8 leading-tight tracking-tight">
              Nâng Tầm Tri Thức <br />
              <span className="text-gradient">Chinh Phục Tương Lai</span>
            </motion.h1>

            <motion.p variants={fadeIn} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Truy cập không giới hạn hàng nghìn khóa học chất lượng cao từ các chuyên gia hàng đầu. Học mọi lúc, mọi nơi, theo cách của riêng bạn.
            </motion.p>

            <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/courses">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-blue-600 shadow-xl shadow-blue-500/30 transition-all hover:scale-105">
                  Bắt đầu ngay <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/about">
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-2 hover:bg-secondary/50 transition-all hover:scale-105">
                  Tìm hiểu thêm
                </Button>
              </Link>
            </motion.div>

            {/* Stats */}
            <motion.div variants={fadeIn} className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 pt-10 border-t border-border/40">
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">10K+</div>
                <div className="text-sm text-muted-foreground">Học viên</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">500+</div>
                <div className="text-sm text-muted-foreground">Khóa học</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">100+</div>
                <div className="text-sm text-muted-foreground">Chuyên gia</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">4.9/5</div>
                <div className="text-sm text-muted-foreground">Đánh giá</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6 md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex justify-between items-end mb-12"
          >
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Khóa học nổi bật</h2>
              <p className="text-muted-foreground">Được yêu thích nhất tuần qua</p>
            </div>
            <Link to="/courses" className="hidden md:flex items-center text-primary font-semibold hover:gap-2 transition-all">
              Xem tất cả <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {courses.slice(0, 8).map((course) => (
                <CourseCard
                  key={course.id}
                  id={course.id.toString()}
                  title={course.title}
                  instructor={course.instructor}
                  rating={course.rating}
                  reviews={course.total_reviews}
                  students={course.total_students}
                  lessons={course.total_lessons}
                  difficulty={course.level}
                  thumbnail={course.thumbnail}
                  price={course.price}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-background overflow-hidden relative">
        <div className="container mx-auto px-6 md:px-12">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-3xl transform rotate-3 opacity-20 blur-lg"></div>
              <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80" alt="Why us" className="relative rounded-3xl shadow-2xl transform -rotate-2 hover:rotate-0 transition-all duration-500 object-cover" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-8">Tại sao chọn LearnHub?</h2>
              <div className="space-y-8">
                {[
                  { icon: Star, title: "Chất lượng hàng đầu", desc: "Nội dung được kiểm duyệt kỹ lưỡng bởi hội đồng chuyên môn." },
                  { icon: Users, title: "Cộng đồng sôi nổi", desc: "Học tập và thảo luận cùng hàng nghìn học viên khác." },
                  { icon: CheckCircle, title: "Chứng chỉ uy tín", desc: "Nhận chứng chỉ hoàn thành khóa học có giá trị." }
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="flex gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section - NEW */}
      <section className="py-20 relative overflow-hidden bg-secondary/20">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-black/10"></div>
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeIn}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-semibold mb-4">
              <span>✨</span> Công nghệ tiên tiến
            </div>
            <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-6 leading-tight">
              Học Tập Thông Minh Với AI
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Trải nghiệm kỷ nguyên học tập mới với trợ lý ảo AI, lộ trình cá nhân hóa và phân tích chuyên sâu.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              variants={slideUp}
              className="glass-panel p-8 rounded-2xl border border-white/20 hover:border-indigo-500/30 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  🤖
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">AI Mentor 24/7</h3>
                <p className="text-muted-foreground mb-6 line-clamp-3">
                  Hỏi đáp tức thì, giải thích chi tiết và hướng dẫn làm bài tập mọi lúc mọi nơi với trợ lý AI thông minh.
                </p>
                <Link to="/ai-dashboard" className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:gap-2 transition-all group-hover:translate-x-1">
                  Khám phá ngay <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              variants={slideUp}
              className="glass-panel p-8 rounded-2xl border border-white/20 hover:border-purple-500/30 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  📊
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Lộ trình Cá nhân hóa</h3>
                <p className="text-muted-foreground mb-6 line-clamp-3">
                  AI phân tích phong cách học tập của bạn để đề xuất khóa học và lộ trình tối ưu nhất cho sự nghiệp.
                </p>
                <Link to="/ai-dashboard" className="inline-flex items-center text-purple-600 dark:text-purple-400 font-semibold hover:gap-2 transition-all group-hover:translate-x-1">
                  Xem lộ trình <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            <motion.div
              variants={slideUp}
              className="glass-panel p-8 rounded-2xl border border-white/20 hover:border-pink-500/30 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  🎯
                </div>
                <h3 className="text-xl font-bold mb-3 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">Đánh giá Năng lực</h3>
                <p className="text-muted-foreground mb-6 line-clamp-3">
                  Hệ thống bài kiểm tra thông minh giúp đánh giá chính xác kỹ năng và gợi ý các điểm cần cải thiện.
                </p>
                <Link to="/analytics" className="inline-flex items-center text-pink-600 dark:text-pink-400 font-semibold hover:gap-2 transition-all group-hover:translate-x-1">
                  Xem báo cáo <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-24">
        <div className="container mx-auto px-6 md:px-12">
          <div className="relative rounded-3xl bg-gradient-to-r from-blue-900 to-slate-900 px-6 py-16 md:px-12 md:py-24 overflow-hidden text-center">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <BookOpen className="w-64 h-64 text-white" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Sẵn sang thay đổi sự nghiệp của bạn?</h2>
              <p className="text-blue-100 text-lg mb-8">Đừng chờ đợi nữa. Hãy bắt đầu hành trình học tập ngay hôm nay.</p>
              <Link to="/register">
                <Button size="lg" className="bg-white text-blue-900 hover:bg-gray-100 px-10 py-6 text-lg font-bold rounded-full shadow-xl">
                  Đăng ký tài khoản miễn phí
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
