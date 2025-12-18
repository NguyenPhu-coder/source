import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Award,
    BookOpen,
    Target,
    TrendingUp,
    Clock,
    Star,
    Edit2,
    Save,
    X,
    Camera,
    Globe,
    Sparkles,
    Brain,
    Zap,
    Shield,
    Activity,
    Layers
} from 'lucide-react';

interface LearningProfile {
    learningStyle: string;
    difficulty: string;
    interests: string[];
    gradeLevel: string;
    culture: string;
    language: string;
}

interface UserStats {
    totalCourses: number;
    completedCourses: number;
    totalHours: number;
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
    rank: number;
    level: number;
    levelName: string;
    completedLessons: number;
    badges: any[];
}

export default function Profile() {
    const { user, updateUser } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [aiProfile, setAiProfile] = useState<LearningProfile | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        bio: '',
        phone: '',
        location: '',
        website: '',
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                bio: user.bio || '',
                phone: user.phone || '',
                location: user.location || '',
                website: user.website || '',
            });
            fetchUserData();
        }
    }, [user]);

    const fetchUserData = async () => {
        try {
            setLoading(true);

            // Fetch dashboard overview for stats
            const [dashboardRes, gamificationRes, aiProfileRes] = await Promise.all([
                apiClient.getDashboardOverview(),
                apiClient.getGamificationOverview(),
                fetchAIProfile(),
            ]);

            if (dashboardRes.success) {
                const enrollments = dashboardRes.data.enrollments || [];
                const completedLessons = enrollments.reduce((sum: number, e: any) => sum + (e.completed_lessons || 0), 0);

                setStats({
                    totalCourses: enrollments.length,
                    completedCourses: dashboardRes.data.stats?.completed_courses || 0,
                    totalHours: Math.round(completedLessons * 0.5),
                    totalPoints: gamificationRes.data?.points?.total_points || 0,
                    currentStreak: gamificationRes.data?.points?.current_streak || 0,
                    longestStreak: gamificationRes.data?.points?.longest_streak || 0,
                    rank: gamificationRes.data?.points?.rank || 0,
                    level: gamificationRes.data?.points?.level || 1,
                    levelName: gamificationRes.data?.points?.level_name || 'Beginner',
                    completedLessons,
                    badges: gamificationRes.data?.earnedBadges || [],
                });
            }

            if (aiProfileRes) {
                setAiProfile(aiProfileRes);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAIProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://127.0.0.1:3000/api/agents/profile/${user?.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();

            if (data.success && data.data?.profile) {
                return {
                    learningStyle: data.data.profile.learning_style || 'visual',
                    difficulty: data.data.profile.difficulty || 'intermediate',
                    interests: data.data.profile.interests || ['general'],
                    gradeLevel: data.data.profile.grade_level || '8',
                    culture: data.data.profile.culture || 'general',
                    language: data.data.profile.language || 'vi',
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching AI profile:', error);
            return null;
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://127.0.0.1:3000/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                if (updateUser) {
                    updateUser(formData);
                }
                setEditing(false);
                toast({
                    title: 'Thành công',
                    description: 'Đã cập nhật thông tin cá nhân',
                });
            } else {
                toast({
                    title: 'Lỗi',
                    description: data.message || 'Không thể cập nhật thông tin',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Lỗi',
                description: 'Có lỗi xảy ra',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const getLearningStyleIcon = (style: string) => {
        switch (style) {
            case 'visual': return '👁️';
            case 'auditory': return '👂';
            case 'kinesthetic': return '🤲';
            case 'reading_writing': return '📖';
            default: return '📚';
        }
    };

    const getLearningStyleLabel = (style: string) => {
        switch (style) {
            case 'visual': return 'Học qua hình ảnh';
            case 'auditory': return 'Học qua âm thanh';
            case 'kinesthetic': return 'Học qua thực hành';
            case 'reading_writing': return 'Học qua đọc/viết';
            default: return 'Đa phương thức';
        }
    };

    const getDifficultyLabel = (diff: string) => {
        switch (diff) {
            case 'beginner': return 'Cơ bản';
            case 'intermediate': return 'Trung cấp';
            case 'advanced': return 'Nâng cao';
            default: return diff;
        }
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring",
                stiffness: 100
            }
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-200 to-purple-200 rounded-full blur-xl opacity-50 animate-pulse" />
                        <Sparkles className="w-12 h-12 text-blue-600 animate-spin" />
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
                {/* Background ambient effects */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/40 to-transparent pointer-events-none" />
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[100px] pointer-events-none" />

                <motion.div
                    className="max-w-7xl mx-auto px-4 py-8 relative z-10"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Sidebar - Profile Info */}
                        <motion.div className="lg:col-span-4 space-y-6" variants={itemVariants}>
                            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden relative group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <CardContent className="pt-8 pb-8 flex flex-col items-center relative z-10">
                                    <div className="relative mb-6">
                                        <div className="w-32 h-32 rounded-full p-[2px] bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500">
                                            <div className="w-full h-full rounded-full border-4 border-white overflow-hidden">
                                                {user?.avatar ? (
                                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 bg-clip-text text-transparent">
                                                        {user?.name?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button className="absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg transition-transform hover:scale-110">
                                            <Camera className="w-4 h-4 text-white" />
                                        </button>
                                    </div>

                                    <h1 className="text-2xl font-bold text-center mb-1 text-slate-800">{user?.name}</h1>
                                    <p className="text-slate-500 text-center text-sm mb-4">{user?.email}</p>

                                    <div className="flex gap-2 mb-6">
                                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                                            {stats?.levelName || 'Beginner'}
                                        </Badge>
                                        {stats?.rank && stats.rank <= 10 && (
                                            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200">
                                                🏆 Top {stats.rank}
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="w-full grid grid-cols-3 gap-2 border-t border-slate-100 pt-6">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-slate-700">{stats?.totalCourses}</p>
                                            <p className="text-xs text-slate-500">Khóa học</p>
                                        </div>
                                        <div className="text-center border-l border-slate-100 border-r">
                                            <p className="text-lg font-bold text-slate-700">{stats?.completedLessons}</p>
                                            <p className="text-xs text-slate-500">Bài học</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-slate-700">{stats?.totalHours}</p>
                                            <p className="text-xs text-slate-500">Giờ học</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                                        <User className="w-5 h-5 text-blue-500" />
                                        Thông tin cá nhân
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-3">
                                        {user?.phone && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <Phone className="w-4 h-4 text-slate-400" />
                                                {user.phone}
                                            </div>
                                        )}
                                        {user?.location && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <MapPin className="w-4 h-4 text-slate-400" />
                                                {user.location}
                                            </div>
                                        )}
                                        {user?.website && (
                                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                                <Globe className="w-4 h-4 text-slate-400" />
                                                <a href={user.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                                    {user.website.replace('https://', '')}
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {user?.bio && (
                                        <div className="pt-4 border-t border-slate-100">
                                            <p className="text-sm text-slate-500 italic">"{user.bio}"</p>
                                        </div>
                                    )}

                                    <Button
                                        variant="outline"
                                        className="w-full mt-4 bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                                        onClick={() => setEditing(true)}
                                    >
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Chỉnh sửa hồ sơ
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Main Content - Tabs & Stats */}
                        <motion.div className="lg:col-span-8 space-y-6" variants={itemVariants}>
                            {/* Main Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <motion.div whileHover={{ y: -5 }} className="bg-white border border-yellow-100 rounded-xl p-6 relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Award className="w-16 h-16 text-yellow-500" />
                                    </div>
                                    <p className="text-yellow-600 text-sm font-medium mb-1">Điểm tích lũy</p>
                                    <h3 className="text-3xl font-bold text-slate-800">{stats?.totalPoints?.toLocaleString()}</h3>
                                    <p className="text-xs text-yellow-600/80 mt-2">Top {stats?.rank ? `${stats.rank}%` : '10%'} server</p>
                                </motion.div>

                                <motion.div whileHover={{ y: -5 }} className="bg-white border border-blue-100 rounded-xl p-6 relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Zap className="w-16 h-16 text-blue-500" />
                                    </div>
                                    <p className="text-blue-600 text-sm font-medium mb-1">Chuỗi ngày (Streak)</p>
                                    <h3 className="text-3xl font-bold text-slate-800">{stats?.currentStreak} 🔥</h3>
                                    <p className="text-xs text-blue-600/80 mt-2">Kỷ lục: {stats?.longestStreak} ngày</p>
                                </motion.div>

                                <motion.div whileHover={{ y: -5 }} className="bg-white border border-green-100 rounded-xl p-6 relative overflow-hidden shadow-sm">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Target className="w-16 h-16 text-green-500" />
                                    </div>
                                    <p className="text-green-600 text-sm font-medium mb-1">Cấp độ</p>
                                    <h3 className="text-3xl font-bold text-slate-800">{stats?.level}</h3>
                                    <p className="text-xs text-green-600/80 mt-2">{stats?.levelName}</p>
                                </motion.div>
                            </div>

                            <Tabs defaultValue="ai-profile" className="w-full">
                                <TabsList className="bg-slate-100 border border-slate-200 w-full justify-start p-1 h-auto flex-wrap">
                                    <TabsTrigger value="ai-profile" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        AI Profile
                                    </TabsTrigger>
                                    <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600">
                                        <Activity className="w-4 h-4 mr-2" />
                                        Tiến độ
                                    </TabsTrigger>
                                    <TabsTrigger value="badges" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-slate-600">
                                        <Award className="w-4 h-4 mr-2" />
                                        Huy hiệu
                                    </TabsTrigger>
                                </TabsList>

                                <AnimatePresence mode="wait">
                                    <TabsContent value="ai-profile" className="mt-6">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <Card className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-purple-100 shadow-sm overflow-hidden relative">
                                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20" />
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-2 text-purple-700">
                                                        <Brain className="w-6 h-6" />
                                                        Hồ sơ học tập AI
                                                        <Badge variant="outline" className="ml-2 border-purple-200 text-purple-600 bg-purple-50">
                                                            Powered by Gemini
                                                        </Badge>
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    {aiProfile ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            {/* Learning Style */}
                                                            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 transition-colors group shadow-sm">
                                                                <div className="flex items-center gap-4 mb-3">
                                                                    <div className="w-12 h-12 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                                                        {getLearningStyleIcon(aiProfile.learningStyle)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm text-slate-500">Phong cách học tập</p>
                                                                        <p className="text-lg font-bold text-slate-800">
                                                                            {getLearningStyleLabel(aiProfile.learningStyle)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                                    AI đã phân tích và xác định rằng bạn học hiệu quả nhất thông qua
                                                                    <span className="text-purple-600 font-medium">
                                                                        {aiProfile.learningStyle === 'visual' && ' hình ảnh, biểu đồ và video.'}
                                                                        {aiProfile.learningStyle === 'auditory' && ' audio, podcast và thảo luận.'}
                                                                        {aiProfile.learningStyle === 'kinesthetic' && ' thực hành và làm bài tập.'}
                                                                        {aiProfile.learningStyle === 'reading_writing' && ' đọc tài liệu và ghi chép.'}
                                                                    </span>
                                                                </p>
                                                            </div>

                                                            {/* Difficulty & Grade */}
                                                            <div className="p-5 rounded-xl bg-white border border-slate-200 hover:border-green-300 transition-colors group shadow-sm">
                                                                <div className="flex items-center gap-4 mb-3">
                                                                    <div className="w-12 h-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                                                        📊
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm text-slate-500">Trình độ & Lớp</p>
                                                                        <p className="text-lg font-bold text-slate-800">
                                                                            {getDifficultyLabel(aiProfile.difficulty)} • Grade {aiProfile.gradeLevel}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                                    Lộ trình được cá nhân hóa ở mức
                                                                    <span className="text-green-600 font-medium">
                                                                        {aiProfile.difficulty === 'beginner' && ' cơ bản để xây dựng nền tảng vững chắc.'}
                                                                        {aiProfile.difficulty === 'intermediate' && ' trung cấp để phát triển kỹ năng.'}
                                                                        {aiProfile.difficulty === 'advanced' && ' nâng cao để thử thách bản thân.'}
                                                                    </span>
                                                                </p>
                                                            </div>

                                                            {/* Interests */}
                                                            <div className="col-span-1 md:col-span-2 p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <Star className="w-5 h-5 text-yellow-500" />
                                                                    <span className="font-semibold text-slate-800">Sở thích & Quan tâm</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {aiProfile.interests.map((interest, idx) => (
                                                                        <Badge
                                                                            key={idx}
                                                                            variant="outline"
                                                                            className="bg-yellow-50 text-yellow-700 border-yellow-200 px-3 py-1 text-sm"
                                                                        >
                                                                            {interest}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-12">
                                                            <Brain className="w-16 h-16 text-slate-300 mx-auto mb-4 animate-pulse" />
                                                            <p className="text-slate-500">Đang khởi tạo hồ sơ AI của bạn...</p>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </TabsContent>

                                    <TabsContent value="overview" className="mt-6">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="grid grid-cols-1 gap-6"
                                        >
                                            <Card className="bg-white border-slate-200 shadow-sm backdrop-blur-sm">
                                                <CardHeader>
                                                    <CardTitle className="text-slate-800">Tiến độ khóa học</CardTitle>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-6">
                                                        <div>
                                                            <div className="flex justify-between mb-2">
                                                                <span className="text-sm text-slate-500">Tổng quan hoàn thành</span>
                                                                <span className="text-sm text-slate-700 font-bold">
                                                                    {stats?.totalCourses ? Math.round((stats.completedCourses / stats.totalCourses) * 100) : 0}%
                                                                </span>
                                                            </div>
                                                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                                                                    style={{ width: `${stats?.totalCourses ? (stats.completedCourses / stats.totalCourses) * 100 : 0}%` }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                                                                <p className="text-2xl font-bold text-blue-600">{stats?.completedCourses}</p>
                                                                <p className="text-xs text-slate-500">Khóa đã xong</p>
                                                            </div>
                                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                                                                <p className="text-2xl font-bold text-purple-600">{stats?.totalCourses}</p>
                                                                <p className="text-xs text-slate-500">Đang học</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </TabsContent>

                                    <TabsContent value="badges" className="mt-6">
                                        <motion.div
                                            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                                            initial="hidden"
                                            animate="visible"
                                            variants={{
                                                visible: { transition: { staggerChildren: 0.05 } }
                                            }}
                                        >
                                            {stats?.badges && stats.badges.length > 0 ? (
                                                stats.badges.map((badge: any, idx: number) => (
                                                    <motion.div
                                                        key={idx}
                                                        variants={itemVariants}
                                                        className="group p-4 bg-white border border-slate-200 rounded-xl text-center hover:shadow-md transition-all hover:-translate-y-1 hover:border-purple-200"
                                                    >
                                                        <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">{badge.icon}</div>
                                                        <p className="font-bold text-sm text-slate-800 truncate">{badge.name_vi || badge.name_en}</p>
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                            {badge.description_vi || badge.description_en}
                                                        </p>
                                                    </motion.div>
                                                ))
                                            ) : (
                                                <div className="col-span-full py-12 text-center text-slate-400">
                                                    Chưa có huy hiệu nào. Hãy hoàn thành các thử thách!
                                                </div>
                                            )}
                                        </motion.div>
                                    </TabsContent>
                                </AnimatePresence>
                            </Tabs>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Edit Profile Modal/Overlay */}
                <AnimatePresence>
                    {editing && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                            >
                                <button
                                    onClick={() => setEditing(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <h2 className="text-xl font-bold mb-6 text-slate-800">Chỉnh sửa thông tin</h2>

                                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Họ và tên</label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Giới thiệu</label>
                                        <Textarea
                                            value={formData.bio}
                                            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                            className="bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500"
                                            rows={3}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Điện thoại</label>
                                            <Input
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="bg-slate-50 border-slate-200 text-slate-900"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Vị trí</label>
                                            <Input
                                                value={formData.location}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                                className="bg-slate-50 border-slate-200 text-slate-900"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Website</label>
                                        <Input
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            className="bg-slate-50 border-slate-200 text-slate-900"
                                        />
                                    </div>

                                    <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 mt-2 text-white">
                                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </Button>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </Layout>
    );
}
