import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Filter,
    Calendar,
} from "lucide-react";

interface Notification {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default function Notifications() {
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"all" | "unread">("all");

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(
                "http://127.0.0.1:3000/api/notifications",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
            toast({
                title: "Lỗi",
                description: "Không thể tải thông báo",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: number) => {
        try {
            const token = localStorage.getItem("token");
            await fetch(
                `http://127.0.0.1:3000/api/notifications/${notificationId}/read`,
                {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            fetchNotifications();
        } catch (error) {
            console.error("Error marking notification as read:", error);
            toast({
                title: "Lỗi",
                description: "Không thể đánh dấu đã đọc",
                variant: "destructive",
            });
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem("token");
            await fetch("http://127.0.0.1:3000/api/notifications/read-all", {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            });
            toast({
                title: "Thành công",
                description: "Đã đánh dấu tất cả là đã đọc",
            });
            fetchNotifications();
        } catch (error) {
            console.error("Error marking all as read:", error);
            toast({
                title: "Lỗi",
                description: "Không thể đánh dấu tất cả",
                variant: "destructive",
            });
        }
    };

    const deleteNotification = async (notificationId: number) => {
        if (!confirm("Bạn có chắc muốn xóa thông báo này?")) return;

        try {
            const token = localStorage.getItem("token");
            await fetch(
                `http://127.0.0.1:3000/api/notifications/${notificationId}`,
                {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            toast({
                title: "Thành công",
                description: "Đã xóa thông báo",
            });
            fetchNotifications();
        } catch (error) {
            console.error("Error deleting notification:", error);
            toast({
                title: "Lỗi",
                description: "Không thể xóa thông báo",
                variant: "destructive",
            });
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case "assignment":
                return "📝";
            case "grade":
                return "⭐";
            case "announcement":
                return "📢";
            case "comment":
                return "💬";
            case "enrollment":
                return "🎓";
            case "course_update":
                return "📚";
            default:
                return "🔔";
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "Vừa xong";
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;

        return date.toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const filteredNotifications =
        filter === "unread"
            ? notifications.filter((n) => !n.is_read)
            : notifications;

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Thông báo</h1>
                    <p className="text-gray-600">
                        Bạn có {unreadCount} thông báo chưa đọc
                    </p>
                </div>

                {/* Controls */}
                <div className="bg-white rounded-lg shadow p-4 mb-6 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={filter === "all" ? "default" : "outline"}
                            onClick={() => setFilter("all")}
                        >
                            Tất cả ({notifications.length})
                        </Button>
                        <Button
                            size="sm"
                            variant={filter === "unread" ? "default" : "outline"}
                            onClick={() => setFilter("unread")}
                        >
                            Chưa đọc ({unreadCount})
                        </Button>
                    </div>

                    {unreadCount > 0 && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={markAllAsRead}
                            className="text-blue-600 hover:text-blue-700"
                        >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Đánh dấu tất cả là đã đọc
                        </Button>
                    )}
                </div>

                {/* Notifications List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-4">Đang tải...</p>
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {filter === "unread"
                                ? "Không có thông báo chưa đọc"
                                : "Không có thông báo"}
                        </h3>
                        <p className="text-gray-600">
                            {filter === "unread"
                                ? "Bạn đã đọc hết tất cả thông báo"
                                : "Bạn chưa có thông báo nào"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`bg-white rounded-lg shadow hover:shadow-md transition-all p-5 ${!notification.is_read
                                        ? "border-l-4 border-blue-600"
                                        : "border-l-4 border-transparent"
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className="text-3xl flex-shrink-0">
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <h3
                                                className={`text-lg font-semibold ${!notification.is_read
                                                        ? "text-gray-900"
                                                        : "text-gray-700"
                                                    }`}
                                            >
                                                {notification.title}
                                            </h3>
                                            {!notification.is_read && (
                                                <div className="flex items-center gap-1 text-blue-600 text-sm font-medium flex-shrink-0">
                                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                    Mới
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                                            {notification.message}
                                        </p>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <Calendar className="w-4 h-4" />
                                                {formatDate(notification.created_at)}
                                            </div>

                                            <div className="flex gap-2">
                                                {!notification.is_read && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => markAsRead(notification.id)}
                                                        className="text-blue-600 hover:text-blue-700"
                                                    >
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Đánh dấu đã đọc
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => deleteNotification(notification.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
