import { useState, useEffect } from "react";
import { Star, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Review {
  id: number;
  user_id: number;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface ReviewSectionProps {
  courseId: number;
  isEnrolled: boolean;
  isCompleted?: boolean;
}

export default function ReviewSection({
  courseId,
  isEnrolled,
  isCompleted = false,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchReviews();
  }, [courseId]);

  const fetchReviews = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:3000/api/reviews/course/${courseId}`
      );
      const data = await response.json();

      if (data.success) {
        setReviews(data.data || []);

        // Check if current user has reviewed
        if (user) {
          const myReview = data.data?.find(
            (r: Review) => r.user_id === user.id
          );
          setUserReview(myReview || null);
          if (myReview) {
            setRating(myReview.rating);
            setComment(myReview.comment || "");
          }
        }
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEnrolled) {
      toast({
        title: "Không thể đánh giá",
        description: "Bạn phải đăng ký khóa học để đánh giá",
        variant: "destructive",
      });
      return;
    }

    if (!isCompleted) {
      toast({
        title: "Không thể đánh giá",
        description: "Bạn phải hoàn thành khóa học trước khi đánh giá",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://127.0.0.1:3000/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          course_id: courseId,
          rating,
          comment,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Thành công",
          description: userReview ? "Đã cập nhật đánh giá" : "Đã gửi đánh giá",
        });

        setShowForm(false);
        fetchReviews();
      } else {
        toast({
          title: "Lỗi",
          description: data.message || "Không thể gửi đánh giá",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi gửi đánh giá",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!userReview || !window.confirm("Bạn có chắc muốn xóa đánh giá?"))
      return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://127.0.0.1:3000/api/reviews/${userReview.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Đã xóa",
          description: "Đánh giá đã được xóa",
        });

        setUserReview(null);
        setRating(5);
        setComment("");
        fetchReviews();
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa đánh giá",
        variant: "destructive",
      });
    }
  };

  const renderStars = (
    count: number,
    interactive = false,
    size = "w-5 h-5"
  ) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= count
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            } ${
              interactive ? "cursor-pointer hover:scale-110 transition" : ""
            }`}
            onClick={() => interactive && setRating(star)}
          />
        ))}
      </div>
    );
  };

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : "0.0";

  const ratingDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === star).length / reviews.length) *
          100
        : 0,
  }));

  return (
    <div className="space-y-8">
      {/* Rating Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-2xl font-bold mb-6">Đánh giá của học viên</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Overall Rating */}
          <div className="flex flex-col items-center justify-center">
            <div className="text-6xl font-bold text-gray-900 mb-2">
              {averageRating}
            </div>
            {renderStars(Math.round(parseFloat(averageRating)))}
            <p className="text-gray-600 mt-2">{reviews.length} đánh giá</p>
          </div>

          {/* Rating Distribution */}
          <div className="space-y-2">
            {ratingDistribution.map(({ star, count, percentage }) => (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{star}</span>
                </div>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Write Review Button */}
        {isEnrolled && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            {!isCompleted ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <p className="text-blue-800 text-sm">
                  Hoàn thành khóa học để có thể viết đánh giá
                </p>
              </div>
            ) : userReview ? (
              <div className="flex items-center justify-between">
                <p className="text-gray-600">Bạn đã đánh giá khóa học này</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForm(!showForm)}
                  >
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteReview}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowForm(!showForm)} className="w-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                Viết đánh giá
              </Button>
            )}
          </div>
        )}

        {/* Review Form */}
        {showForm && (
          <form
            onSubmit={handleSubmitReview}
            className="mt-6 pt-6 border-t border-gray-200"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đánh giá của bạn
                </label>
                {renderStars(rating, true, "w-8 h-8")}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nhận xét (tùy chọn)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                  placeholder="Chia sẻ trải nghiệm của bạn về khóa học..."
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? "Đang gửi..."
                    : userReview
                    ? "Cập nhật"
                    : "Gửi đánh giá"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Hủy
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h4 className="text-xl font-bold">Tất cả đánh giá</h4>

        {loading ? (
          <p className="text-gray-500">Đang tải đánh giá...</p>
        ) : reviews.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Chưa có đánh giá nào</p>
            {isEnrolled && (
              <p className="text-sm text-gray-500 mt-2">
                Hãy là người đầu tiên đánh giá khóa học này!
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-lg border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {review.user_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {review.user_name || "Người dùng"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(review.created_at).toLocaleDateString(
                          "vi-VN"
                        )}
                      </p>
                    </div>
                  </div>
                  {renderStars(review.rating)}
                </div>
                {review.comment && (
                  <p className="text-gray-700 leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
