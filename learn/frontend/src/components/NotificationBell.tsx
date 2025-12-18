import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Notification {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const response = await fetch(
                "http://127.0.0.1:3000/api/notifications?limit=5",
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const data = await response.json();
            if (data.success && data.notifications) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
            setNotifications([]);
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
        }
    };

    const markAllAsRead = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            await fetch("http://127.0.0.1:3000/api/notifications/read-all", {
                method: "PUT",
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchNotifications();
        } catch (error) {
            console.error("Error marking all as read:", error);
        } finally {
            setLoading(false);
        }
    };

    const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

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
            default:
                return "🔔";
        }
    };

    const formatTimeAgo = (dateString: string) => {
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
        return date.toLocaleDateString("vi-VN");
    };

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-full transition-colors"
            >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    ></div>

                    {/* Dropdown Panel */}
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50">
                        {/* Header */}
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">Thông báo</h3>
                            {unreadCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={markAllAsRead}
                                    disabled={loading}
                                    className="text-xs text-blue-600 hover:text-blue-700"
                                >
                                    <CheckCheck className="w-4 h-4 mr-1" />
                                    Đọc tất cả
                                </Button>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">Không có thông báo mới</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.is_read ? "bg-blue-50" : ""
                                                }`}
                                            onClick={() => {
                                                if (!notification.is_read) {
                                                    markAsRead(notification.id);
                                                }
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="text-2xl flex-shrink-0">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h4
                                                            className={`text-sm font-medium ${!notification.is_read
                                                                ? "text-gray-900"
                                                                : "text-gray-700"
                                                                }`}
                                                        >
                                                            {notification.title}
                                                        </h4>
                                                        {!notification.is_read && (
                                                            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {formatTimeAgo(notification.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="p-3 border-t text-center">
                                <Link
                                    to="/notifications"
                                    onClick={() => setIsOpen(false)}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Xem tất cả thông báo
                                </Link>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
