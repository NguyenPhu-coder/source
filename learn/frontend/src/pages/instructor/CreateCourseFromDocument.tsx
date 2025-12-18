import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Upload,
  FileText,
  Brain,
  Sparkles,
  CheckCircle,
  Loader2,
  BookOpen,
  HelpCircle,
  AlertCircle,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface ExtractedConcept {
  text: string;
  type: string;
  confidence: number;
}

interface GeneratedQuestion {
  question_id: string;
  question_text: string;
  question_type: string;
  difficulty: number;
  blooms_level: string;
  options?: string[];
}

interface SuggestedLesson {
  title: string;
  content: string;
  order_index: number;
  duration: number;
}

interface AnalysisResult {
  title: string;
  description: string;
  level: string;
  concepts: ExtractedConcept[];
  relationships: any[];
  suggestedLessons: SuggestedLesson[];
  generatedQuestions: GeneratedQuestion[];
  bloomsLevel: string;
}

export default function CreateCourseFromDocument() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  // Analysis states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Course creation states
  const [creating, setCreating] = useState(false);
  const [courseData, setCourseData] = useState({
    title_en: "",
    title_vi: "",
    description_en: "",
    description_vi: "",
    category_id: "",
    price: "0",
    level: "beginner",
    language: "vi",
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedLessons, setSelectedLessons] = useState<number[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/categories");
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Lỗi",
          description: "Chỉ hỗ trợ file PDF, DOC, DOCX, PPT, PPTX",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "Lỗi",
          description: "Kích thước file không được vượt quá 50MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setAnalysisResult(null);
      setJobId(null);
    }
  }, [toast]);

  // Upload document to AI agent
  const handleUploadDocument = async () => {
    if (!selectedFile) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn file tài liệu",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    setProcessingStatus("Đang tải lên...");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("document", selectedFile);
      formData.append("subject", "general");
      formData.append("language", "vi");

      setUploadProgress(30);
      setProcessingStatus("Đang gửi đến AI Agent...");

      const response = await fetch("http://127.0.0.1:3000/api/agents/ingest-document", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setJobId(result.data.job_id);
        setUploadProgress(50);
        setProcessingStatus("AI đang phân tích tài liệu...");

        // Start polling for status
        pollProcessingStatus(result.data.job_id);

        toast({
          title: "Thành công",
          description: "Tài liệu đã được gửi để xử lý",
        });
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tải lên tài liệu",
        variant: "destructive",
      });
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Poll for processing status
  const pollProcessingStatus = async (jid: string) => {
    const token = localStorage.getItem("token");
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    const checkStatus = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:3000/api/agents/ingest-status/${jid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();

        if (result.success) {
          const status = result.data.status;
          const progress = result.data.progress || 0;

          setUploadProgress(50 + progress * 0.4); // 50-90%
          setProcessingStatus(result.data.message || "Đang xử lý...");

          if (status === "completed") {
            setUploadProgress(100);
            setProcessingStatus("Hoàn thành!");
            setUploading(false);

            // Now analyze the document for course creation
            analyzeDocumentForCourse(jid);
            return;
          } else if (status === "failed") {
            throw new Error("Processing failed");
          }

          // Continue polling
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 5000); // Check every 5 seconds
          } else {
            throw new Error("Processing timeout");
          }
        }
      } catch (error: any) {
        toast({
          title: "Lỗi",
          description: error.message || "Xử lý thất bại",
          variant: "destructive",
        });
        setUploading(false);
        setUploadProgress(0);
      }
    };

    checkStatus();
  };

  // Analyze document for course creation
  const analyzeDocumentForCourse = async (fileId: string) => {
    setAnalyzing(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:3000/api/agents/analyze-document-for-course", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId,
          generateQuestions: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.data);

        // Pre-fill course data
        setCourseData(prev => ({
          ...prev,
          title_vi: result.data.title || "",
          title_en: result.data.title || "",
          description_vi: result.data.description || "",
          description_en: result.data.description || "",
          level: result.data.level || "beginner",
        }));

        // Select all suggested lessons by default
        if (result.data.suggestedLessons?.length > 0) {
          setSelectedLessons(result.data.suggestedLessons.map((_: any, i: number) => i));
        }

        toast({
          title: "Phân tích hoàn tất",
          description: `Tìm thấy ${result.data.concepts?.length || 0} khái niệm và ${result.data.suggestedLessons?.length || 0} bài học`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể phân tích tài liệu",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Generate more questions
  const generateMoreQuestions = async (concept: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:3000/api/agents/generate-questions-blooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concept,
          level: "understand",
          numQuestions: 5,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.questions) {
        setAnalysisResult(prev => prev ? {
          ...prev,
          generatedQuestions: [...prev.generatedQuestions, ...result.data.questions],
        } : null);

        toast({
          title: "Thành công",
          description: `Đã tạo thêm ${result.data.questions.length} câu hỏi`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: "Không thể tạo thêm câu hỏi",
        variant: "destructive",
      });
    }
  };

  // Create course with selected content
  const handleCreateCourse = async () => {
    if (!courseData.title_vi || !courseData.category_id) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền tiêu đề và chọn danh mục",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const token = localStorage.getItem("token");

      // 1. Create the course
      const submitData = new FormData();
      Object.entries(courseData).forEach(([key, value]) => {
        submitData.append(key, value);
      });

      const courseResponse = await fetch("http://127.0.0.1:3000/api/courses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      const courseResult = await courseResponse.json();

      if (!courseResult.success) {
        throw new Error(courseResult.message);
      }

      const courseId = courseResult.data.id;

      // 2. Create lessons from selected suggestions
      if (analysisResult?.suggestedLessons && selectedLessons.length > 0) {
        for (const lessonIndex of selectedLessons) {
          const lesson = analysisResult.suggestedLessons[lessonIndex];
          if (lesson) {
            await fetch("http://127.0.0.1:3000/api/instructor/lessons", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                course_id: courseId,
                title: lesson.title,
                content: lesson.content,
                duration: lesson.duration,
                order_index: lesson.order_index,
              }),
            });
          }
        }
      }

      toast({
        title: "Thành công",
        description: "Khóa học đã được tạo từ tài liệu!",
      });

      navigate(`/instructor/courses/${courseId}/edit`);

    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo khóa học",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleLessonSelection = (index: number) => {
    setSelectedLessons(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestions(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500" />
              Tạo khóa học từ tài liệu
            </h1>
            <p className="text-muted-foreground">
              AI sẽ phân tích tài liệu và tự động tạo cấu trúc khóa học
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Tải lên tài liệu
                </CardTitle>
                <CardDescription>
                  Hỗ trợ PDF, DOCX, PPTX (tối đa 50MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${selectedFile ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400"
                      }`}
                  >
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      className="hidden"
                      id="document-upload"
                      disabled={uploading}
                    />
                    <label htmlFor="document-upload" className="cursor-pointer">
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-12 w-12 text-green-500" />
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-12 w-12 text-gray-400" />
                          <p className="font-medium">Kéo thả hoặc click để chọn file</p>
                          <p className="text-sm text-muted-foreground">
                            PDF, DOCX, PPTX
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  {uploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {processingStatus}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleUploadDocument}
                    disabled={!selectedFile || uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Phân tích bằng AI
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Analysis Results */}
            {analyzing && (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                    <p className="text-lg font-medium">AI đang phân tích tài liệu...</p>
                    <p className="text-muted-foreground">Trích xuất nội dung, khái niệm và tạo câu hỏi</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {analysisResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Kết quả phân tích
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="lessons">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="lessons">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Bài học ({analysisResult.suggestedLessons?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="concepts">
                        <Brain className="h-4 w-4 mr-2" />
                        Khái niệm ({analysisResult.concepts?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="questions">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Câu hỏi ({analysisResult.generatedQuestions?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="lessons" className="space-y-3 mt-4">
                      {analysisResult.suggestedLessons?.map((lesson, index) => (
                        <div
                          key={index}
                          onClick={() => toggleLessonSelection(index)}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedLessons.includes(index)
                            ? "border-purple-500 bg-purple-50"
                            : "hover:bg-gray-50"
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">
                                {lesson.order_index}. {lesson.title}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {lesson.content}
                              </p>
                              <Badge variant="outline" className="mt-2">
                                ~{lesson.duration} phút
                              </Badge>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedLessons.includes(index)
                              ? "border-purple-500 bg-purple-500"
                              : "border-gray-300"
                              }`}>
                              {selectedLessons.includes(index) && (
                                <CheckCircle className="h-4 w-4 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {(!analysisResult.suggestedLessons || analysisResult.suggestedLessons.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Không tìm thấy cấu trúc bài học</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="concepts" className="mt-4">
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.concepts?.map((concept, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer hover:bg-purple-100"
                            onClick={() => generateMoreQuestions(concept.text)}
                          >
                            {concept.text}
                            <span className="ml-1 text-xs opacity-60">
                              ({Math.round(concept.confidence * 100)}%)
                            </span>
                          </Badge>
                        ))}
                      </div>

                      <p className="text-sm text-muted-foreground mt-4">
                        💡 Click vào khái niệm để tạo thêm câu hỏi
                      </p>
                    </TabsContent>

                    <TabsContent value="questions" className="space-y-3 mt-4">
                      {analysisResult.generatedQuestions?.map((question, index) => (
                        <div
                          key={question.question_id || index}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-start gap-3">
                            <span className="font-bold text-purple-500">Q{index + 1}</span>
                            <div className="flex-1">
                              <p className="font-medium">{question.question_text}</p>
                              {question.options && (
                                <ul className="mt-2 space-y-1">
                                  {question.options.map((opt, i) => (
                                    <li key={i} className="text-sm text-muted-foreground">
                                      {String.fromCharCode(65 + i)}. {opt}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline">{question.question_type}</Badge>
                                <Badge variant="outline">Level {question.difficulty}</Badge>
                                <Badge variant="outline">{question.blooms_level}</Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {(!analysisResult.generatedQuestions || analysisResult.generatedQuestions.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Chưa có câu hỏi được tạo</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Course Form */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin khóa học</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title_vi">Tiêu đề (Tiếng Việt) *</Label>
                  <Input
                    id="title_vi"
                    value={courseData.title_vi}
                    onChange={(e) => setCourseData(prev => ({ ...prev, title_vi: e.target.value }))}
                    placeholder="Nhập tiêu đề khóa học"
                  />
                </div>

                <div>
                  <Label htmlFor="title_en">Tiêu đề (English)</Label>
                  <Input
                    id="title_en"
                    value={courseData.title_en}
                    onChange={(e) => setCourseData(prev => ({ ...prev, title_en: e.target.value }))}
                    placeholder="Enter course title"
                  />
                </div>

                <div>
                  <Label htmlFor="description_vi">Mô tả</Label>
                  <Textarea
                    id="description_vi"
                    value={courseData.description_vi}
                    onChange={(e) => setCourseData(prev => ({ ...prev, description_vi: e.target.value }))}
                    placeholder="Mô tả khóa học..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Danh mục *</Label>
                  <Select
                    value={courseData.category_id}
                    onValueChange={(value) => setCourseData(prev => ({ ...prev, category_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="level">Cấp độ</Label>
                  <Select
                    value={courseData.level}
                    onValueChange={(value) => setCourseData(prev => ({ ...prev, level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Cơ bản</SelectItem>
                      <SelectItem value="intermediate">Trung cấp</SelectItem>
                      <SelectItem value="advanced">Nâng cao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="price">Giá (VNĐ)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={courseData.price}
                    onChange={(e) => setCourseData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0 = Miễn phí"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span>Bài học đã chọn:</span>
                    <Badge>{selectedLessons.length}</Badge>
                  </div>

                  <Button
                    onClick={handleCreateCourse}
                    disabled={creating || !analysisResult}
                    className="w-full"
                    size="lg"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Đang tạo...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Tạo khóa học
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-blue-50">
              <CardContent className="pt-6">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  AI Agent đang làm gì?
                </h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>📄 Trích xuất nội dung từ tài liệu</li>
                  <li>🧠 Phát hiện khái niệm và mối quan hệ</li>
                  <li>📚 Đề xuất cấu trúc bài học</li>
                  <li>❓ Tự động tạo câu hỏi theo Bloom's Taxonomy</li>
                  <li>📊 Phân loại độ khó và cấp độ</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
