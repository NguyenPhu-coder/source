import React from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface BadgeCardProps {
  badge: {
    id: number;
    name_en: string;
    name_vi: string;
    description_en: string;
    description_vi: string;
    icon: string;
    trigger_value: number;
    earned?: boolean;
    earned_at?: string;
    currentValue?: number;
    progressPercentage?: number;
  };
}

const BadgeCard: React.FC<BadgeCardProps> = ({ badge }) => {
  const { language } = useLanguage();

  const getBadgeName = () => {
    switch (language) {
      case "vi":
        return badge.name_vi;
      default:
        return badge.name_en;
    }
  };

  const getBadgeDescription = () => {
    switch (language) {
      case "vi":
        return badge.description_vi;
      default:
        return badge.description_en;
    }
  };

  return (
    <Card
      className={`relative overflow-hidden ${
        badge.earned ? "border-amber-500" : "opacity-60"
      }`}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          {/* Badge Icon */}
          <div
            className={`text-5xl ${badge.earned ? "grayscale-0" : "grayscale"}`}
          >
            {badge.icon}
          </div>

          {/* Badge Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg">{getBadgeName()}</h3>
              {badge.earned && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800"
                >
                  Earned
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {getBadgeDescription()}
            </p>

            {/* Progress Bar (if not earned) */}
            {!badge.earned && badge.progressPercentage !== undefined && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>
                    {badge.currentValue || 0} / {badge.trigger_value}
                  </span>
                  <span>{Math.round(badge.progressPercentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all"
                    style={{ width: `${badge.progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Earned Date */}
            {badge.earned && badge.earned_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Earned on {new Date(badge.earned_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {/* Shine Effect for Earned Badges */}
        {badge.earned && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
        )}
      </CardContent>
    </Card>
  );
};

export default BadgeCard;
