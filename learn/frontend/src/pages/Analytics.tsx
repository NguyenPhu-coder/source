import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/api/client';
import {
  TrendingUp,
  Clock,
  BookOpen,
  Target,
  Calendar,
  Award,
  BarChart3,
  Activity,
} from 'lucide-react';

interface WeeklyActivity {
  date: string;
  hours: number;
  lessonsCompleted: number;
  pointsEarned: number;
}

interface SkillProgress {
  category: string;
  coursesCompleted: number;
  totalCourses: number;
  averageRating: number;
}

const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [skillsProgress, setSkillsProgress] = useState<SkillProgress[]>([]);
  const [stats, setStats] = useState({
    totalHours: 0,
    avgSessionTime: 0,
    completionRate: 0,
    currentStreak: 0,
    totalPoints: 0,
    coursesCompleted: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard overview for basic stats
      const dashboardRes = await apiClient.getDashboardOverview();
      const gamificationRes = await apiClient.getGamificationOverview();
      const historyRes = await apiClient.getPointsHistory(30);

      if (dashboardRes.success) {
        const enrollments = dashboardRes.data.enrollments || [];
        const totalLessons = enrollments.reduce((sum: number, e: any) => sum + (e.total_lessons || 0), 0);
        const completedLessons = enrollments.reduce((sum: number, e: any) => sum + (e.completed_lessons || 0), 0);

        setStats({
          totalHours: Math.round(totalLessons * 0.5), // Assuming 30 min per lesson
          avgSessionTime: 45,
          completionRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          currentStreak: gamificationRes.data?.points?.current_streak || 0,
          totalPoints: gamificationRes.data?.points?.total_points || 0,
          coursesCompleted: dashboardRes.data.stats?.completed_courses || 0,
        });

        // Generate weekly activity from recent history
        if (historyRes.success) {
          const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            return date.toISOString().split('T')[0];
          });

          const activityMap = new Map<string, WeeklyActivity>();
          last7Days.forEach(date => {
            activityMap.set(date, {
              date,
              hours: 0,
              lessonsCompleted: 0,
              pointsEarned: 0,
            });
          });

          historyRes.data.forEach((item: any) => {
            const date = new Date(item.created_at).toISOString().split('T')[0];
            if (activityMap.has(date)) {
              const activity = activityMap.get(date)!;
              activity.pointsEarned += item.points;
              if (item.activity_type === 'complete_lesson') {
                activity.lessonsCompleted += 1;
                activity.hours += 0.5;
              }
            }
          });

          setWeeklyActivity(Array.from(activityMap.values()));
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const maxHours = Math.max(...weeklyActivity.map(d => d.hours), 1);
  const maxPoints = Math.max(...weeklyActivity.map(d => d.pointsEarned), 1);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">📊 Learning Analytics</h1>
          <p className="text-muted-foreground">
            Track your progress and insights
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalHours}h</div>
              <p className="text-xs text-muted-foreground">
                Avg {stats.avgSessionTime} min/session
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.coursesCompleted} courses completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.currentStreak} days</div>
              <p className="text-xs text-muted-foreground">
                Keep it up! 🔥
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Points earned
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Activity Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>📈 Weekly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="hours">
              <TabsList className="mb-4">
                <TabsTrigger value="hours">Study Hours</TabsTrigger>
                <TabsTrigger value="lessons">Lessons</TabsTrigger>
                <TabsTrigger value="points">Points</TabsTrigger>
              </TabsList>

              <TabsContent value="hours">
                <div className="space-y-3">
                  {weeklyActivity.map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                        <div
                          className="bg-blue-500 h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-semibold transition-all"
                          style={{ width: `${(day.hours / maxHours) * 100}%` }}
                        >
                          {day.hours > 0 && `${day.hours}h`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="lessons">
                <div className="space-y-3">
                  {weeklyActivity.map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                        <div
                          className="bg-green-500 h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-semibold transition-all"
                          style={{ width: `${(day.lessonsCompleted / Math.max(...weeklyActivity.map(d => d.lessonsCompleted), 1)) * 100}%` }}
                        >
                          {day.lessonsCompleted > 0 && `${day.lessonsCompleted}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="points">
                <div className="space-y-3">
                  {weeklyActivity.map((day, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 text-sm text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                        <div
                          className="bg-amber-500 h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-semibold transition-all"
                          style={{ width: `${(day.pointsEarned / maxPoints) * 100}%` }}
                        >
                          {day.pointsEarned > 0 && `${day.pointsEarned}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Learning Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>💡 Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Strong Performance</p>
                    <p className="text-sm text-muted-foreground">
                      Your completion rate is {stats.completionRate}%, above average!
                    </p>
                  </div>
                </div>

                {stats.currentStreak >= 7 && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                    <Activity className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Consistency Master</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.currentStreak} day streak! Keep the momentum going.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <BookOpen className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Learning Goal</p>
                    <p className="text-sm text-muted-foreground">
                      You're averaging {stats.avgSessionTime} minutes per session.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🎯 Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Weekly Goal</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.min(weeklyActivity.reduce((sum, d) => sum + d.hours, 0), 10)}/10 hours
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${Math.min((weeklyActivity.reduce((sum, d) => sum + d.hours, 0) / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Monthly Goal</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.coursesCompleted}/3 courses
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.coursesCompleted / 3) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Points Goal</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.totalPoints}/5000
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.totalPoints / 5000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Analytics;
