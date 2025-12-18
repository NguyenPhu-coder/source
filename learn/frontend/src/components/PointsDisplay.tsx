import React from 'react';
import { Trophy, TrendingUp, Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface PointsDisplayProps {
  points: {
    total_points: number;
    current_streak: number;
    longest_streak: number;
    level: number;
    level_name: string;
    rank?: number;
  };
}

const PointsDisplay: React.FC<PointsDisplayProps> = ({ points }) => {
  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-slate-500';
      case 2: return 'bg-blue-500';
      case 3: return 'bg-purple-500';
      case 4: return 'bg-amber-500';
      case 5: return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  const getNextLevelPoints = (level: number) => {
    switch (level) {
      case 1: return 1000;
      case 2: return 5000;
      case 3: return 15000;
      case 4: return 50000;
      default: return null;
    }
  };

  const nextLevelPoints = getNextLevelPoints(points.level);
  const progressToNextLevel = nextLevelPoints 
    ? ((points.total_points % nextLevelPoints) / nextLevelPoints) * 100 
    : 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total Points */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Points</CardTitle>
          <Trophy className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{points.total_points.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={`${getLevelColor(points.level)} text-white`}>
              Level {points.level} - {points.level_name}
            </Badge>
          </div>
          {nextLevelPoints && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Progress to Level {points.level + 1}</span>
                <span>{Math.round(progressToNextLevel)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${getLevelColor(points.level + 1)}`}
                  style={{ width: `${progressToNextLevel}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
          <Flame className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{points.current_streak} days</div>
          <p className="text-xs text-muted-foreground mt-2">
            Longest: {points.longest_streak} days
          </p>
          <div className="mt-3 flex items-center gap-1">
            {[...Array(Math.min(points.current_streak, 7))].map((_, i) => (
              <Flame key={i} className="h-4 w-4 text-orange-500 fill-orange-500" />
            ))}
            {points.current_streak > 7 && (
              <span className="text-xs text-muted-foreground ml-1">
                +{points.current_streak - 7}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Rank */}
      {points.rank && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Rank</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{points.rank}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {points.rank <= 10 ? '🏆 Top 10!' : points.rank <= 100 ? '⭐ Top 100!' : 'Keep climbing!'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PointsDisplay;
