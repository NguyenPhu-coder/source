import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Download,
  RefreshCw,
  Award,
  Star,
  BarChart3,
  PieChart,
  Activity,
  Plus,
  UserPlus,
  BookPlus,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Statistics {
  users: { role: string; count: number }[];
  courses: {
    total_courses: number;
    published_courses: number;
  };
  enrollments: {
    total_enrollments: number;
    completed_enrollments: number;
  };
  recentUsers: number;
  topCourses: {
    id: number;
    title_en: string;
    enrollments: number;
    rating: number;
  }[];
  growthData: {
    date: string;
    users: number;
  }[];
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await fetch(
        "http://127.0.0.1:3000/api/admin/statistics",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatistics();
  };

  const exportToCSV = () => {
    if (!stats) return;

    const csvData = [
      ["Metric", "Value"],
      ["Total Users", totalUsers.toString()],
      ["Total Courses", stats.courses.total_courses.toString()],
      ["Published Courses", stats.courses.published_courses.toString()],
      ["Total Enrollments", stats.enrollments.total_enrollments.toString()],
      [
        "Completed Enrollments",
        stats.enrollments.completed_enrollments.toString(),
      ],
      ["Completion Rate", `${completionRate}%`],
      ["Recent Users", stats.recentUsers.toString()],
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">
            Đang tải dữ liệu phân tích...
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No data available</div>
      </div>
    );
  }

  const totalUsers = stats.users.reduce((sum, u) => sum + u.count, 0);
  const completionRate =
    stats.enrollments.total_enrollments > 0
      ? (
          (stats.enrollments.completed_enrollments /
            stats.enrollments.total_enrollments) *
          100
        ).toFixed(1)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Bảng Phân Tích & Thống Kê
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cập nhật lần cuối:{" "}
            {lastUpdated.toLocaleString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Đang tải..." : "Làm mới"}
          </Button>
          <Button onClick={exportToCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => navigate("/admin/users")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
            <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">
              Thêm người dùng
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tạo tài khoản mới
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/courses")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl hover:border-purple-500 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
            <BookPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">
              Thêm khóa học
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Tạo khóa học mới
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/categories")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl hover:border-green-500 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
            <Plus className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">
              Thêm danh mục
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Quản lý phân loại
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/settings")}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-xl hover:border-orange-500 hover:shadow-md transition-all group"
        >
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
            <Settings className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 dark:text-white">
              Cài đặt
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cấu hình hệ thống
            </p>
          </div>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">
                Tổng người dùng
              </p>
              <p className="text-4xl font-bold">{totalUsers}</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="bg-white/20 rounded-full px-2 py-1 text-xs font-semibold">
                  +{stats.recentUsers} tháng này
                </div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
              <Users className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium mb-1">
                Tổng khóa học
              </p>
              <p className="text-4xl font-bold">
                {stats.courses.total_courses}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="bg-white/20 rounded-full px-2 py-1 text-xs font-semibold">
                  {stats.courses.published_courses} đã xuất bản
                </div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
              <BookOpen className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium mb-1">
                Tổng ghi danh
              </p>
              <p className="text-4xl font-bold">
                {stats.enrollments.total_enrollments}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="bg-white/20 rounded-full px-2 py-1 text-xs font-semibold">
                  {stats.enrollments.completed_enrollments} hoàn thành
                </div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
              <GraduationCap className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium mb-1">
                Tỷ lệ hoàn thành
              </p>
              <p className="text-4xl font-bold">{completionRate}%</p>
              <div className="flex items-center gap-2 mt-3">
                <div className="bg-white/20 rounded-full px-2 py-1 text-xs font-semibold">
                  Trung bình
                </div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-100 dark:border-blue-900 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tỷ lệ xuất bản
            </h3>
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Đã xuất bản
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.courses.published_courses}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    (stats.courses.published_courses /
                      stats.courses.total_courses) *
                    100
                  }%`,
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(
                (stats.courses.published_courses /
                  stats.courses.total_courses) *
                100
              ).toFixed(1)}
              % từ tổng số khóa học
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-green-100 dark:border-green-900 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tình trạng ghi danh
            </h3>
            <PieChart className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Hoàn thành
                </span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.enrollments.completed_enrollments}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Đang học
                </span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {stats.enrollments.total_enrollments -
                  stats.enrollments.completed_enrollments}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-purple-100 dark:border-purple-900 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Người dùng mới
            </h3>
            <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats.recentUsers}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              người dùng
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Đăng ký trong 30 ngày qua
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Role */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Người dùng theo vai trò
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Tổng: {totalUsers} người
            </div>
          </div>
          <div className="space-y-4">
            {stats.users.map((user) => {
              const percentage = ((user.count / totalUsers) * 100).toFixed(1);
              const roleColors = {
                student: "bg-blue-600",
                instructor: "bg-purple-600",
                admin: "bg-red-600",
              };
              const roleNames = {
                student: "Học viên",
                instructor: "Giảng viên",
                admin: "Quản trị viên",
              };

              return (
                <div key={user.role} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {roleNames[user.role as keyof typeof roleNames] ||
                        user.role}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {user.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`${
                        roleColors[user.role as keyof typeof roleColors] ||
                        "bg-gray-600"
                      } h-3 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Courses */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-500" />
              Khóa học phổ biến
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Top 5
            </div>
          </div>
          <div className="space-y-3">
            {stats.topCourses.map((course, index) => (
              <div
                key={course.id}
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-lg border border-gray-100 dark:border-gray-600 hover:shadow-md transition-all"
              >
                <div
                  className={`
                  w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-lg
                  ${
                    index === 0
                      ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                      : index === 1
                      ? "bg-gradient-to-br from-gray-300 to-gray-500"
                      : index === 2
                      ? "bg-gradient-to-br from-orange-400 to-orange-600"
                      : "bg-gradient-to-br from-blue-400 to-blue-600"
                  }
                `}
                >
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {course.title_en}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {course.enrollments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {course.rating ? Number(course.rating).toFixed(1) : "0.0"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            Tăng trưởng người dùng
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            7 ngày gần nhất
          </div>
        </div>
        <div className="space-y-3">
          {stats.growthData.map((day, index) => {
            const maxUsers = Math.max(...stats.growthData.map((d) => d.users));
            const percentage = maxUsers > 0 ? (day.users / maxUsers) * 100 : 0;

            return (
              <div key={day.date} className="flex items-center gap-4">
                <div className="w-28 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {new Date(day.date).toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </div>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg h-10 relative overflow-hidden">
                  <div
                    className={`h-full rounded-lg flex items-center justify-end pr-3 transition-all duration-700 ${
                      index === stats.growthData.length - 1
                        ? "bg-gradient-to-r from-blue-500 to-blue-600"
                        : "bg-gradient-to-r from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-500"
                    }`}
                    style={{
                      width: `${Math.max(percentage, 5)}%`,
                    }}
                  >
                    <span className="text-white text-sm font-bold">
                      {day.users}
                    </span>
                  </div>
                </div>
                <div className="w-16 text-right text-sm text-gray-500 dark:text-gray-400">
                  {percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.growthData.reduce((sum, d) => sum + d.users, 0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Tổng người dùng mới
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {(
                  stats.growthData.reduce((sum, d) => sum + d.users, 0) /
                  stats.growthData.length
                ).toFixed(0)}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Trung bình/ngày
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Math.max(...stats.growthData.map((d) => d.users))}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Cao nhất
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
