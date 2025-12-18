import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Save, Trash2, GripVertical, X } from "lucide-react";

interface Question {
  id?: number;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  points: number;
  explanation?: string;
}

export default function CreateQuiz() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    duration: 30,
    passing_score: 70,
  });

  const [questions, setQuestions] = useState<Question[]>([
    {
      question_text: "",
      question_type: "multiple_choice",
      options: ["", "", "", ""],
      correct_answer: "",
      points: 10,
      explanation: "",
    },
  ]);

  useEffect(() => {
    if (lessonId) {
      fetchLesson();
    }
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/admin/lessons/${lessonId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setLesson(data.data);
        setQuizData({
          ...quizData,
          title: `Quiz: ${data.data.title}`,
        });
      }
    } catch (error) {
      console.error("Error fetching lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        question_type: "multiple_choice",
        options: ["", "", "", ""],
        correct_answer: "",
        points: 10,
        explanation: "",
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length === 1) {
      toast({
        title: "Lỗi",
        description: "Quiz phải có ít nhất 1 câu hỏi",
        variant: "destructive",
      });
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (
    index: number,
    field: keyof Question,
    value: any
  ) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  const handleAddOption = (questionIndex: number) => {
    const updated = [...questions];
    updated[questionIndex].options.push("");
    setQuestions(updated);
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions];
    if (updated[questionIndex].options.length > 2) {
      updated[questionIndex].options.splice(optionIndex, 1);
      setQuestions(updated);
    }
  };

  const validateQuiz = () => {
    if (!quizData.title.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tiêu đề quiz",
        variant: "destructive",
      });
      return false;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      if (!q.question_text.trim()) {
        toast({
          title: "Lỗi",
          description: `Câu hỏi ${i + 1}: Vui lòng nhập nội dung câu hỏi`,
          variant: "destructive",
        });
        return false;
      }

      if (q.question_type === "multiple_choice") {
        const validOptions = q.options.filter((opt) => opt.trim());
        if (validOptions.length < 2) {
          toast({
            title: "Lỗi",
            description: `Câu hỏi ${i + 1}: Phải có ít nhất 2 đáp án`,
            variant: "destructive",
          });
          return false;
        }
      }

      if (!q.correct_answer.trim()) {
        toast({
          title: "Lỗi",
          description: `Câu hỏi ${i + 1}: Vui lòng chọn đáp án đúng`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateQuiz()) return;

    setSaving(true);

    try {
      const token = localStorage.getItem("token");

      // Create quiz
      const quizResponse = await fetch("http://127.0.0.1:3000/api/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...quizData,
          lesson_id: lessonId,
        }),
      });

      const quizResult = await quizResponse.json();

      if (!quizResult.success) {
        throw new Error(quizResult.message);
      }

      const quizId = quizResult.data.id;

      // Create questions
      for (const question of questions) {
        const questionResponse = await fetch(
          "http://127.0.0.1:3000/api/admin/quiz-questions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              quiz_id: quizId,
              question_text: question.question_text,
              question_type: question.question_type,
              options: JSON.stringify(question.options.filter((o) => o.trim())),
              correct_answer: question.correct_answer,
              points: question.points,
              explanation: question.explanation,
            }),
          }
        );

        const questionResult = await questionResponse.json();
        if (!questionResult.success) {
          throw new Error("Error creating question");
        }
      }

      toast({
        title: "Thành công",
        description: "Đã tạo quiz thành công",
      });

      navigate(-1);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description: error.message || "Không thể tạo quiz",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Tạo Quiz mới</h1>
            {lesson && (
              <p className="text-gray-600 mt-1">Bài học: {lesson.title}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quiz Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Thông tin Quiz</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  value={quizData.title}
                  onChange={(e) =>
                    setQuizData({ ...quizData, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={quizData.description}
                  onChange={(e) =>
                    setQuizData({ ...quizData, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thời gian (phút) *
                </label>
                <input
                  type="number"
                  value={quizData.duration}
                  onChange={(e) =>
                    setQuizData({
                      ...quizData,
                      duration: parseInt(e.target.value) || 0,
                    })
                  }
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Điểm đạt (%) *
                </label>
                <input
                  type="number"
                  value={quizData.passing_score}
                  onChange={(e) =>
                    setQuizData({
                      ...quizData,
                      passing_score: parseInt(e.target.value) || 0,
                    })
                  }
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Câu hỏi</h2>
              <Button type="button" onClick={handleAddQuestion} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Thêm câu hỏi
              </Button>
            </div>

            {questions.map((question, qIndex) => (
              <div
                key={qIndex}
                className="bg-white border border-gray-200 rounded-lg p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                    <h3 className="font-semibold">Câu {qIndex + 1}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIndex)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nội dung câu hỏi *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) =>
                      handleQuestionChange(
                        qIndex,
                        "question_text",
                        e.target.value
                      )
                    }
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Question Type & Points */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Loại câu hỏi *
                    </label>
                    <select
                      value={question.question_type}
                      onChange={(e) =>
                        handleQuestionChange(
                          qIndex,
                          "question_type",
                          e.target.value
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="multiple_choice">Trắc nghiệm</option>
                      <option value="true_false">Đúng/Sai</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Điểm *
                    </label>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        handleQuestionChange(
                          qIndex,
                          "points",
                          parseInt(e.target.value) || 0
                        )
                      }
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Đáp án *
                  </label>
                  <div className="space-y-2">
                    {question.question_type === "true_false" ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            value="Đúng"
                            checked={question.correct_answer === "Đúng"}
                            onChange={(e) =>
                              handleQuestionChange(
                                qIndex,
                                "correct_answer",
                                e.target.value
                              )
                            }
                            className="w-4 h-4"
                          />
                          <span>Đúng</span>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                          <input
                            type="radio"
                            name={`correct-${qIndex}`}
                            value="Sai"
                            checked={question.correct_answer === "Sai"}
                            onChange={(e) =>
                              handleQuestionChange(
                                qIndex,
                                "correct_answer",
                                e.target.value
                              )
                            }
                            className="w-4 h-4"
                          />
                          <span>Sai</span>
                        </label>
                      </div>
                    ) : (
                      <>
                        {question.options.map((option, oIndex) => (
                          <div key={oIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${qIndex}`}
                              value={option}
                              checked={question.correct_answer === option}
                              onChange={(e) =>
                                handleQuestionChange(
                                  qIndex,
                                  "correct_answer",
                                  e.target.value
                                )
                              }
                              className="w-4 h-4 flex-shrink-0"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) =>
                                handleOptionChange(
                                  qIndex,
                                  oIndex,
                                  e.target.value
                                )
                              }
                              placeholder={`Đáp án ${oIndex + 1}`}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {question.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOption(qIndex, oIndex)
                                }
                                className="text-red-600 hover:bg-red-50 p-2 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddOption(qIndex)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Thêm đáp án
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giải thích (tùy chọn)
                  </label>
                  <textarea
                    value={question.explanation}
                    onChange={(e) =>
                      handleQuestionChange(
                        qIndex,
                        "explanation",
                        e.target.value
                      )
                    }
                    rows={2}
                    placeholder="Giải thích tại sao đáp án này đúng..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Đang lưu..." : "Tạo Quiz"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              Hủy
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
