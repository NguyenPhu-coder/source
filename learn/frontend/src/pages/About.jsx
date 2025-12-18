import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import {
  Award,
  Users,
  Target,
  Heart,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

export default function About() {
  const { t } = useLanguage();

  const stats = [
    { id: "students", icon: Users },
    { id: "courses", icon: Award },
    { id: "instructors", icon: Users },
    { id: "countries", icon: TrendingUp },
  ];

  const values = [
    { id: "quality", icon: Award },
    { id: "accessibility", icon: Users },
    { id: "innovation", icon: Target },
    { id: "community", icon: Heart },
  ];

  const team = [{ id: "ceo" }, { id: "cto" }, { id: "cmo" }, { id: "coo" }];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {t("aboutPage.hero.title")}
              </h1>
              <p className="text-xl text-blue-100">
                {t("aboutPage.hero.subtitle")}
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-8">
                {t("aboutPage.mission.title")}
              </h2>
              <p className="text-lg text-gray-700 text-center leading-relaxed mb-6">
                {t("aboutPage.mission.content1")}
              </p>
              <p className="text-lg text-gray-700 text-center leading-relaxed">
                {t("aboutPage.mission.content2")}
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              {t("aboutPage.stats.title")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.id} className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Icon className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {t(`aboutPage.stats.${stat.id}.number`)}
                    </div>
                    <div className="text-gray-600">
                      {t(`aboutPage.stats.${stat.id}.label`)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              {t("aboutPage.values.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <div key={value.id} className="text-center">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <Icon className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-3">
                      {t(`aboutPage.values.${value.id}.title`)}
                    </h3>
                    <p className="text-gray-600">
                      {t(`aboutPage.values.${value.id}.description`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              {t("aboutPage.team.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="bg-white rounded-lg p-6 text-center shadow-sm"
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold mb-1">
                    {t(`aboutPage.team.${member.id}.name`)}
                  </h3>
                  <p className="text-blue-600 mb-3">
                    {t(`aboutPage.team.${member.id}.position`)}
                  </p>
                  <p className="text-gray-600 text-sm">
                    {t(`aboutPage.team.${member.id}.bio`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-blue-600 text-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">
                {t("aboutPage.cta.title")}
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                {t("aboutPage.cta.subtitle")}
              </p>
              <a
                href="/register"
                className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
              >
                {t("aboutPage.cta.button")}
              </a>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
