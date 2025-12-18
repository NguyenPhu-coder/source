import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Trophy, Medal, Award } from "lucide-react";

interface LeaderboardProps {
  leaderboard: Array<{
    user_id: number;
    name: string;
    email: string;
    total_points: number;
    level: number;
    level_name: string;
    current_streak: number;
  }>;
  currentUserId?: number;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  leaderboard,
  currentUserId,
}) => {
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-amber-500 fill-amber-500" />;
      case 1:
        return <Medal className="h-5 w-5 text-slate-400 fill-slate-400" />;
      case 2:
        return <Award className="h-5 w-5 text-orange-600 fill-orange-600" />;
      default:
        return (
          <span className="text-muted-foreground font-semibold">
            #{index + 1}
          </span>
        );
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-slate-500";
      case 2:
        return "bg-blue-500";
      case 3:
        return "bg-purple-500";
      case 4:
        return "bg-amber-500";
      case 5:
        return "bg-rose-500";
      default:
        return "bg-slate-500";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🏆 Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((user, index) => (
            <div
              key={user.user_id}
              className={`flex items-center gap-4 p-3 rounded-lg border ${
                user.user_id === currentUserId
                  ? "bg-primary/5 border-primary"
                  : "bg-card"
              }`}
            >
              {/* Rank */}
              <div className="w-8 flex items-center justify-center">
                {getRankIcon(index)}
              </div>

              {/* User Avatar */}
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={user.avatar || "/images/placeholder-avatar.svg"}
                  alt={user.name}
                />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{user.name}</p>
                  {user.user_id === currentUserId && (
                    <Badge variant="secondary" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    className={`${getLevelColor(
                      user.level
                    )} text-white text-xs`}
                  >
                    Lvl {user.level}
                  </Badge>
                  {user.current_streak > 0 && (
                    <span className="text-xs text-muted-foreground">
                      🔥 {user.current_streak} days
                    </span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div className="text-right">
                <p className="font-bold text-lg">
                  {user.total_points.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No leaderboard data available
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
