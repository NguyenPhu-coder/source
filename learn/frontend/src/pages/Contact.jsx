import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import SimpleMap from "@/components/SimpleMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/api/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from "lucide-react";

export default function Contact() {
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    try {
      const result = await apiClient.submitContact(data);

      if (result.success) {
        setSubmitted(true);
        reset();
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        alert(result.message || "Failed to send message");
      }
    } catch (error) {
      console.error("Error submitting contact form:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  const contactInfo = [
    {
      id: "email",
      icon: Mail,
      label: t("contactPage.info.email.label"),
      value: "support@learnhub.com",
    },
    {
      id: "phone",
      icon: Phone,
      label: t("contactPage.info.phone.label"),
      value: "+1 (555) 123-4567",
    },
    {
      id: "address",
      icon: MapPin,
      label: t("contactPage.info.address.label"),
      value: "123 Learning Street, Education City, EC 12345",
    },
    {
      id: "hours",
      icon: Clock,
      label: t("contactPage.info.hours.label"),
      value: t("contactPage.info.hours.value"),
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {t("contactPage.hero.title")}
              </h1>
              <p className="text-xl text-blue-100">
                {t("contactPage.hero.subtitle")}
              </p>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("contactPage.form.title")}</CardTitle>
                    <CardDescription>
                      {t("contactPage.form.subtitle")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submitted && (
                      <Alert className="mb-6 bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {t("contactPage.form.successMessage")}
                        </AlertDescription>
                      </Alert>
                    )}

                    <form
                      onSubmit={handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          {t("contactPage.form.name")}
                        </Label>
                        <Input
                          id="name"
                          placeholder={t("contactPage.form.namePlaceholder")}
                          {...register("name", {
                            required: t("contactPage.form.nameRequired"),
                          })}
                        />
                        {errors.name && (
                          <p className="text-sm text-red-600">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">
                          {t("contactPage.form.email")}
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder={t("contactPage.form.emailPlaceholder")}
                          {...register("email", {
                            required: t("contactPage.form.emailRequired"),
                            pattern: {
                              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                              message: t("contactPage.form.emailInvalid"),
                            },
                          })}
                        />
                        {errors.email && (
                          <p className="text-sm text-red-600">
                            {errors.email.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject">
                          {t("contactPage.form.subject")}
                        </Label>
                        <Input
                          id="subject"
                          placeholder={t("contactPage.form.subjectPlaceholder")}
                          {...register("subject", {
                            required: t("contactPage.form.subjectRequired"),
                          })}
                        />
                        {errors.subject && (
                          <p className="text-sm text-red-600">
                            {errors.subject.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">
                          {t("contactPage.form.message")}
                        </Label>
                        <Textarea
                          id="message"
                          rows={6}
                          placeholder={t("contactPage.form.messagePlaceholder")}
                          {...register("message", {
                            required: t("contactPage.form.messageRequired"),
                            minLength: {
                              value: 10,
                              message: t("contactPage.form.messageMinLength"),
                            },
                          })}
                        />
                        {errors.message && (
                          <p className="text-sm text-red-600">
                            {errors.message.message}
                          </p>
                        )}
                      </div>

                      <Button type="submit" className="w-full">
                        <Send className="w-4 h-4 mr-2" />
                        {t("contactPage.form.submit")}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Information */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-6">
                    {t("contactPage.info.title")}
                  </h2>
                  <div className="space-y-4">
                    {contactInfo.map((info) => {
                      const Icon = info.icon;
                      return (
                        <div key={info.id} className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {info.label}
                            </h3>
                            <p className="text-gray-600">{info.value}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Google Map */}
                <SimpleMap center={{ lat: 10.8231, lng: 106.6297 }} zoom={15} />
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-center mb-12">
                {t("contactPage.faq.title")}
              </h2>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-b border-gray-200 pb-6">
                    <h3 className="text-lg font-semibold mb-2">
                      {t(`contactPage.faq.q${i}.question`)}
                    </h3>
                    <p className="text-gray-600">
                      {t(`contactPage.faq.q${i}.answer`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
