import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
// @ts-ignore
import axios from "../../api/client";

interface ServerResources {
  server: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    uptimeFormatted: string;
  };
  cpu: {
    count: number;
    model: string;
    speed: number;
    usage: string;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: string;
    totalGB: string;
    usedGB: string;
    freeGB: string;
  };
  database: {
    sizeMB: string;
    tables: Array<{ table_name: string; count: number }>;
  };
}

const ServerMonitor: React.FC = () => {
  const { toast } = useToast();
  const [resources, setResources] = useState<ServerResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchResources = async () => {
    try {
      const response = await axios.get("/admin/server/resources");
      setResources(response.data.data);
    } catch (error: any) {
      console.error("Failed to fetch server resources:", error);
      toast({
        title: "Lỗi",
        description:
          error.response?.data?.message ||
          "Không thể tải thông tin server. Vui lòng kiểm tra backend đang chạy.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchResources();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getUsageColor = (percent: number) => {
    if (percent < 60) return "bg-green-500";
    if (percent < 80) return "bg-yellow-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Đang tải thông tin server...</p>
        </div>
      </div>
    );
  }

  if (!resources) {
    return (
      <div className="text-center py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Không có dữ liệu
          </h3>
          <p className="text-yellow-700 mb-4">
            Không thể tải thông tin server. Vui lòng kiểm tra:
          </p>
          <ul className="text-left text-sm text-yellow-600 space-y-1">
            <li>• Backend server đã chạy chưa (npm run dev)</li>
            <li>• Database đã kết nối đúng chưa</li>
            <li>• Bạn đã đăng nhập với tài khoản admin chưa</li>
          </ul>
          <button
            onClick={fetchResources}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Server Monitoring</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto-refresh (10s)</span>
          </label>
          <button
            onClick={fetchResources}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Server Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Server Information</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Platform:</span>
              <span className="font-semibold">{resources.server.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Architecture:</span>
              <span className="font-semibold">{resources.server.arch}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hostname:</span>
              <span className="font-semibold">{resources.server.hostname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Uptime:</span>
              <span className="font-semibold">
                {resources.server.uptimeFormatted}
              </span>
            </div>
          </div>
        </div>

        {/* CPU Usage */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">CPU Usage</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Usage</span>
              <span className="font-semibold">{resources.cpu.usage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full ${getUsageColor(
                  parseFloat(resources.cpu.usage)
                )}`}
                style={{ width: `${resources.cpu.usage}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Cores:</span>
              <span className="font-semibold">{resources.cpu.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Model:</span>
              <span className="font-semibold text-sm">
                {resources.cpu.model}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Load Average:</span>
              <span className="font-semibold">
                {resources.cpu.loadAverage.map((l) => l.toFixed(2)).join(", ")}
              </span>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Memory Usage</h2>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Usage</span>
              <span className="font-semibold">
                {resources.memory.usagePercent}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full ${getUsageColor(
                  parseFloat(resources.memory.usagePercent)
                )}`}
                style={{ width: `${resources.memory.usagePercent}%` }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold">
                {resources.memory.totalGB} GB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Used:</span>
              <span className="font-semibold">
                {resources.memory.usedGB} GB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Free:</span>
              <span className="font-semibold">
                {resources.memory.freeGB} GB
              </span>
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Database</h2>
          <div className="mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Database Size:</span>
              <span className="font-semibold">
                {resources.database.sizeMB} MB
              </span>
            </div>
          </div>
          <h3 className="font-semibold mb-2">Table Row Counts:</h3>
          <div className="space-y-2">
            {resources.database.tables.map((table) => (
              <div key={table.table_name} className="flex justify-between">
                <span className="text-gray-600 capitalize">
                  {table.table_name}:
                </span>
                <span className="font-semibold">
                  {table.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerMonitor;
