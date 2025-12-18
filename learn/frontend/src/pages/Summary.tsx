import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  BarChart3,
  Users,
  BookOpen,
  TrendingUp,
  Award,
  Clock,
  Star,
  Target,
} from "lucide-react";

interface SummaryStats {
  totalCourses: number;
  totalStudents: number;
  totalInstructors: number;
  avgRating: number;
  completionRate: number;
  totalHours: number;
}

interface PopularCourse {
  id: number;
  title: string;
  students: number;
  rating: number;
}

export default function Summary() {
  const [stats, setStats] = useState<SummaryStats>({
    totalCourses: 0,
    totalStudents: 0,
    totalInstructors: 0,
    avgRating: 0,
    completionRate: 0,
    totalHours: 0,
  });
  const [popularCourses, setPopularCourses] = useState<PopularCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);

      // Fetch courses
      const coursesRes = await fetch("http://127.0.0.1:3000/api/courses");
      const coursesData = await coursesRes.json();

      if (coursesData.success) {
        const courses = coursesData.data || [];
        const totalStudents = courses.reduce(
          (sum: number, c: any) => sum + (c.total_students || 0),
          0
        );
        const avgRating =
          courses.length > 0
            ? courses.reduce(
                (sum: number, c: any) => sum + (c.rating || 0),
                0
              ) / courses.length
            : 0;

        setStats({
          totalCourses: courses.length,
          totalStudents,
          totalInstructors: 50, // Mock data
          avgRating: parseFloat(avgRating.toFixed(1)),
          completionRate: 78, // Mock data
          totalHours: 1250, // Mock data
        });

        // Get top 5 popular courses
        const sorted = [...courses]
          .sort((a, b) => (b.total_students || 0) - (a.total_students || 0))
          .slice(0, 5)
          .map((c: any) => ({
            id: c.id,
            title: c.title,
            students: c.total_students || 0,
            rating: c.rating || 0,
          }));

        setPopularCourses(sorted);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      icon: BookOpen,
      label: "Tổng khóa học",
      value: stats.totalCourses,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      icon: Users,
      label: "Tổng học viên",
      value: stats.totalStudents.toLocaleString(),
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      icon: Award,
      label: "Giảng viên",
      value: stats.totalInstructors,
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      icon: Star,
      label: "Đánh giá TB",
      value: `${stats.avgRating}/5`,
      color: "from-yellow-500 to-orange-500",
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
    {
      icon: Target,
      label: "Tỉ lệ hoàn thành",
      value: `${stats.completionRate}%`,
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      icon: Clock,
      label: "Tổng giờ học",
      value: `${stats.totalHours}h`,
      color: "from-indigo-500 to-purple-500",
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero Header */}
      <section className="relative bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 py-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-10 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-xl border border-white/30 rounded-full text-white mb-6">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-semibold">Thống kê tổng quan</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
              Tổng quan hệ thống
            </h1>
            <p className="text-xl text-purple-100 mb-8">
              Thống kê và phân tích toàn diện về nền tảng học trực tuyến
            </p>
          </div>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {statCards.map((stat, index) => (
              <div
                key={index}
                className="bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden hover-lift border border-gray-100"
              >
                <div className={`h-2 bg-gradient-to-r ${stat.color}`} />
                <div className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-14 h-14 ${stat.bgColor} rounded-2xl flex items-center justify-center`}
                    >
                      <stat.icon className={`w-7 h-7 ${stat.iconColor}`} />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2">
                    {stat.value}
                  </h3>
                  <p className="text-gray-600 font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Popular Courses */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Top 5 Khóa học phổ biến
              </h2>
            </div>

            <div className="space-y-4">
              {popularCourses.map((course, index) => (
                <div
                  key={course.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-100 hover:shadow-lg transition-all"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 mb-1">
                      {course.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {course.students.toLocaleString()} học viên
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        {course.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
