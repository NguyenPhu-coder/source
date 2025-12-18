import { useState } from "react";
import { Save, Database, Mail, Shield } from "lucide-react";

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: "E-Learning Platform",
    siteDescription: "Learn anything, anywhere",
    contactEmail: "admin@elearning.com",
    allowRegistration: true,
    requireEmailVerification: false,
    enableNotifications: true,
    defaultLanguage: "en",
    maintenanceMode: false,
  });

  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    fromEmail: "noreply@elearning.com",
    fromName: "E-Learning Platform",
  });

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    // Save to backend
    alert("General settings saved successfully!");
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    // Save to backend
    alert("Email settings saved successfully!");
  };

  const handleBackup = () => {
    alert("Database backup initiated...");
  };

  const handleRestore = () => {
    if (
      confirm(
        "Are you sure you want to restore the database? This will overwrite current data."
      )
    ) {
      alert("Database restore initiated...");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold dark:text-white">System Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure system-wide settings and preferences
        </p>
      </div>

      {/* General Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold dark:text-white">
            General Settings
          </h2>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Site Name
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) =>
                  setSettings({ ...settings, siteName: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Contact Email
              </label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) =>
                  setSettings({ ...settings, contactEmail: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-white">
              Site Description
            </label>
            <textarea
              value={settings.siteDescription}
              onChange={(e) =>
                setSettings({ ...settings, siteDescription: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600 h-24"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allowRegistration}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      allowRegistration: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium dark:text-white">
                  Allow User Registration
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireEmailVerification}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      requireEmailVerification: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium dark:text-white">
                  Require Email Verification
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      enableNotifications: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium dark:text-white">
                  Enable Notifications
                </span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maintenanceMode: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium dark:text-white">
                  Maintenance Mode
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-5 h-5" />
              Save General Settings
            </button>
          </div>
        </form>
      </div>

      {/* Email Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-bold dark:text-white">Email Settings</h2>
        </div>

        <form onSubmit={handleSaveEmail} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                SMTP Host
              </label>
              <input
                type="text"
                value={emailSettings.smtpHost}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    smtpHost: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                SMTP Port
              </label>
              <input
                type="text"
                value={emailSettings.smtpPort}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    smtpPort: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                SMTP User
              </label>
              <input
                type="text"
                value={emailSettings.smtpUser}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    smtpUser: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                SMTP Password
              </label>
              <input
                type="password"
                value={emailSettings.smtpPassword}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    smtpPassword: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                From Email
              </label>
              <input
                type="email"
                value={emailSettings.fromEmail}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    fromEmail: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                From Name
              </label>
              <input
                type="text"
                value={emailSettings.fromName}
                onChange={(e) =>
                  setEmailSettings({
                    ...emailSettings,
                    fromName: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="w-5 h-5" />
              Save Email Settings
            </button>
          </div>
        </form>
      </div>

      {/* Database Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold dark:text-white">
            Database Management
          </h2>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Backup and restore your database. Always create a backup before
            making major changes.
          </p>

          <div className="flex gap-4">
            <button
              onClick={handleBackup}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Database className="w-5 h-5" />
              Backup Database
            </button>

            <button
              onClick={handleRestore}
              className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <Database className="w-5 h-5" />
              Restore Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
