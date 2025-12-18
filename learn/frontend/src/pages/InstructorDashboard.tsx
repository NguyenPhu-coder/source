import { useState, useEffect } from "react";
// @ts-ignore
import { useAuth } from "@/contexts/AuthContext";
import { getImageUrl, getSmallPlaceholder } from "@/utils/imageUrl";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/api/client";
import {
  BookOpen,
  Users,
  DollarSign,
  PlusCircle,
  Edit,
  Eye,
  Trash2,
  FileText,
  TrendingUp,
  MoreVertical,
  Sparkles,
  Brain,
} from "lucide-react";
// import Layout from "@/components/Layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface Course {
  id: number;
  title_vi: string;
  title_en: string;
  thumbnail: string;
  total_students: number;
  total_lessons: number;
  rating: number;
  total_reviews: number;
  price: number;
  is_published: boolean;
}

interface Stats {
  totalCourses: number;
  totalStudents: number;
  totalRevenue: number;
  averageRating: number;
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    totalStudents: 0,
    totalRevenue: 0,
    averageRating: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchInstructorData = async () => {
    try {
      const token = localStorage.getItem("token");

      // Lấy danh sách khóa học của instructor
      const coursesRes = await fetch(
        `http://127.0.0.1:3000/api/courses/instructor/${user?.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const response = await coursesRes.json();
      const coursesData = response.data || [];
      setCourses(coursesData);

      // Tính toán thống kê
      const totalStudents = coursesData.reduce(
        (sum: number, course: Course) => sum + course.total_students,
        0
      );
      const totalRevenue = coursesData.reduce(
        (sum: number, course: Course) =>
          sum + course.price * course.total_students,
        0
      );
      const avgRating =
        coursesData.reduce(
          (sum: number, course: Course) => sum + course.rating,
          0
        ) / coursesData.length || 0;

      setStats({
        totalCourses: coursesData.length,
        totalStudents,
        totalRevenue,
        averageRating: Number(avgRating.toFixed(1)),
      });
    } catch (error) {
      console.error("Error fetching instructor data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "instructor") {
      navigate("/");
      return;
    }
    fetchInstructorData();
  }, [user, navigate]);

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa khóa học này?")) return;

    try {
      const response = await apiClient.deleteCourse(courseId);

      if (response.success) {
        toast({
          title: "Thành công",
          description: "Đã xóa khóa học thành công",
        });
        fetchInstructorData();
      } else {
        throw new Error(response.message || "Không thể xóa khóa học");
      }
    } catch (error: any) {
      console.error("Error deleting course:", error);
      toast({
        title: "Lỗi",
        description:
          error.message || "Không thể xóa khóa học. Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500">Đang tải dữ liệu giảng viên...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bảng điều khiển
            </h1>
            <p className="text-gray-500">
              Chào mừng trở lại, <span className="text-gray-900 font-semibold">{user?.name}</span>! 👋
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/instructor/ai-quiz-generator">
              <Button variant="outline" className="h-10 px-6 rounded-full border-green-300 text-green-600 hover:bg-green-50">
                <Brain className="w-4 h-4 mr-2" />
                AI Tạo câu hỏi
              </Button>
            </Link>
            <Link to="/instructor/courses/from-document">
              <Button variant="outline" className="h-10 px-6 rounded-full border-purple-300 text-purple-600 hover:bg-purple-50">
                <Sparkles className="w-4 h-4 mr-2" />
                Tạo từ tài liệu (AI)
              </Button>
            </Link>
            <Link to="/instructor/courses/new">
              <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-6 rounded-full shadow-lg shadow-blue-200">
                <PlusCircle className="w-4 h-4 mr-2" />
                Tạo khóa học mới
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white relative overflow-hidden">
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-blue-100 flex justify-between items-center">
                  Tổng học viên
                  <Users className="w-4 h-4 text-blue-200" />
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold">{stats.totalStudents.toLocaleString()}</div>
                <p className="text-xs text-blue-100 mt-1">Học viên đang hoạt động</p>
              </CardContent>
              <div className="absolute right-0 bottom-0 opacity-10 scale-150 transform translate-x-4 translate-y-4">
                <Users className="w-24 h-24" />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-none shadow-lg bg-white relative overflow-hidden group hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex justify-between items-center">
                  Doanh thu
                  <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">
                  ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-green-600 flex items-center mt-1 font-medium">
                  <TrendingUp className="w-3 h-3 mr-1" /> +12.5% so với tháng trước
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-none shadow-lg bg-white relative overflow-hidden group hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex justify-between items-center">
                  Tổng khóa học
                  <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.totalCourses}</div>
                <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                  {courses.filter(c => c.is_published).length} đang hoạt động
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-none shadow-lg bg-white relative overflow-hidden group hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex justify-between items-center">
                  Đánh giá trung bình
                  <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                    <FileText className="w-4 h-4 text-orange-600" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.averageRating}/5.0</div>
                <p className="text-xs text-muted-foreground mt-1 text-gray-500">
                  Từ học viên của bạn
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Lối tắt</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Quản lý khóa học",
                desc: "Chỉnh sửa nội dung và bài giảng",
                icon: BookOpen, color: "text-blue-600", bg: "bg-blue-100",
                link: "/instructor/courses"
              },
              {
                title: "Danh sách học viên",
                desc: "Theo dõi tiến độ học viên",
                icon: Users, color: "text-purple-600", bg: "bg-purple-100",
                link: "/instructor/students"
              },
              {
                title: "Tạo bài viết mới",
                desc: "Chia sẻ kiến thức với cộng đồng",
                icon: Edit, color: "text-green-600", bg: "bg-green-100",
                link: "/instructor/blogs/new"
              }
            ].map((item, i) => (
              <Link to={item.link} key={i}>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer flex items-center gap-4 group">
                  <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Courses List */}
        <Card className="border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="border-b border-gray-100 bg-gray-50/30">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl text-gray-900">Danh sách khóa học gần đây</CardTitle>
              <Link to="/instructor/courses" className="text-sm text-blue-600 font-medium hover:underline">Xem tất cả</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {courses.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 mb-6">Bạn chưa có khóa học nào. Hãy bắt đầu ngay!</p>
                <Link to="/instructor/courses/new">
                  <Button>Tạo khóa học đầu tiên</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[400px]">Khóa học</TableHead>
                    <TableHead className="text-center">Học viên</TableHead>
                    <TableHead className="text-center">Giá</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-right pr-6">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.slice(0, 5).map((course) => (
                    <TableRow key={course.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                            <img
                              src={getImageUrl(course.thumbnail)}
                              alt={course.title_vi}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getSmallPlaceholder();
                              }}
                            />
                          </div>
                          <span className="line-clamp-1 font-semibold text-gray-900" title={course.title_vi || course.title_en}>
                            {course.title_vi || course.title_en}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          {course.total_students}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium text-gray-900">
                        ${course.price}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={course.is_published ? "default" : "secondary"} className={course.is_published ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}>
                          {course.is_published ? "Đã xuất bản" : "Nháp"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/course/${course.id}`)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteCourse(course.id)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
