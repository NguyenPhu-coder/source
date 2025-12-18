import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, BookOpen, Star } from "lucide-react";
import apiClient from "@/api/client";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsData {
  enrollmentTrend: Array<{ date: string; enrollments: number }>;
  lessonCompletion: Array<{
    id: number;
    title_en: string;
    completed_by: number;
  }>;
  progressDistribution: Array<{ progress_range: string; count: number }>;
  reviewsSummary: {
    average_rating: number;
    total_reviews: number;
    five_star: number;
    four_star: number;
    three_star: number;
    two_star: number;
    one_star: number;
  };
}

export default function CourseAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [id]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.request(
        `/instructor/courses/${id}/analytics`
      );
      setAnalytics(response.data);
    } catch (error: any) {
      toast({
        title: "Lỗi",
        description:
          error.response?.data?.message || "Không thể tải dữ liệu phân tích",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-600">Đang tải...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-500 py-8">Không có dữ liệu</div>
        </div>
      </div>
    );
  }

  const totalEnrollments = analytics.enrollmentTrend.reduce(
    (sum, item) => sum + item.enrollments,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/instructor/courses")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            Phân tích khóa học
          </h1>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tổng đăng ký</p>
                  <p className="text-2xl font-bold">{totalEnrollments}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tổng bài học</p>
                  <p className="text-2xl font-bold">
                    {analytics.lessonCompletion.length}
                  </p>
                </div>
                <BookOpen className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Đánh giá TB</p>
                  <p className="text-2xl font-bold">
                    {analytics.reviewsSummary.average_rating?.toFixed(1) ||
                      "N/A"}
                  </p>
                </div>
                <Star className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tổng reviews</p>
                  <p className="text-2xl font-bold">
                    {analytics.reviewsSummary.total_reviews}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enrollment Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Xu hướng đăng ký (30 ngày)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.enrollmentTrend.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Chưa có dữ liệu
                </p>
              ) : (
                <div className="space-y-2">
                  {analytics.enrollmentTrend.map((item) => (
                    <div
                      key={item.date}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm text-gray-600">
                        {new Date(item.date).toLocaleDateString("vi-VN")}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{
                              width: `${
                                (item.enrollments /
                                  Math.max(
                                    ...analytics.enrollmentTrend.map(
                                      (e) => e.enrollments
                                    )
                                  )) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold w-8 text-right">
                          {item.enrollments}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ tiến độ học viên</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.progressDistribution.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Chưa có học viên
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.progressDistribution.map((item) => (
                    <div key={item.progress_range}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">
                          {item.progress_range}
                        </span>
                        <span className="text-sm font-semibold">
                          {item.count} học viên
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            item.progress_range === "Completed"
                              ? "bg-green-500"
                              : item.progress_range === "75-99%"
                              ? "bg-blue-500"
                              : item.progress_range === "50-74%"
                              ? "bg-yellow-500"
                              : "bg-orange-500"
                          }`}
                          style={{
                            width: `${
                              (item.count /
                                analytics.progressDistribution.reduce(
                                  (sum, i) => sum + i.count,
                                  0
                                )) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lesson Completion */}
          <Card>
            <CardHeader>
              <CardTitle>Tỷ lệ hoàn thành bài học</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.lessonCompletion.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Chưa có bài học
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analytics.lessonCompletion.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm text-gray-600 truncate flex-1">
                        {index + 1}. {lesson.title_en}
                      </span>
                      <span className="text-sm font-semibold text-right ml-2">
                        {lesson.completed_by} học viên
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Phân bổ đánh giá</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.reviewsSummary.total_reviews === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Chưa có đánh giá
                </p>
              ) : (
                <div className="space-y-3">
                  {[
                    { star: 5, count: analytics.reviewsSummary.five_star },
                    { star: 4, count: analytics.reviewsSummary.four_star },
                    { star: 3, count: analytics.reviewsSummary.three_star },
                    { star: 2, count: analytics.reviewsSummary.two_star },
                    { star: 1, count: analytics.reviewsSummary.one_star },
                  ].map((item) => (
                    <div key={item.star} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-12">
                        {item.star} ⭐
                      </span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{
                            width: `${
                              (item.count /
                                analytics.reviewsSummary.total_reviews) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
