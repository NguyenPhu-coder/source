import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Brain,
    Clock,
    CheckCircle,
    XCircle,
    Trophy,
    BookOpen,
    Target,
    Award,
    Loader2,
    AlertCircle,
    ChevronRight,
    BarChart3,
} from 'lucide-react';
import apiClient from '@/api/client';

interface AutoQuiz {
    id: number;
    title: string;
    description: string;
    courseTitle: string;
    courseId: number;
    passingScore: number;
    timeLimit: number;
    status: 'pending' | 'completed' | 'expired';
    score: number | null;
    passed: boolean | null;
    attemptedAt: string | null;
    createdAt: string;
    questionCount: number;
}

interface Stats {
    total: number;
    completed: number;
    pending: number;
    avgScore: number;
    passRate: number;
}

const MyAutoQuizzes: React.FC = () => {
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState<AutoQuiz[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/agents/auto-quiz/my-quizzes');
            if (response.data.success) {
                setQuizzes(response.data.data.quizzes);
                setStats(response.data.data.stats);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Không thể tải danh sách bài tập');
        } finally {
            setLoading(false);
        }
    };

    const filteredQuizzes = quizzes.filter((quiz) => {
        if (filter === 'all') return true;
        return quiz.status === filter;
    });

    const formatDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Đang tải danh sách bài tập...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Brain className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-800">Bài tập AI tổng kết</h1>
                    </div>
                    <p className="text-gray-600">
                        Các bài tập được AI tự động tạo khi bạn hoàn thành khóa học
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <BookOpen className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
                                    <p className="text-sm text-gray-500">Tổng bài tập</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-yellow-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
                                    <p className="text-sm text-gray-500">Chưa làm</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-800">{stats.completed}</p>
                                    <p className="text-sm text-gray-500">Đã hoàn thành</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <BarChart3 className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-800">{stats.avgScore}%</p>
                                    <p className="text-sm text-gray-500">Điểm TB</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Tabs */}
                <div className="bg-white rounded-xl shadow-sm mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => setFilter('all')}
                            className={`flex-1 py-4 text-center font-medium transition ${filter === 'all'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Tất cả ({quizzes.length})
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`flex-1 py-4 text-center font-medium transition ${filter === 'pending'
                                ? 'text-yellow-600 border-b-2 border-yellow-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Chưa làm ({quizzes.filter(q => q.status === 'pending').length})
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`flex-1 py-4 text-center font-medium transition ${filter === 'completed'
                                ? 'text-green-600 border-b-2 border-green-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Đã hoàn thành ({quizzes.filter(q => q.status === 'completed').length})
                        </button>
                    </div>
                </div>

                {/* Quiz List */}
                {filteredQuizzes.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-700 mb-2">
                            {filter === 'pending'
                                ? 'Không có bài tập nào cần làm'
                                : filter === 'completed'
                                    ? 'Bạn chưa hoàn thành bài tập nào'
                                    : 'Chưa có bài tập nào'
                            }
                        </h3>
                        <p className="text-gray-500">
                            Hoàn thành các khóa học để nhận bài tập tổng kết từ AI
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredQuizzes.map((quiz) => (
                            <div
                                key={quiz.id}
                                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                {quiz.status === 'pending' ? (
                                                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                                        <Clock className="w-5 h-5 text-yellow-600" />
                                                    </div>
                                                ) : quiz.passed ? (
                                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                                        <Trophy className="w-5 h-5 text-green-600" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                                        <XCircle className="w-5 h-5 text-red-600" />
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-800">{quiz.title}</h3>
                                                    <p className="text-sm text-gray-500">{quiz.courseTitle}</p>
                                                </div>
                                            </div>

                                            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{quiz.description}</p>

                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Target className="w-4 h-4" />
                                                    {quiz.questionCount} câu hỏi
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {quiz.timeLimit} phút
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Award className="w-4 h-4" />
                                                    Điểm đậu: {quiz.passingScore}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right ml-6">
                                            {quiz.status === 'completed' ? (
                                                <div className="mb-4">
                                                    <p className={`text-3xl font-bold ${quiz.passed ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                        {quiz.score}%
                                                    </p>
                                                    <p className={`text-sm ${quiz.passed ? 'text-green-600' : 'text-red-600'
                                                        }`}>
                                                        {quiz.passed ? 'Đạt' : 'Chưa đạt'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                                                    Chưa làm
                                                </span>
                                            )}

                                            <button
                                                onClick={() => navigate(`/auto-quiz/${quiz.id}`)}
                                                className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-lg transition ${quiz.status === 'pending'
                                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {quiz.status === 'pending' ? 'Làm bài' : 'Xem lại'}
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="bg-gray-50 px-6 py-3 border-t">
                                    <p className="text-xs text-gray-500">
                                        {quiz.status === 'completed'
                                            ? `Hoàn thành: ${formatDate(quiz.attemptedAt!)}`
                                            : `Tạo lúc: ${formatDate(quiz.createdAt)}`
                                        }
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAutoQuizzes;
