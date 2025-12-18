import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Clock, Package, Eye } from "lucide-react";

interface Order {
  id: number;
  order_code: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items: {
    course_id: number;
    title_vi: string;
    price: number;
  }[];
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);

      const response = await fetch(
        `http://127.0.0.1:3000/api/orders?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: {
        icon: <Clock className="w-4 h-4" />,
        text: "Đang chờ",
        className: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      completed: {
        icon: <CheckCircle className="w-4 h-4" />,
        text: "Hoàn thành",
        className: "bg-green-100 text-green-700 border-green-200",
      },
      failed: {
        icon: <XCircle className="w-4 h-4" />,
        text: "Thất bại",
        className: "bg-red-100 text-red-700 border-red-200",
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.pending;

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${badge.className}`}
      >
        {badge.icon}
        {badge.text}
      </span>
    );
  };

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      vnpay: "VNPay",
      momo: "Momo",
      stripe: "Thẻ quốc tế",
    };
    return methods[method] || method;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Filter */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex gap-4">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                className={
                  filter === "all"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-gray-300"
                }
              >
                Tất cả
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
                className={
                  filter === "pending"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-gray-300"
                }
              >
                Đang chờ
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                onClick={() => setFilter("completed")}
                className={
                  filter === "completed"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-gray-300"
                }
              >
                Hoàn thành
              </Button>
              <Button
                variant={filter === "failed" ? "default" : "outline"}
                onClick={() => setFilter("failed")}
                className={
                  filter === "failed"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "border-gray-300"
                }
              >
                Thất bại
              </Button>
            </div>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="text-gray-500">Đang tải...</div>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chưa có đơn hàng nào
              </h3>
              <p className="text-gray-600 mb-4">
                Bạn chưa có đơn hàng nào trong hệ thống
              </p>
              <Button
                onClick={() => navigate("/courses")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Khám phá khóa học
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1">
                        Đơn hàng #{order.order_code}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    {getStatusBadge(order.payment_status)}
                  </div>

                  <div className="space-y-2 mb-4">
                    {order.items.map((item) => (
                      <div
                        key={item.course_id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-gray-700">{item.title_vi}</span>
                        <span className="font-medium text-gray-900">
                          {item.price === 0
                            ? "Miễn phí"
                            : `${item.price.toLocaleString("vi-VN")} đ`}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Phương thức:{" "}
                      <span className="font-medium text-gray-900">
                        {getPaymentMethodName(order.payment_method)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-blue-600">
                        {order.total_amount.toLocaleString("vi-VN")} đ
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="border-gray-300"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Chi tiết
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
