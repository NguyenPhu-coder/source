import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import axios from "../../api/client";

interface Enrollment {
  enrollment_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  course_id: number;
  course_title: string;
  enrolled_at: string;
  progress: number;
  completed: boolean;
  total_lessons: number;
  completed_lessons: number;
}

const EnrollmentManager: React.FC = () => {
  const { toast } = useToast();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEnrollment, setNewEnrollment] = useState({
    user_id: "",
    course_id: "",
  });

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/admin/enrollments", {
        params: { search: searchTerm || undefined },
      });
      setEnrollments(response.data.data.enrollments);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch enrollments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEnrollments();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCreateEnrollment = async () => {
    if (!newEnrollment.user_id || !newEnrollment.course_id) {
      toast({
        title: "Error",
        description: "Please provide both user ID and course ID",
        variant: "destructive",
      });
      return;
    }

    try {
      await axios.post("/admin/enrollments", {
        user_id: parseInt(newEnrollment.user_id),
        course_id: parseInt(newEnrollment.course_id),
      });
      toast({
        title: "Success",
        description: "Enrollment created successfully",
      });
      setShowCreateModal(false);
      setNewEnrollment({ user_id: "", course_id: "" });
      fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to create enrollment",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEnrollment = async (enrollmentId: number) => {
    if (!confirm("Are you sure you want to delete this enrollment?")) {
      return;
    }

    try {
      await axios.delete(`/admin/enrollments/${enrollmentId}`);
      toast({
        title: "Success",
        description: "Enrollment deleted successfully",
      });
      fetchEnrollments();
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.response?.data?.message || "Failed to delete enrollment",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Enrollment Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Enrollment
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by user name, email, or course title..."
          className="w-full border border-gray-300 rounded px-4 py-2"
        />
      </div>

      {/* Enrollments Table */}
      {enrollments.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No enrollments found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white shadow-md rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Course</th>
                <th className="px-4 py-3 text-left">Progress</th>
                <th className="px-4 py-3 text-left">Enrolled At</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => (
                <tr
                  key={enrollment.enrollment_id}
                  className="border-b hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold">{enrollment.user_name}</p>
                      <p className="text-sm text-gray-600">
                        {enrollment.user_email}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{enrollment.course_title}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        {enrollment.completed_lessons}/
                        {enrollment.total_lessons} lessons (
                        {enrollment.progress}%)
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(enrollment.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {enrollment.completed ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        Completed
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-semibold">
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        handleDeleteEnrollment(enrollment.enrollment_id)
                      }
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Enrollment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create Enrollment</h2>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">
                User ID
              </label>
              <input
                type="number"
                value={newEnrollment.user_id}
                onChange={(e) =>
                  setNewEnrollment({
                    ...newEnrollment,
                    user_id: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter user ID"
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 font-semibold mb-2">
                Course ID
              </label>
              <input
                type="number"
                value={newEnrollment.course_id}
                onChange={(e) =>
                  setNewEnrollment({
                    ...newEnrollment,
                    course_id: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="Enter course ID"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewEnrollment({ user_id: "", course_id: "" });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEnrollment}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentManager;
