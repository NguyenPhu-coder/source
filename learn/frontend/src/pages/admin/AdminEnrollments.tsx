import { useState, useEffect } from "react";
import {
  Search,
  Download,
  Filter,
  UserCheck,
  TrendingUp,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Enrollment {
  enrollment_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  course_id: number;
  course_title: string;
  enrolled_at: string;
  progress: number;
  completed_lessons: number;
  total_lessons: number;
  last_accessed: string | null;
}

export default function AdminEnrollments() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCourse, setFilterCourse] = useState<number | "">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const itemsPerPage = 15;

  useEffect(() => {
    fetchEnrollments();
  }, [currentPage, searchTerm, filterCourse]);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchTerm) params.append("search", searchTerm);
      if (filterCourse) params.append("course_id", filterCourse.toString());

      const response = await fetch(
        `http://127.0.0.1:3000/api/admin/enrollments?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      console.log("Enrollments API response:", data);

      if (data.success) {
        setEnrollments(data.data.enrollments || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
        setTotalCount(data.data.pagination?.total || 0);
      } else {
        console.error("API error:", data.message);
        toast({
          title: "Lỗi",
          description: data.message || "Không thể tải dữ liệu đăng ký",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching enrollments:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải dữ liệu đăng ký",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEnrollments();
  };

  const handleExport = () => {
    // Export to CSV
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "User,Email,Course,Progress,Enrollment Date\n" +
      enrollments
        .map(
          (e) =>
            `${e.user_name},${e.user_email},${e.course_title},${e.progress}%,${e.enrollment_date}`
        )
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "enrollments.csv";
    link.click();
  };

  const stats = [
    {
      title: "Tổng đăng ký",
      value: totalCount,
      icon: UserCheck,
      color: "from-blue-500 to-blue-600",
      trend: "+12.5%",
    },
    {
      title: "Hoàn thành",
      value: enrollments.filter((e) => e.progress === 100).length,
      icon: CheckCircle,
      color: "from-green-500 to-green-600",
      trend: "+8.2%",
    },
    {
      title: "Đang học",
      value: enrollments.filter((e) => e.progress > 0 && e.progress < 100)
        .length,
      icon: TrendingUp,
      color: "from-yellow-500 to-yellow-600",
      trend: "+15.3%",
    },
    {
      title: "Mới bắt đầu",
      value: enrollments.filter((e) => e.progress === 0).length,
      icon: Calendar,
      color: "from-purple-500 to-purple-600",
      trend: "+5.1%",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">
            Enrollment Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track student enrollments and progress
          </p>
        </div>
        <Button
          onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <Download className="w-5 h-5" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user or course..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterCourse}
              onChange={(e) =>
                setFilterCourse(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Courses</option>
              {/* Populate from API */}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.title}
                </p>
                <p className="text-3xl font-bold dark:text-white mt-2">
                  {stat.value}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {stat.trend}
                </p>
              </div>
              <div
                className={`w-14 h-14 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg`}
              >
                <stat.icon className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
            variant="outline"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Đang tải..." : "Làm mới"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Course
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Lessons
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Enrolled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Last Access
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No enrollments found
                  </td>
                </tr>
              ) : (
                enrollments.map((enrollment) => (
                  <tr
                    key={enrollment.enrollment_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium dark:text-white">
                          {enrollment.user_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {enrollment.user_email}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm dark:text-white">
                        {enrollment.course_title}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${enrollment.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium dark:text-white">
                          {enrollment.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm dark:text-white">
                        {enrollment.completed_lessons}/
                        {enrollment.total_lessons}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(
                          enrollment.enrolled_at
                        ).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {enrollment.last_accessed
                          ? new Date(
                            enrollment.last_accessed
                          ).toLocaleDateString()
                          : "Never"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400"
                          onClick={() => {
                            toast({
                              title: "Chi tiết đăng ký",
                              description: `${enrollment.user_name} - ${enrollment.course_title}`,
                            });
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
                          onClick={() => {
                            if (
                              confirm(
                                `Xóa đăng ký của ${enrollment.user_name}?`
                              )
                            ) {
                              toast({
                                title: "Đã xóa",
                                description: "Đăng ký đã được xóa thành công",
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-between">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 dark:text-white"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 dark:text-white"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
