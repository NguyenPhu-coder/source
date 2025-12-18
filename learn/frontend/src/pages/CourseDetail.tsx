import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/api/client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Users,
  BookOpen,
  Play,
  CheckCircle,
  Globe,
  BarChart3,
  Star,
  Award,
  ShieldCheck,
  Share2,
  Heart,
  Video,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { fadeIn, slideUp, staggerContainer } from "@/utils/animations";

export default function CourseDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCourseDetail();
    }
  }, [id]);

  useEffect(() => {
    if (id && isAuthenticated && course) {
      checkEnrollmentStatus();
    }
  }, [id, isAuthenticated, course?.id]);

  const checkEnrollmentStatus = async () => {
    try {
      setCheckingEnrollment(true);
      const response = await apiClient.getMyCourses();
      if (response.success) {
        const isEnrolled = response.data.some(
          (c: any) => c.course_id === parseInt(id!)
        );
        setCourse((prev: any) => {
          if (!prev) return prev;
          return { ...prev, isEnrolled };
        });
      }
    } catch (error) {
      console.error("Error checking enrollment:", error);
    } finally {
      setCheckingEnrollment(false);
    }
  };

  const fetchCourseDetail = async () => {
    try {
      setLoading(true);
      const [courseResponse, lessonsResponse] = await Promise.all([
        apiClient.getCourse(id!),
        apiClient.getLessons(id!),
      ]);

      if (courseResponse.success) {
        const courseData = {
          ...courseResponse.data,
          lessons: lessonsResponse.success ? lessonsResponse.data : [],
        };
        setCourse(courseData);
      }
    } catch (error) {
      console.error("Error fetching course:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollClick = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Vui lòng đăng nhập",
        description: "Bạn cần đăng nhập để đăng ký khóa học",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (course?.isEnrolled) {
      navigate("/my-learning");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast({
        title: "Yêu cầu đăng nhập",
        description: "Vui lòng đăng nhập để đăng ký khóa học",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    try {
      setEnrolling(true);

      if (course && course.price > 0) {
        // Khóa học có phí - Thêm vào giỏ hàng
        const response = await fetch("http://127.0.0.1:3000/api/cart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            course_id: parseInt(id!),
          }),
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Đã thêm vào giỏ hàng",
            description: "Chuyển đến giỏ hàng để thanh toán",
          });
          setTimeout(() => navigate("/cart"), 1000);
        } else {
          if (data.message?.includes("already in cart")) {
            toast({
              title: "Thông báo",
              description: "Khóa học đã có trong giỏ hàng",
            });
            setTimeout(() => navigate("/cart"), 1000);
          } else if (data.message?.includes("already enrolled")) {
            toast({
              title: "Thông báo",
              description: "Bạn đã đăng ký khóa học này",
            });
            setCourse((prev: any) => ({ ...prev, isEnrolled: true }));
          } else {
            throw new Error(data.message || "Không thể thêm vào giỏ hàng");
          }
        }
      } else {
        // Khóa học miễn phí
        try {
          const response = await apiClient.enrollCourse(parseInt(id!));

          if (response.success) {
            toast({
              title: "Đăng ký thành công!",
              description: "Bạn đã đăng ký khóa học miễn phí",
            });
            setCourse((prev: any) => ({ ...prev, isEnrolled: true }));
            setTimeout(() => navigate("/my-learning"), 1000);
          } else {
            if (response.message?.includes("Already enrolled")) {
              toast({
                title: "Thông báo",
                description: "Bạn đã đăng ký khóa học này",
              });
              setCourse((prev: any) => ({ ...prev, isEnrolled: true }));
              setTimeout(() => navigate("/my-learning"), 1000);
            } else {
              throw new Error(response.message || "Không thể đăng ký khóa học");
            }
          }
        } catch (enrollError: any) {
          console.error("Enroll error details:", enrollError);
          toast({
            title: "Lỗi",
            description: enrollError.message || "Có lỗi xảy ra",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Error enrolling:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra khi đăng ký",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenrollClick = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đăng ký khóa học này?")) {
      return;
    }

    try {
      setUnenrolling(true);
      const response = await apiClient.unenrollCourse(parseInt(id!));

      if (response.success) {
        toast({
          title: "Thành công",
          description: "Đã hủy đăng ký khóa học",
        });
        setCourse((prev: any) => ({ ...prev, isEnrolled: false }));
      } else {
        toast({
          title: "Lỗi",
          description: response.message || "Không thể hủy đăng ký",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error unenrolling:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setUnenrolling(false);
    }
  };

  if (loading || checkingEnrollment) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
            <p className="text-gray-600 font-medium animate-pulse">
              Đang tải dữ liệu...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
            <p className="text-gray-600 font-medium text-lg mb-4">
              Không tìm thấy khóa học
            </p>
            <Button onClick={() => navigate("/courses")}>
              Quay lại danh sách
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const totalDuration =
    course.lessons?.reduce(
      (sum: number, l: any) => sum + (l.duration || 0),
      0
    ) || 0;
  const hours = Math.floor(totalDuration / 60);
  const minutes = totalDuration % 60;

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-[#1a1b3a] relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 py-16 lg:py-24 relative z-10">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid lg:grid-cols-3 gap-12"
          >
            {/* Left Content */}
            <motion.div variants={fadeIn} className="lg:col-span-2 text-white">
              {/* Breadcrumb & Badges */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Badge
                  variant="secondary"
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-0"
                >
                  {course.category?.name || "Development"}
                </Badge>
                <div className="w-1 h-1 bg-white/30 rounded-full" />
                <span className="text-white/60 text-sm font-medium">
                  Cập nhật lần cuối 12/2025
                </span>
                <div className="w-1 h-1 bg-white/30 rounded-full" />
                <div className="flex items-center gap-1 text-yellow-400">
                  <span className="text-sm font-bold">4.8</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="w-3 h-3 fill-current"
                      />
                    ))}
                  </div>
                  <span className="text-white/60 text-sm ml-1">(1,234 đánh giá)</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight tracking-tight text-white">
                {course.title}
              </h1>

              {/* Description */}
              <p className="text-lg text-blue-100/90 mb-8 leading-relaxed max-w-2xl">
                {course.description?.substring(0, 150)}...
              </p>

              {/* Instructor & Meta */}
              <div className="flex flex-wrap items-center gap-8 mb-8 pb-8 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-white/20">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${course.instructor?.name}`} />
                    <AvatarFallback>{course.instructor?.name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-blue-200">Giảng viên</p>
                    <p className="font-semibold text-white">{course.instructor?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm font-medium text-blue-100">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span>{course.language}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span>{course.level}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white border-none backdrop-blur-sm">
                  <Share2 className="w-4 h-4 mr-2" />
                  Chia sẻ
                </Button>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white border-none backdrop-blur-sm">
                  <Heart className="w-4 h-4 mr-2" />
                  Lưu lại
                </Button>
              </div>

            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12 -mt-10 relative z-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">

            {/* What you'll learn */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={slideUp}
            >
              <Card className="border-gray-100 shadow-md overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    Bạn sẽ học được gì
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {course.lessons?.slice(0, 6).map((lesson: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm font-medium">{lesson.title}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Curriculum */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={slideUp}
            >
              <Card className="border-gray-100 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <CardTitle className="text-xl font-bold">Nội dung khóa học</CardTitle>
                    <CardDescription className="mt-1">
                      {course.total_lessons || 0} bài học • {hours} giờ {minutes} phút
                    </CardDescription>
                  </div>
                  <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
                    Mở rộng tất cả
                  </Button>
                </CardHeader>
                <CardContent className="pt-0">
                  <Accordion type="single" collapsible className="w-full">
                    {/* Group lessons into sections if data structure allows. Since we have flat list, we'll mimic sections or just list them nicely */}
                    {/* Here assuming flat list for simplicity but styling as list */}
                    {course.lessons?.map((lesson: any, index: number) => (
                      <AccordionItem key={lesson.id} value={`item-${lesson.id}`}>
                        <AccordionTrigger className="hover:no-underline hover:bg-gray-50 px-4 rounded-lg">
                          <div className="flex items-center gap-4 text-left">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{lesson.title}</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-14 pb-4 text-gray-600">
                          <div className="flex items-center gap-4 mb-2">
                            <Badge variant="outline" className="text-xs bg-gray-50">
                              <Play className="w-3 h-3 mr-1" />
                              {lesson.duration} phút
                            </Badge>
                            <Badge variant="outline" className="text-xs bg-gray-50">
                              Video
                            </Badge>
                          </div>
                          <p>{lesson.description || "Nội dung chi tiết của bài học..."}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </motion.div>

            {/* Detailed Description */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={slideUp}
            >
              <Card className="border-gray-100 shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Mô tả chi tiết</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-blue max-w-none text-gray-700 leading-relaxed">
                    {course.description?.split('\n').map((paragraph: string, idx: number) => (
                      <p key={idx} className="mb-4">{paragraph}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Instructor */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={slideUp}
            >
              <Card className="border-gray-100 shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">Giảng viên của bạn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-6">
                    <Avatar className="w-24 h-24 border-4 border-gray-50 shadow-sm">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${course.instructor?.name}`} />
                      <AvatarFallback className="text-2xl">{course.instructor?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{course.instructor?.name}</h3>
                      <p className="text-blue-600 font-medium mb-3">Senior Developer</p>

                      <div className="flex gap-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>10K+ Học viên</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Play className="w-4 h-4" />
                          <span>20 Khóa học</span>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm leading-relaxed">
                        Giảng viên có nhiều năm kinh nghiệm trong lĩnh vực lập trình và đào tạo. Đã từng làm việc tại các công ty công nghệ lớn và đam mê chia sẻ kiến thức.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Preview Card */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 lg:-mt-48 relative z-30"
              >
                <div className="relative aspect-video bg-gray-900 group cursor-pointer">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Video className="w-12 h-12 text-gray-600" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-blue-600 ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <span className="text-white font-medium text-sm drop-shadow-md">Xem giới thiệu khóa học</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    {course.price > 0 ? (
                      <div className="flex items-end gap-3 text-gray-900">
                        <span className="text-3xl font-bold">
                          {course.price.toLocaleString("vi-VN")}đ
                        </span>
                        <span className="text-lg text-gray-400 line-through mb-1">
                          {(course.price * 1.5).toLocaleString("vi-VN")}đ
                        </span>
                        <Badge className="mb-2 bg-red-100 text-red-600 hover:bg-red-100 border-red-200">
                          -33%
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-green-600">
                        Miễn phí
                      </span>
                    )}
                  </div>

                  {course.isEnrolled ? (
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-lg shadow-lg shadow-green-600/20"
                        onClick={() => navigate("/my-learning")}
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Vào học ngay
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-gray-200 text-gray-600 hover:text-gray-900"
                        onClick={handleUnenrollClick}
                        disabled={unenrolling}
                      >
                        Hủy đăng ký
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02]"
                        onClick={handleEnrollClick}
                        disabled={enrolling}
                      >
                        {enrolling ? (
                          "Đang xử lý..."
                        ) : course.price > 0 ? (
                          "Thêm vào giỏ hàng"
                        ) : (
                          "Đăng ký ngay"
                        )}
                      </Button>
                      {course.price > 0 && (
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full font-semibold border-blue-600 text-blue-600 hover:bg-blue-50"
                          onClick={handleEnrollClick}
                        >
                          Mua ngay
                        </Button>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-center text-gray-500 mt-3">
                    Đảm bảo hoàn tiền trong 30 ngày
                  </p>

                  <div className="mt-6 space-y-4">
                    <h4 className="font-semibold text-gray-900">Khóa học này bao gồm:</h4>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-center gap-3">
                        <Video className="w-4 h-4 text-gray-400" />
                        <span>{hours} giờ video</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        <span>{course.total_lessons || 0} bài học</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <ShieldCheck className="w-4 h-4 text-gray-400" />
                        <span>Quyền truy cập trọn đời</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span>Truy cập trên mobile và web</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <Award className="w-4 h-4 text-gray-400" />
                        <span>Chứng chỉ hoàn thành</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* For Business */}
              <Card className="border-gray-100 bg-gray-50/50">
                <CardContent className="p-6">
                  <h4 className="font-bold text-gray-900 mb-2">Đào tạo doanh nghiệp</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Bạn muốn đào tạo cho đội ngũ của mình? Liên hệ để nhận ưu đãi tốt nhất.
                  </p>
                  <Button variant="outline" className="w-full bg-white">
                    Liên hệ ngay
                  </Button>
                </CardContent>
              </Card>

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
