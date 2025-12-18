import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import axios from "../../api/client";

interface Refund {
  id: number;
  user_name: string;
  user_email: string;
  course_title: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "completed";
  admin_note?: string;
  processed_by_name?: string;
  processed_at?: string;
  created_at: string;
}

const RefundManager: React.FC = () => {
  const { toast } = useToast();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [selectedRefund, setSelectedRefund] = useState<Refund | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"approve" | "reject" | "complete">(
    "approve"
  );
  const [adminNote, setAdminNote] = useState("");
  const [statistics, setStatistics] = useState<any>({
    total_requests: 0,
    pending_requests: 0,
    approved_requests: 0,
    rejected_requests: 0,
    completed_requests: 0,
    total_refunded_amount: 0,
  });

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/admin/refunds", {
        params: { status: filter === "all" ? undefined : filter },
      });
      // Backend paginationResponse returns: { success, data: { refunds: [...], pagination } }
      setRefunds(response.data?.data?.refunds || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch refunds",
        variant: "destructive",
      });
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get("/admin/refunds/statistics");
      console.log("Statistics response:", response.data);
      const stats = response.data?.data || {};
      setStatistics({
        total_requests: stats.total_requests ?? 0,
        pending_requests: stats.pending_requests ?? 0,
        approved_requests: stats.approved_requests ?? 0,
        rejected_requests: stats.rejected_requests ?? 0,
        completed_requests: stats.completed_requests ?? 0,
        total_refunded_amount: stats.total_refunded_amount ?? 0,
      });
    } catch (error) {
      console.error("Failed to fetch statistics:", error);
      setStatistics({
        total_requests: 0,
        pending_requests: 0,
        approved_requests: 0,
        rejected_requests: 0,
        completed_requests: 0,
        total_refunded_amount: 0,
      });
    }
  };

  useEffect(() => {
    fetchRefunds();
    fetchStatistics();
  }, [filter]);

  const handleAction = async () => {
    if (!selectedRefund) return;

    if (modalType === "reject" && !adminNote.trim()) {
      toast({
        title: "Error",
        description: "Please provide a note for rejection",
        variant: "destructive",
      });
      return;
    }

    try {
      let endpoint = "";
      switch (modalType) {
        case "approve":
          endpoint = `/admin/refunds/${selectedRefund.id}/approve`;
          break;
        case "reject":
          endpoint = `/admin/refunds/${selectedRefund.id}/reject`;
          break;
        case "complete":
          endpoint = `/admin/refunds/${selectedRefund.id}/complete`;
          break;
      }

      await axios.put(
        endpoint,
        modalType !== "complete" ? { admin_note: adminNote } : {}
      );

      toast({
        title: "Success",
        description: `Refund ${modalType}d successfully`,
      });
      setShowModal(false);
      setAdminNote("");
      setSelectedRefund(null);
      fetchRefunds();
      fetchStatistics();
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${modalType} refund`,
        variant: "destructive",
      });
    }
  };

  const openModal = (
    refund: Refund,
    type: "approve" | "reject" | "complete"
  ) => {
    setSelectedRefund(refund);
    setModalType(type);
    setShowModal(true);
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      rejected: "bg-red-100 text-red-800",
      completed: "bg-green-100 text-green-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${
          colors[status as keyof typeof colors]
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">Loading...</div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Refund Management</h1>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Requests</p>
            <p className="text-2xl font-bold">
              {statistics.total_requests || 0}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold">
              {statistics.pending_requests || 0}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Completed</p>
            <p className="text-2xl font-bold">
              {statistics.completed_requests || 0}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Refunded</p>
            <p className="text-2xl font-bold">
              ${statistics.total_refunded_amount || 0}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        {["all", "pending", "approved", "rejected", "completed"].map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded ${
                filter === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Refunds List */}
      {refunds.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No refunds found</div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => (
            <div key={refund.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">
                      {refund.course_title}
                    </h3>
                    {getStatusBadge(refund.status)}
                  </div>
                  <p className="text-gray-600 mb-2">
                    <strong>User:</strong> {refund.user_name} (
                    {refund.user_email})
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>Amount:</strong> ${refund.amount}
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>Reason:</strong> {refund.reason}
                  </p>
                  {refund.admin_note && (
                    <p className="text-gray-600 mb-2">
                      <strong>Admin Note:</strong> {refund.admin_note}
                    </p>
                  )}
                  {refund.processed_by_name && (
                    <p className="text-gray-600 text-sm">
                      Processed by {refund.processed_by_name} on{" "}
                      {new Date(refund.processed_at!).toLocaleString()}
                    </p>
                  )}
                  <p className="text-gray-500 text-sm">
                    Requested on {new Date(refund.created_at).toLocaleString()}
                  </p>
                </div>

                {refund.status === "pending" && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openModal(refund, "approve")}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openModal(refund, "reject")}
                      className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {refund.status === "approved" && (
                  <button
                    onClick={() => openModal(refund, "complete")}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ml-4"
                  >
                    Complete Refund
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Modal */}
      {showModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {modalType === "approve" && "Approve Refund"}
              {modalType === "reject" && "Reject Refund"}
              {modalType === "complete" && "Complete Refund"}
            </h2>
            <p className="mb-4">
              Course: <strong>{selectedRefund.course_title}</strong>
              <br />
              User: <strong>{selectedRefund.user_name}</strong>
              <br />
              Amount: <strong>${selectedRefund.amount}</strong>
            </p>

            {modalType !== "complete" && (
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  modalType === "reject"
                    ? "Reason for rejection (required)..."
                    : "Optional note..."
                }
                className="w-full border border-gray-300 rounded p-2 mb-4 h-32"
                required={modalType === "reject"}
              />
            )}

            {modalType === "complete" && (
              <p className="text-red-600 mb-4">
                Warning: This will remove the user's enrollment from the course.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setAdminNote("");
                  setSelectedRefund(null);
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 rounded text-white ${
                  modalType === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : modalType === "reject"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundManager;
