import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import apiClient from "@/api/client";
import { CheckCircle, XCircle, Award } from "lucide-react";

export default function QuizResultSimple() {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [attemptId]);

  const fetchResult = async () => {
    try {
      const response = await apiClient.get(`/quizzes/attempts/${attemptId}`);
      if (response.success) {
        setResult(response.data);
      }
    } catch (error) {
      console.error("Error fetching result:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Đang tải kết quả...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!result) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Không tìm thấy kết quả</p>
        </div>
      </Layout>
    );
  }

  const isPassed = result.score >= result.passing_score;
  const correctCount =
    result.answers?.filter((a: any) => a.is_correct).length || 0;
  const totalQuestions = result.answers?.length || 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Score Card */}
          <Card className="p-8 mb-6 text-center">
            <div className="mb-6">
              {isPassed ? (
                <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-16 h-16 text-green-600" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 rounded-full mb-4">
                  <XCircle className="w-16 h-16 text-red-600" />
                </div>
              )}
            </div>

            <h1
              className={`text-3xl font-bold mb-2 ${
                isPassed ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPassed ? "🎉 Chúc mừng! Bạn đã đạt" : "😔 Chưa đạt"}
            </h1>

            <div className="text-6xl font-bold mb-4 text-gray-900">
              {result.score}%
            </div>

            <p className="text-gray-600 text-lg mb-6">
              Điểm đạt yêu cầu: {result.passing_score}%
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {correctCount}
                </div>
                <div className="text-sm text-gray-600">Đúng</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-red-600">
                  {totalQuestions - correctCount}
                </div>
                <div className="text-sm text-gray-600">Sai</div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {totalQuestions}
                </div>
                <div className="text-sm text-gray-600">Tổng số</div>
              </div>
            </div>

            {result.points_earned > 0 && (
              <div className="mt-6 inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
                <Award className="w-5 h-5" />
                <span className="font-semibold">
                  +{result.points_earned} điểm kinh nghiệm
                </span>
              </div>
            )}
          </Card>

          {/* Detailed Answers */}
          <Card className="p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Chi tiết câu trả lời
            </h2>

            <div className="space-y-6">
              {result.answers?.map((answer: any, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-2 ${
                    answer.is_correct
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-white rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {answer.question}
                      </h3>
                    </div>
                    {answer.is_correct ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>

                  <div className="ml-11 space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        Câu trả lời của bạn:
                      </span>
                      <p
                        className={`mt-1 ${
                          answer.is_correct ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {answer.selected_answers?.join(", ") || "Không trả lời"}
                      </p>
                    </div>

                    {!answer.is_correct && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          Đáp án đúng:
                        </span>
                        <p className="mt-1 text-green-700">
                          {answer.correct_answers?.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  `/course/${result.course_id}/lesson/${result.lesson_id}`
                )
              }
            >
              Quay lại bài học
            </Button>
            {!isPassed && (
              <Button
                onClick={() => navigate(`/quizzes/${id}/take`)}
                className="bg-gradient-to-r from-blue-500 to-purple-600"
              >
                Làm lại
              </Button>
            )}
            <Button
              onClick={() => navigate("/my-learning")}
              className="bg-gradient-to-r from-green-500 to-emerald-600"
            >
              Khóa học của tôi
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
