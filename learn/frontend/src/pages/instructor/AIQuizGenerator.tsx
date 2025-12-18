import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ArrowLeft,
    Brain,
    Sparkles,
    CheckCircle,
    Loader2,
    HelpCircle,
    Wand2,
    Save,
    Trash2,
    Edit,
    Plus,
    GraduationCap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GeneratedQuestion {
    question_id: string;
    question_text: string;
    question_type: string;
    difficulty: number;
    blooms_level: string;
    options?: string[];
    correct_answer?: string;
    explanation?: string;
    selected?: boolean;
}

interface Course {
    id: number;
    title: string;
}

interface Lesson {
    id: number;
    title: string;
    course_id: number;
}

const BLOOMS_LEVELS = [
    { value: "remember", label: "Nhớ (Remember)", description: "Nhận biết, liệt kê, định nghĩa" },
    { value: "understand", label: "Hiểu (Understand)", description: "Giải thích, mô tả, tóm tắt" },
    { value: "apply", label: "Áp dụng (Apply)", description: "Giải quyết, sử dụng, thực hiện" },
    { value: "analyze", label: "Phân tích (Analyze)", description: "So sánh, đối chiếu, kiểm tra" },
    { value: "evaluate", label: "Đánh giá (Evaluate)", description: "Phê bình, đánh giá, nhận xét" },
    { value: "create", label: "Sáng tạo (Create)", description: "Thiết kế, xây dựng, phát triển" },
];

export default function AIQuizGenerator() {
    const navigate = useNavigate();
    const { courseId } = useParams();
    const { toast } = useToast();

    // Form states
    const [concept, setConcept] = useState("");
    const [numQuestions, setNumQuestions] = useState(5);
    const [difficulty, setDifficulty] = useState(3);
    const [bloomsLevel, setBloomsLevel] = useState("understand");

    // Generation states
    const [generating, setGenerating] = useState(false);
    const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);

    // Save states
    const [saving, setSaving] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || "");
    const [selectedLessonId, setSelectedLessonId] = useState<string>("");
    const [quizTitle, setQuizTitle] = useState("");
    const [quizDescription, setQuizDescription] = useState("");

    // Editing state
    const [editingQuestion, setEditingQuestion] = useState<string | null>(null);

    useEffect(() => {
        fetchCourses();
    }, []);

    useEffect(() => {
        if (selectedCourseId) {
            fetchLessons(selectedCourseId);
        }
    }, [selectedCourseId]);

    const fetchCourses = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://127.0.0.1:3000/api/instructor/courses?limit=100", {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (data.success) {
                setCourses(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        }
    };

    const fetchLessons = async (cId: string) => {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(`http://127.0.0.1:3000/api/courses/${cId}/lessons`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (data.success) {
                setLessons(data.data || []);
            }
        } catch (error) {
            console.error("Error fetching lessons:", error);
        }
    };

    // Generate questions using AI
    const handleGenerate = async () => {
        if (!concept.trim()) {
            toast({
                title: "Lỗi",
                description: "Vui lòng nhập chủ đề/khái niệm cần tạo câu hỏi",
                variant: "destructive",
            });
            return;
        }

        setGenerating(true);

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://127.0.0.1:3000/api/agents/generate-questions-blooms", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    concept: concept.trim(),
                    level: bloomsLevel,
                    numQuestions: numQuestions,
                }),
            });

            const result = await response.json();

            if (result.success && result.data?.questions) {
                const newQuestions = result.data.questions.map((q: any, index: number) => ({
                    ...q,
                    question_id: q.question_id || `gen-${Date.now()}-${index}`,
                    selected: true,
                    difficulty: difficulty,
                }));

                setQuestions(prev => [...prev, ...newQuestions]);

                toast({
                    title: "Thành công!",
                    description: `AI đã tạo ${newQuestions.length} câu hỏi`,
                });
            } else {
                throw new Error(result.error || "Không thể tạo câu hỏi");
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể kết nối đến AI Agent",
                variant: "destructive",
            });
        } finally {
            setGenerating(false);
        }
    };

    // Generate more questions for specific level
    const handleGenerateMore = async (level: string) => {
        setGenerating(true);

        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://127.0.0.1:3000/api/agents/generate-questions-blooms", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    concept: concept.trim(),
                    level: level,
                    numQuestions: 3,
                }),
            });

            const result = await response.json();

            if (result.success && result.data?.questions) {
                const newQuestions = result.data.questions.map((q: any, index: number) => ({
                    ...q,
                    question_id: q.question_id || `gen-${Date.now()}-${index}`,
                    selected: true,
                }));

                setQuestions(prev => [...prev, ...newQuestions]);

                toast({
                    title: "Thành công!",
                    description: `Đã thêm ${newQuestions.length} câu hỏi ${level}`,
                });
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: "Không thể tạo thêm câu hỏi",
                variant: "destructive",
            });
        } finally {
            setGenerating(false);
        }
    };

    // Toggle question selection
    const toggleQuestionSelection = (questionId: string) => {
        setQuestions(prev =>
            prev.map(q =>
                q.question_id === questionId ? { ...q, selected: !q.selected } : q
            )
        );
    };

    // Delete question
    const deleteQuestion = (questionId: string) => {
        setQuestions(prev => prev.filter(q => q.question_id !== questionId));
    };

    // Edit question
    const updateQuestion = (questionId: string, field: string, value: any) => {
        setQuestions(prev =>
            prev.map(q =>
                q.question_id === questionId ? { ...q, [field]: value } : q
            )
        );
    };

    // Save as Quiz
    const handleSaveAsQuiz = async () => {
        const selectedQuestions = questions.filter(q => q.selected);

        if (selectedQuestions.length === 0) {
            toast({
                title: "Lỗi",
                description: "Vui lòng chọn ít nhất 1 câu hỏi",
                variant: "destructive",
            });
            return;
        }

        if (!selectedLessonId) {
            toast({
                title: "Lỗi",
                description: "Vui lòng chọn bài học để gắn quiz",
                variant: "destructive",
            });
            return;
        }

        if (!quizTitle.trim()) {
            toast({
                title: "Lỗi",
                description: "Vui lòng nhập tiêu đề quiz",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);

        try {
            const token = localStorage.getItem("token");

            // Create quiz
            const quizResponse = await fetch("http://127.0.0.1:3000/api/quizzes", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    lesson_id: parseInt(selectedLessonId),
                    title: quizTitle,
                    description: quizDescription || `Quiz về ${concept}`,
                    time_limit: selectedQuestions.length * 2, // 2 minutes per question
                    passing_score: 60,
                    max_attempts: 3,
                    questions: selectedQuestions.map((q, index) => ({
                        question_text: q.question_text,
                        question_type: q.question_type || "multiple_choice",
                        options: q.options || [],
                        correct_answer: q.correct_answer || (q.options ? q.options[0] : ""),
                        explanation: q.explanation || "",
                        points: 10,
                        order_index: index + 1,
                    })),
                }),
            });

            const quizResult = await quizResponse.json();

            if (quizResult.success) {
                toast({
                    title: "Thành công!",
                    description: `Đã tạo quiz "${quizTitle}" với ${selectedQuestions.length} câu hỏi`,
                });

                // Clear selected questions
                setQuestions(prev => prev.filter(q => !q.selected));
                setQuizTitle("");
                setQuizDescription("");
            } else {
                throw new Error(quizResult.message);
            }
        } catch (error: any) {
            toast({
                title: "Lỗi",
                description: error.message || "Không thể lưu quiz",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const selectedCount = questions.filter(q => q.selected).length;

    return (
        <Layout>
            <div className="container mx-auto py-6 px-4 max-w-7xl">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-purple-500" />
                            AI Tạo Câu Hỏi Tự Động
                        </h1>
                        <p className="text-muted-foreground">
                            Sử dụng AI để tạo câu hỏi theo Bloom's Taxonomy
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Generation Form */}
                    <div className="space-y-6">
                        {/* Concept Input */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="h-5 w-5" />
                                    Chủ đề / Khái niệm
                                </CardTitle>
                                <CardDescription>
                                    Nhập chủ đề bạn muốn tạo câu hỏi
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label>Chủ đề *</Label>
                                    <Textarea
                                        value={concept}
                                        onChange={(e) => setConcept(e.target.value)}
                                        placeholder="Ví dụ: Vòng lặp trong Python, Định luật Newton, Marketing 4P..."
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label>Số câu hỏi</Label>
                                    <Select
                                        value={String(numQuestions)}
                                        onValueChange={(v) => setNumQuestions(parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[3, 5, 10, 15, 20].map((n) => (
                                                <SelectItem key={n} value={String(n)}>
                                                    {n} câu hỏi
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Độ khó (1-5)</Label>
                                    <Select
                                        value={String(difficulty)}
                                        onValueChange={(v) => setDifficulty(parseInt(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1 - Rất dễ</SelectItem>
                                            <SelectItem value="2">2 - Dễ</SelectItem>
                                            <SelectItem value="3">3 - Trung bình</SelectItem>
                                            <SelectItem value="4">4 - Khó</SelectItem>
                                            <SelectItem value="5">5 - Rất khó</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Cấp độ Bloom's Taxonomy</Label>
                                    <Select
                                        value={bloomsLevel}
                                        onValueChange={setBloomsLevel}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BLOOMS_LEVELS.map((level) => (
                                                <SelectItem key={level.value} value={level.value}>
                                                    <div>
                                                        <div className="font-medium">{level.label}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {level.description}
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    disabled={generating || !concept.trim()}
                                    className="w-full"
                                    size="lg"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Đang tạo...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            Tạo câu hỏi bằng AI
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Bloom's Quick Generate */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Tạo nhanh theo cấp độ</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-2">
                                    {BLOOMS_LEVELS.map((level) => (
                                        <Button
                                            key={level.value}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleGenerateMore(level.value)}
                                            disabled={generating || !concept.trim()}
                                            className="text-xs"
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            {level.label.split(" ")[0]}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Middle Column - Generated Questions */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Questions List */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <HelpCircle className="h-5 w-5" />
                                        Câu hỏi đã tạo ({questions.length})
                                    </CardTitle>
                                    {selectedCount > 0 && (
                                        <Badge variant="secondary">
                                            Đã chọn: {selectedCount}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {questions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Sparkles className="h-16 w-16 mx-auto text-purple-200 mb-4" />
                                        <h3 className="text-lg font-medium mb-2">Chưa có câu hỏi nào</h3>
                                        <p className="text-muted-foreground">
                                            Nhập chủ đề và nhấn "Tạo câu hỏi bằng AI" để bắt đầu
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                        {questions.map((question, index) => (
                                            <div
                                                key={question.question_id}
                                                className={`p-4 border rounded-lg transition-colors ${question.selected
                                                        ? "border-purple-300 bg-purple-50"
                                                        : "border-gray-200 bg-gray-50"
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Checkbox
                                                        checked={question.selected}
                                                        onCheckedChange={() => toggleQuestionSelection(question.question_id)}
                                                    />

                                                    <div className="flex-1">
                                                        {editingQuestion === question.question_id ? (
                                                            <div className="space-y-2">
                                                                <Textarea
                                                                    value={question.question_text}
                                                                    onChange={(e) => updateQuestion(question.question_id, "question_text", e.target.value)}
                                                                    rows={2}
                                                                />
                                                                {question.options && (
                                                                    <div className="space-y-1">
                                                                        {question.options.map((opt, i) => (
                                                                            <Input
                                                                                key={i}
                                                                                value={opt}
                                                                                onChange={(e) => {
                                                                                    const newOptions = [...question.options!];
                                                                                    newOptions[i] = e.target.value;
                                                                                    updateQuestion(question.question_id, "options", newOptions);
                                                                                }}
                                                                                className="text-sm"
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => setEditingQuestion(null)}
                                                                >
                                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                                    Xong
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="font-medium">
                                                                    <span className="text-purple-600 mr-2">Q{index + 1}.</span>
                                                                    {question.question_text}
                                                                </p>

                                                                {question.options && (
                                                                    <ul className="mt-2 space-y-1 ml-6">
                                                                        {question.options.map((opt, i) => (
                                                                            <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                                                                                <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                                                                    {String.fromCharCode(65 + i)}
                                                                                </span>
                                                                                {opt}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}

                                                                <div className="flex items-center gap-2 mt-3">
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {question.question_type}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        Level {question.difficulty}
                                                                    </Badge>
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {question.blooms_level}
                                                                    </Badge>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => setEditingQuestion(
                                                                editingQuestion === question.question_id ? null : question.question_id
                                                            )}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                                            onClick={() => deleteQuestion(question.question_id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Save Quiz Section */}
                        {questions.length > 0 && (
                            <Card className="border-purple-200 bg-purple-50/50">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Save className="h-5 w-5" />
                                        Lưu thành Quiz
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label>Khóa học *</Label>
                                            <Select
                                                value={selectedCourseId}
                                                onValueChange={setSelectedCourseId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn khóa học" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {courses.map((course) => (
                                                        <SelectItem key={course.id} value={String(course.id)}>
                                                            {course.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <Label>Bài học *</Label>
                                            <Select
                                                value={selectedLessonId}
                                                onValueChange={setSelectedLessonId}
                                                disabled={!selectedCourseId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Chọn bài học" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {lessons.map((lesson) => (
                                                        <SelectItem key={lesson.id} value={String(lesson.id)}>
                                                            {lesson.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Tiêu đề Quiz *</Label>
                                        <Input
                                            value={quizTitle}
                                            onChange={(e) => setQuizTitle(e.target.value)}
                                            placeholder={`Quiz: ${concept || "Nhập tiêu đề"}`}
                                        />
                                    </div>

                                    <div>
                                        <Label>Mô tả (tùy chọn)</Label>
                                        <Textarea
                                            value={quizDescription}
                                            onChange={(e) => setQuizDescription(e.target.value)}
                                            placeholder="Mô tả ngắn về quiz..."
                                            rows={2}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            Sẽ tạo quiz với <strong>{selectedCount}</strong> câu hỏi đã chọn
                                        </p>
                                        <Button
                                            onClick={handleSaveAsQuiz}
                                            disabled={saving || selectedCount === 0}
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Đang lưu...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Lưu Quiz ({selectedCount} câu)
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                {/* Help Card */}
                <Card className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                            <GraduationCap className="h-8 w-8 text-purple-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-medium mb-2">Bloom's Taxonomy là gì?</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Bloom's Taxonomy là hệ thống phân loại mục tiêu học tập theo 6 cấp độ từ thấp đến cao:
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                    {BLOOMS_LEVELS.map((level, index) => (
                                        <div key={level.value} className="text-center p-2 bg-white rounded-lg shadow-sm">
                                            <div className="text-lg font-bold text-purple-600">{index + 1}</div>
                                            <div className="text-xs font-medium">{level.label.split(" ")[0]}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Layout>
    );
}
