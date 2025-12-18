import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getImageUrl, getSmallPlaceholder } from "@/utils/imageUrl";
import {
  BookOpen,
  Users,
  Star,
  Clock,
  Edit,
  Trash2,
  Plus,
  Search,
  TrendingUp,
  Eye,
  Sparkles,
} from "lucide-react";

interface Course {
  id: number;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  level: string;
  duration: number;
  category: string;
  total_students: number;
  total_lessons: number;
  rating: number;
  total_reviews: number;
  created_at: string;
}

export default function InstructorCourses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (user?.role !== "instructor" && user?.role !== "admin") {
      navigate("/");
      return;
    }

    fetchCourses();
  }, [user, page]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await apiClient.request(
        `/instructor/courses?page=${page}&limit=10`
      );
      console.log("Courses API response:", response);
      // Backend paginationResponse returns: { success, data: [...courses], pagination }
      setCourses(Array.isArray(response.data) ? response.data : []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Error fetching courses:", error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = (courses || []).filter((course) =>
    course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm("Bạn có chắc chắn muốn xóa khóa học này không?")) return;

    try {
      const response = await apiClient.deleteCourse(courseId);

      if (response.success) {
        toast({
          title: "Thành công",
          description: "Đã xóa khóa học thành công",
        });
        fetchCourses();
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Khóa học của tôi</h1>
          <p className="text-gray-600 mt-2">Quản lý khóa học và nội dung</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/instructor/courses/from-document")} className="border-purple-300 text-purple-600 hover:bg-purple-50">
            <Sparkles className="mr-2 h-4 w-4" />
            Tạo từ tài liệu (AI)
          </Button>
          <Button onClick={() => navigate("/instructor/courses/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Tạo khóa học mới
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Search courses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No courses yet
            </h3>
            <p className="text-gray-600 mb-4">
              Start creating your first course to share your knowledge
            </p>
            <Button onClick={() => navigate("/instructor/courses/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex gap-6">
                  {/* Thumbnail */}
                  <img
                    src={getImageUrl(course.thumbnail)}
                    alt={course.title}
                    className="w-48 h-32 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        getSmallPlaceholder();
                    }}
                  />

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {course.title}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {course.description}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/course/${course.id}`)}
                          title="Xem khóa học"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            navigate(`/instructor/courses/${course.id}/edit`)
                          }
                          title="Chỉnh sửa"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCourse(course.id)}
                          title="Xóa khóa học"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                      <Badge variant="secondary">{course.category}</Badge>
                      <Badge variant="outline">{course.level}</Badge>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {course.total_students} students
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {course.total_lessons} lessons
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {Math.floor(course.duration / 60)}h{" "}
                        {course.duration % 60}m
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">
                            {course.rating.toFixed(1)}
                          </span>
                          <span className="text-sm text-gray-600">
                            ({course.total_reviews} reviews)
                          </span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">
                          ${course.price}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(`/instructor/courses/${course.id}/lessons`)
                          }
                        >
                          <BookOpen className="mr-2 h-4 w-4" />
                          Manage Lessons
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            navigate(
                              `/instructor/courses/${course.id}/analytics`
                            )
                          }
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          View Analytics
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
