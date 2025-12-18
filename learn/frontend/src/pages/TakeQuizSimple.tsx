import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import apiClient from "@/api/client";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TakeQuizSimple() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuiz();
  }, [id]);

  const fetchQuiz = async () => {
    try {
      const response = await apiClient.get(`/quizzes/${id}`);
      if (response.success) {
        setQuiz(response.data);
      }
    } catch (error) {
      console.error("Error fetching quiz:", error);
      toast({
        title: "Lỗi",
        description: "Không thể tải bài quiz",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (
    questionId: number,
    optionId: number,
    isMultiple: boolean
  ) => {
    if (isMultiple) {
      const currentAnswers = answers[questionId] || [];
      if (currentAnswers.includes(optionId)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter((id: number) => id !== optionId),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, optionId],
        });
      }
    } else {
      setAnswers({
        ...answers,
        [questionId]: [optionId],
      });
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const formattedAnswers = Object.entries(answers).map(
        ([questionId, optionIds]) => ({
          question_id: parseInt(questionId),
          selected_option_ids: Array.isArray(optionIds)
            ? optionIds
            : [optionIds],
        })
      );

      const response = await apiClient.post(`/quizzes/${id}/submit`, {
        answers: formattedAnswers,
      });

      if (response.success) {
        toast({
          title: "Thành công!",
          description: "Đã nộp bài quiz",
        });
        navigate(`/quizzes/${id}/result/${response.data.attempt_id}`);
      }
    } catch (error: any) {
      console.error("Error submitting quiz:", error);
      toast({
        title: "Lỗi",
        description: error.message || "Không thể nộp bài",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Đang tải bài quiz...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!quiz) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Không tìm thấy bài quiz</p>
        </div>
      </Layout>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz.questions?.length || 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {quiz.title_vi || quiz.title_en}
            </h1>
            <p className="text-gray-600 mb-4">
              {quiz.description_vi || quiz.description_en}
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>📝 {totalQuestions} câu hỏi</span>
              <span>📊 Điểm đạt: {quiz.passing_score}%</span>
              <span>
                ✅ Đã trả lời: {answeredCount}/{totalQuestions}
              </span>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-6">
            {quiz.questions?.map((question: any, index: number) => (
              <Card key={question.id} className="p-6 bg-white">
                <div className="mb-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {question.question_vi || question.question_en}
                      </h3>
                      {question.question_type === "multiple_choice" && (
                        <p className="text-sm text-gray-500">
                          (Có thể chọn nhiều đáp án)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 ml-11">
                  {question.options?.map((option: any) => {
                    const isSelected = answers[question.id]?.includes(
                      option.id
                    );
                    const isMultiple =
                      question.question_type === "multiple_choice";

                    return (
                      <label
                        key={option.id}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type={isMultiple ? "checkbox" : "radio"}
                          name={`question-${question.id}`}
                          checked={isSelected}
                          onChange={() =>
                            handleAnswerChange(
                              question.id,
                              option.id,
                              isMultiple
                            )
                          }
                          className="w-5 h-5"
                        />
                        <span className="flex-1 text-gray-700">
                          {option.option_vi || option.option_en}
                        </span>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* Submit Button */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700">
                  Đã trả lời <span className="font-bold">{answeredCount}</span>{" "}
                  / <span className="font-bold">{totalQuestions}</span> câu hỏi
                </p>
                {answeredCount < totalQuestions && (
                  <p className="text-sm text-amber-600 mt-1">
                    ⚠️ Bạn chưa trả lời hết các câu hỏi
                  </p>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || answeredCount === 0}
                size="lg"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {submitting ? "Đang nộp bài..." : "Nộp bài"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
