import { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  CheckCircle,
  Trash2,
  Award,
  Clock,
  TrendingUp,
  PlayCircle,
  Flame,
  Zap,
  MoreVertical,
  Brain
} from "lucide-react";
// @ts-ignore
import { useAuth } from "@/contexts/AuthContext";
import { getCoursePlaceholder } from "@/utils/imageUrl";
import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const PLACEHOLDER_IMAGE = getCoursePlaceholder();

interface EnrolledCourse {
  id: number;
  course_id: number;
  title_vi: string;
  title_en: string;
  thumbnail: string;
  instructor_name: string;
  progress: number;
  completed: boolean;
  total_lessons: number;
  completed_lessons: number;
  enrolled_at: string;
}

const API_BASE_URL = "http://127.0.0.1:3000/api";

export default function MyLearning() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [unenrolling, setUnenrolling] = useState(false);
  const [showUnenrollDialog, setShowUnenrollDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<EnrolledCourse | null>(null);

  // Memoized statistics
  const stats = useMemo(
    () => ({
      total: courses.length,
      inProgress: courses.filter((c) => !c.completed && c.progress > 0).length,
      completed: courses.filter((c) => c.completed).length,
      hoursLearned: Math.floor(Math.random() * 50) + 10, // Mock data for now
      streak: 5, // Mock data
    }),
    [courses]
  );

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/enrollments/my-courses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setCourses(data.data || []);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tải danh sách khóa học",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnenrollClick = (course: EnrolledCourse) => {
    setSelectedCourse(course);
    setShowUnenrollDialog(true);
  };

  const handleConfirmUnenroll = async () => {
    if (!selectedCourse) return;
    try {
      setUnenrolling(true);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/enrollments/${selectedCourse.course_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (data.success) {
        toast({ title: "Thành công", description: "Đã hủy đăng ký khóa học" });
        fetchEnrolledCourses();
        setShowUnenrollDialog(false);
        setSelectedCourse(null);
      }
    } catch (error: any) {
      toast({ title: "Lỗi", description: "Không thể hủy đăng ký", variant: "destructive" });
    } finally {
      setUnenrolling(false);
    }
  };

  const handleContinueLearning = async (courseId: number) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE_URL}/courses/${courseId}/lessons`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        navigate(`/course/${courseId}/lesson/${data.data[0].id}`);
      } else {
        navigate(`/course/${courseId}`);
      }
    } catch (error) {
      navigate(`/course/${courseId}`);
    }
  };

  const CourseCard = ({ course }: { course: EnrolledCourse }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full"
    >
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        <img
          src={course.thumbnail || PLACEHOLDER_IMAGE}
          alt={course.title_vi || course.title_en}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            className="rounded-full w-14 h-14 bg-white text-black hover:bg-blue-50 hover:scale-105 transition-all"
            onClick={() => handleContinueLearning(course.course_id)}
          >
            <PlayCircle className="w-6 h-6 ml-1" />
          </Button>
        </div>
        {course.completed && (
          <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle className="w-3 h-3" /> Completed
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
          {course.title_vi || course.title_en}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{course.instructor_name}</p>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-gray-500">
            <span>{course.progress}% Completed</span>
            <span>{course.completed_lessons}/{course.total_lessons} Lessons</span>
          </div>
          <Progress value={course.progress} className="h-2 bg-gray-100" indicatorClassName={course.completed ? "bg-green-500" : "bg-blue-600"} />

          <div className="flex items-center justify-between pt-2">
            {course.progress > 0 && !course.completed ? (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" onClick={() => handleContinueLearning(course.course_id)}>
                Continue
              </Button>
            ) : course.completed ? (
              <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
                Review
              </Button>
            ) : (
              <Button size="sm" className="bg-gray-900 text-white hover:bg-gray-800" onClick={() => handleContinueLearning(course.course_id)}>
                Start
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-100 rounded-full">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-red-600 focus:text-red-600 cursor-pointer" onClick={() => handleUnenrollClick(course)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Unenroll Course
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50/50 pb-20">

        {/* Dashboard Header */}
        <div className="bg-[#1a1b3a] text-white pt-10 pb-20 relative overflow-hidden">
          {/* Abstract Background */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] translate-x-1/3 -translate-y-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[80px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-xl shadow-blue-900/20 border-4 border-white/10">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div>
                  <h1 className="text-3xl font-bold mb-1">Tuần mới năng lượng, {user?.name}! 🚀</h1>
                  <p className="text-blue-200 text-lg">"Small steps every day lead to big results."</p>
                </div>
              </div>
              <Link to="/courses">
                <Button className="bg-white text-blue-900 hover:bg-blue-50 font-bold border-0 shadow-lg shadow-white/10">
                  <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                  Explore Courses
                </Button>
              </Link>
              <Link to="/auto-quizzes">
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold border-0 shadow-lg">
                  <Brain className="w-4 h-4 mr-2" />
                  Bài tập AI
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white/10 backdrop-blur-md border-white/10 text-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Courses</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/10 text-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
                    <Flame className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.streak} Days</p>
                    <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Streak</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/10 text-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.hoursLearned}h</p>
                    <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Learned</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-md border-white/10 text-white">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Certificates</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 -mt-10 relative z-20">
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 min-h-[500px]">
            <Tabs defaultValue="all" className="w-full">
              <div className="flex items-center justify-between mb-8">
                <TabsList className="bg-gray-100 p-1 rounded-xl">
                  <TabsTrigger value="all" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">All Courses</TabsTrigger>
                  <TabsTrigger value="inProgress" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">In Progress</TabsTrigger>
                  <TabsTrigger value="completed" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">Completed</TabsTrigger>
                </TabsList>

                <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
                  <TrendingUp className="w-4 h-4" />
                  <span>Last activity: Today</span>
                </div>
              </div>

              <TabsContent value="all" className="mt-0">
                {courses.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {courses.map(course => <CourseCard key={course.id} course={course} />)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="inProgress" className="mt-0">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {courses.filter(c => !c.completed && c.progress > 0).map(course => <CourseCard key={course.id} course={course} />)}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-0">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {courses.filter(c => c.completed).map(course => <CourseCard key={course.id} course={course} />)}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={showUnenrollDialog} onOpenChange={setShowUnenrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unenroll from Course?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. You will lose all your progress.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnenrollDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmUnenroll} disabled={unenrolling}>
              {unenrolling ? "Processing..." : "Confirm Unenroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

const EmptyState = () => (
  <div className="text-center py-20 flex flex-col items-center">
    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
      <BookOpen className="w-10 h-10 text-blue-500" />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">No courses yet</h3>
    <p className="text-gray-500 max-w-md mb-8">
      You haven't enrolled in any courses yet. Explore our library and start learning today!
    </p>
    <Link to="/courses">
      <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200">
        Explore Courses
      </Button>
    </Link>
  </div>
)
