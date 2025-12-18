import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Markdown from "markdown-to-jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Lock,
  BookOpen,
  Play,
  Brain,
  FileText,
  Download,
  StickyNote,
  Menu,
  PlayCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import apiClient from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotesPanel from "@/components/NotesPanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function LessonPlayer() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const [course, setCourse] = useState<any>(null);
  const [currentLesson, setCurrentLesson] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [completedLessons, setCompletedLessons] = useState<number[]>([]);
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (courseId && lessonId) {
      fetchCourseAndLessons();
    }
  }, [courseId, lessonId, isAuthenticated, authLoading]);

  const fetchCourseAndLessons = async () => {
    try {
      setLoading(true);
      const courseResponse = await apiClient.getCourse(courseId!);
      if (courseResponse.success) {
        setCourse(courseResponse.data);
        const courseLessons = courseResponse.data.lessons || [];
        setLessons(courseLessons);

        const lesson = courseLessons.find(
          (l: any) => l.id === parseInt(lessonId!)
        );
        setCurrentLesson(lesson);
      }

      const progressResponse = await apiClient.getLessonProgress(
        parseInt(courseId!)
      );
      if (progressResponse.success) {
        const completed = progressResponse.data
          .filter((p: any) => p.completed)
          .map((p: any) => p.lesson_id);
        setCompletedLessons(completed);
      }

      if (lessonId) {
        const quizResponse = await apiClient.getQuizByLesson(lessonId);
        if (quizResponse?.success && quizResponse?.data) {
          setQuiz(quizResponse.data);
        } else {
          setQuiz(null);
        }
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải bài học",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsComplete = async () => {
    if (!currentLesson || !courseId) return;

    try {
      const response = await apiClient.markLessonCompleted(
        currentLesson.id,
        parseInt(courseId)
      );
      if (response.success) {
        setCompletedLessons([...completedLessons, currentLesson.id]);
        toast({
          title: "Hoàn thành bài học!",
          description: response.data.pointsAwarded
            ? `Bạn nhận được ${response.data.pointsAwarded} điểm!`
            : "Làm tốt lắm!",
        });

        const currentIndex = lessons.findIndex(
          (l) => l.id === currentLesson.id
        );
        if (currentIndex < lessons.length - 1) {
          const nextLesson = lessons[currentIndex + 1];
          navigate(`/course/${courseId}/lesson/${nextLesson.id}`);
        }
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể đánh dấu hoàn thành",
        variant: "destructive",
      });
    }
  };

  const navigateLesson = (direction: "prev" | "next") => {
    const currentIndex = lessons.findIndex((l) => l.id === currentLesson?.id);
    const targetIndex =
      direction === "prev" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex >= 0 && targetIndex < lessons.length) {
      const targetLesson = lessons[targetIndex];
      navigate(`/course/${courseId}/lesson/${targetLesson.id}`);
    }
  };

  const isLessonCompleted = (lessonId: number) =>
    completedLessons.includes(lessonId);
  const currentIndex = lessons.findIndex((l) => l.id === currentLesson?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < lessons.length - 1;
  const isCompleted = currentLesson && isLessonCompleted(currentLesson.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!currentLesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Bài học không tồn tại</p>
          <Button onClick={() => navigate(`/course/${courseId}`)}>
            Quay lại khóa học
          </Button>
        </div>
      </div>
    );
  }

  const LessonList = () => (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b bg-gray-50/50 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          Nội dung khóa học
        </h3>
        <div className="mt-2 text-xs text-gray-500 font-medium flex justify-between items-center">
          <span>{completedLessons.length}/{lessons.length} bài học</span>
          <span className="text-green-600">{Math.round((completedLessons.length / lessons.length) * 100)}% hoàn thành</span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(completedLessons.length / lessons.length) * 100}%` }}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-gray-100">
          {lessons.map((lesson, index) => {
            const completed = isLessonCompleted(lesson.id);
            const isCurrent = lesson.id === currentLesson.id;
            const isLocked =
              !lesson.is_free &&
              index > 0 &&
              !isLessonCompleted(lessons[index - 1].id);

            return (
              <button
                key={lesson.id}
                onClick={() =>
                  !isLocked &&
                  navigate(`/course/${courseId}/lesson/${lesson.id}`)
                }
                disabled={isLocked}
                className={`w-full px-4 py-4 text-left transition-all hover:bg-gray-50 flex items-start gap-3 group
                  ${isCurrent ? "bg-blue-50/50 hover:bg-blue-50 border-r-2 border-blue-600" : ""}
                  ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border shrink-0
                    ${completed ? 'bg-green-100 border-green-200 text-green-600' :
                    isCurrent ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400'}
                `}>
                  {completed ? <CheckCircle className="w-3.5 h-3.5" /> : index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                    {lesson.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {lesson.lesson_type === 'video' && <PlayCircle className="w-3 h-3 text-gray-400" />}
                    {lesson.lesson_type === 'text' && <FileText className="w-3 h-3 text-gray-400" />}
                    {lesson.lesson_type === 'quiz' && <Brain className="w-3 h-3 text-gray-400" />}
                    <span className="text-xs text-gray-500">{lesson.duration || 10} phút</span>
                  </div>
                </div>

                {isLocked && <Lock className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b h-16 sticky top-0 z-30 shadow-sm px-4">
        <div className="h-full flex items-center justify-between container mx-auto max-w-[1600px] px-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/course/${courseId}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              <span className="hidden sm:inline">Trở lại</span>
            </Button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <h1 className="font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">
              {course?.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateLesson("prev")}
              disabled={!hasPrev}
              className="hidden sm:flex"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateLesson("next")}
              disabled={!hasNext}
              className="hidden sm:flex"
            >
              Sau <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-80">
                <LessonList />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLesson.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* 1. Video Player / Content Viewer */}
                <div className="bg-black rounded-2xl overflow-hidden shadow-2xl shadow-gray-200 border border-gray-100 aspect-video relative group">
                  {currentLesson.lesson_type === 'quiz' ? (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-blue-900 flex items-center justify-center p-8">
                      <div className="text-center text-white space-y-4">
                        <Brain className="w-20 h-20 mx-auto text-blue-300 opacity-80" />
                        <h2 className="text-3xl font-bold">Kiểm tra kiến thức</h2>
                        <p className="text-blue-200">Hãy hoàn thành bài học để làm bài kiểm tra này</p>
                      </div>
                    </div>
                  ) : currentLesson.video_url ? (
                    <iframe
                      className="w-full h-full"
                      src={currentLesson.video_url.replace("watch?v=", "embed/")}
                      title={currentLesson.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : currentLesson.document_url ? (
                    <div className="w-full h-full bg-white flex items-center justify-center">
                      <div className="text-center p-8">
                        <FileText className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Tài liệu đính kèm</h3>
                        <Button
                          onClick={() => window.open(currentLesson.document_url, '_blank')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Download className="w-4 h-4 mr-2" /> Tải về
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <p className="text-gray-400">Nội dung đang cập nhật</p>
                    </div>
                  )}
                </div>

                {/* 2. Lesson Title & Description */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentLesson.title}</h1>
                    <p className="text-gray-600 leading-relaxed">{currentLesson.description}</p>
                  </div>

                  {!isCompleted && (
                    <Button
                      onClick={markAsComplete}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 font-bold shrink-0"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Hoàn thành bài học
                    </Button>
                  )}
                </div>

                {/* 3. Text Content (Markdown) */}
                {currentLesson.content_text && (
                  <Card className="border-gray-100 shadow-sm overflow-hidden">
                    <CardContent className="p-8 md:p-10">
                      <div className="prose prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-blue prose-img:rounded-xl">
                        <Markdown
                          options={{
                            overrides: {
                              h1: { props: { className: "text-3xl font-bold text-gray-900 mb-6 pb-2 border-b" } },
                              h2: { props: { className: "text-2xl font-bold text-gray-800 mt-8 mb-4" } },
                              ul: { props: { className: "list-disc pl-6 space-y-2 text-gray-700" } },
                              li: { props: { className: "marker:text-blue-500" } },
                              code: { props: { className: "bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono" } },
                              pre: { props: { className: "bg-gray-900 text-gray-100 p-6 rounded-xl overflow-x-auto shadow-inner my-6" } },
                              blockquote: { props: { className: "border-l-4 border-blue-500 pl-6 italic my-6 text-gray-600 bg-blue-50 py-4 pr-4 rounded-r-lg" } },
                            },
                          }}
                        >
                          {currentLesson.content_text}
                        </Markdown>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 4. Quiz Section CTA */}
                {quiz && (
                  <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-none shadow-xl">
                    <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
                          <Brain className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-1">{quiz.title_vi || "Bài kiểm tra"}</h3>
                          <p className="text-blue-100 opacity-90">{quiz.questions?.length || 0} câu hỏi • {quiz.time_limit} phút</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate(`/quizzes/${quiz.id}/take`)}
                        size="lg"
                        className="bg-white text-blue-600 hover:bg-blue-50 font-bold border-none shadow-lg"
                      >
                        <Play className="w-5 h-5 mr-2 fill-current" />
                        Bắt đầu làm bài
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* 5. Notes Panel */}
                <div className="pt-8 border-t">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-yellow-500" />
                    Ghi chú của bạn
                  </h3>
                  <Card className="border-gray-200/60 shadow-sm">
                    <CardContent className="p-0">
                      <div className="h-[400px]">
                        <NotesPanel lessonId={parseInt(lessonId!)} currentTime={0} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Sidebar (Desktop) */}
        <aside className="hidden lg:block w-[350px] border-l bg-white shrink-0">
          <LessonList />
        </aside>
      </div>
    </div>
  );
}
