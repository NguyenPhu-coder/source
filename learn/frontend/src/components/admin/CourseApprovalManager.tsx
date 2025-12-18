import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import apiClient from "../../api/client";

interface PendingCourse {
  id: number;
  title_en: string;
  title_vi: string;
  description_en: string;
  instructor_name: string;
  instructor_email: string;
  category_name: string;
  price: number;
  level: string;
  created_at: string;
}

const CourseApprovalManager: React.FC = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<PendingCourse | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  const fetchPendingCourses = async () => {
    try {
      setLoading(true);
      console.log("🔍 Fetching pending courses...");
      const response = await apiClient.get("/admin/courses/pending");
      console.log("✅ Pending courses response:", response.data);

      // Handle different response structures
      const coursesData =
        response.data?.data?.courses || response.data?.courses || [];
      console.log("✅ Courses data:", coursesData);
      setCourses(coursesData);
    } catch (error: any) {
      console.error("❌ Failed to fetch pending courses:", error);
      console.error("Error response:", error.response?.data);
      toast({
        title: "Lỗi",
        description:
          error.response?.data?.message ||
          "Không thể tải danh sách khóa học chờ duyệt",
        variant: "destructive",
      });
      setCourses([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCourses();
  }, []);

  const handleApprove = async (courseId: number) => {
    try {
      console.log("✅ Approving course:", courseId);
      await apiClient.put(`/admin/courses/${courseId}/approve`);
      toast({
        title: "Thành công",
        description: "Đã duyệt khóa học thành công",
      });
      fetchPendingCourses();
    } catch (error: any) {
      console.error("❌ Failed to approve course:", error);
      toast({
        title: "Lỗi",
        description:
          error.response?.data?.message || "Không thể duyệt khóa học",
        variant: "destructive",
      });
    }
  };

  const handleRejectClick = (course: PendingCourse) => {
    setSelectedCourse(course);
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!selectedCourse || !rejectionReason.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập lý do từ chối",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log("❌ Rejecting course:", selectedCourse.id);
      await apiClient.put(`/admin/courses/${selectedCourse.id}/reject`, {
        reason: rejectionReason,
      });
      toast({
        title: "Thành công",
        description: "Đã từ chối khóa học",
      });
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedCourse(null);
      fetchPendingCourses();
    } catch (error: any) {
      console.error("❌ Failed to reject course:", error);
      toast({
        title: "Lỗi",
        description:
          error.response?.data?.message || "Không thể từ chối khóa học",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Đang tải danh sách khóa học...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Duyệt Khóa Học</h1>
        <button
          onClick={fetchPendingCourses}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          Làm mới
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 max-w-2xl mx-auto">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Không có khóa học chờ duyệt
            </h3>
            <p className="text-gray-600">
              Hiện tại không có khóa học nào cần được phê duyệt.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <div key={course.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    {course.title_en}
                  </h3>
                  {course.title_vi && (
                    <p className="text-gray-600 mb-2">{course.title_vi}</p>
                  )}
                  <p className="text-gray-700 mb-4">{course.description_en}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Instructor:</span>{" "}
                      {course.instructor_name}
                    </div>
                    <div>
                      <span className="font-semibold">Email:</span>{" "}
                      {course.instructor_email}
                    </div>
                    <div>
                      <span className="font-semibold">Category:</span>{" "}
                      {course.category_name}
                    </div>
                    <div>
                      <span className="font-semibold">Level:</span>{" "}
                      {course.level}
                    </div>
                    <div>
                      <span className="font-semibold">Price:</span> $
                      {course.price}
                    </div>
                    <div>
                      <span className="font-semibold">Created:</span>{" "}
                      {new Date(course.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(course.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                  >
                    ✓ Duyệt
                  </button>
                  <button
                    onClick={() => handleRejectClick(course)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                  >
                    ✗ Từ chối
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Từ chối khóa học</h2>
            <p className="mb-4">
              Khóa học: <strong>{selectedCourse?.title_en}</strong>
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Nhập lý do từ chối khóa học..."
              className="w-full border border-gray-300 rounded p-2 mb-4 h-32 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setSelectedCourse(null);
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSubmit}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseApprovalManager;
