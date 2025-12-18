import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Loader2,
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    History,
    CreditCard,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

interface Transaction {
    id: number;
    amount: number;
    type: string;
    status: string;
    description: string;
    created_at: string;
    reference_id: string;
}

export default function WalletPage() {
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [depositAmount, setDepositAmount] = useState<string>("");
    const [processingDeposit, setProcessingDeposit] = useState(false);
    const [openDepositModal, setOpenDepositModal] = useState(false);

    useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        try {
            setLoading(true);
            const response = await axios.get(
                "http://127.0.0.1:3000/api/wallet/balance",
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                }
            );
            if (response.data.success) {
                setBalance(response.data.data.balance || 0);
                setTransactions(response.data.data.transactions || []);
            }
        } catch (error) {
            console.error("Failed to fetch wallet:", error);
            toast.error("Không thể tải thông tin ví");
        } finally {
            setLoading(false);
        }
    };

    const handleDeposit = async () => {
        const amount = parseInt(depositAmount.replace(/[^0-9]/g, ""));
        if (!amount || amount < 10000) {
            toast.error("Số tiền nạp tối thiểu là 10,000 VND");
            return;
        }

        setProcessingDeposit(true);
        try {
            const response = await axios.post(
                "http://127.0.0.1:3000/api/wallet/deposit",
                { amount },
                {
                    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                }
            );

            if (response.data.success) {
                // Redirect to MoMo payUrl
                window.location.href = response.data.data.payUrl;
            } else {
                toast.error("Không thể tạo giao dịch nạp tiền");
            }
        } catch (error) {
            console.error("Deposit error:", error);
            toast.error("Lỗi kết nối đến server");
        } finally {
            setProcessingDeposit(false);
        }
    };

    const formatVND = (amount: number) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "bg-green-500/10 text-green-500 border-green-500/20";
            case "pending":
                return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            case "failed":
                return "bg-red-500/10 text-red-500 border-red-500/20";
            default:
                return "bg-gray-500/10 text-gray-500 border-gray-500/20";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "deposit":
                return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
            case "purchase":
                return <ArrowUpRight className="w-5 h-5 text-blue-500" />;
            case "refund":
                return <RefreshCw className="w-5 h-5 text-orange-500" />;
            default:
                return <ArrowUpRight className="w-5 h-5 text-gray-500" />;
        }
    };

    return (
        <Layout>
            <div className="container mx-auto px-4 py-8 max-w-5xl">
                <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    Ví của tôi
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Balance Card */}
                    <Card className="col-span-1 shadow-lg border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Số dư khả dụng
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <span className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                                        {formatVND(balance)}
                                    </span>
                                    <div className="flex gap-2">
                                        <Dialog
                                            open={openDepositModal}
                                            onOpenChange={setOpenDepositModal}
                                        >
                                            <DialogTrigger asChild>
                                                <Button className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                                                    <ArrowDownLeft className="w-4 h-4 mr-2" />
                                                    Nạp tiền
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Nạp tiền vào ví</DialogTitle>
                                                    <DialogDescription>
                                                        Nạp tiền qua cổng thanh toán MoMo an toàn và nhanh
                                                        chóng.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">
                                                            Số tiền muốn nạp (VND)
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            placeholder="Nhập số tiền (tối thiểu 10,000đ)"
                                                            value={depositAmount}
                                                            onChange={(e) => setDepositAmount(e.target.value)}
                                                            min={10000}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            Số dư hiện tại: {formatVND(balance)}
                                                        </p>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {[50000, 100000, 200000].map((amount) => (
                                                            <Button
                                                                key={amount}
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    setDepositAmount(amount.toString())
                                                                }
                                                            >
                                                                {formatVND(amount)}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setOpenDepositModal(false)}
                                                    >
                                                        Hủy
                                                    </Button>
                                                    <Button
                                                        onClick={handleDeposit}
                                                        disabled={processingDeposit}
                                                        className="bg-gradient-to-r from-purple-600 to-blue-600"
                                                    >
                                                        {processingDeposit ? (
                                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        ) : (
                                                            <CreditCard className="w-4 h-4 mr-2" />
                                                        )}
                                                        Thanh toán MoMo
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        <Button variant="outline" className="w-full" disabled>
                                            <ArrowUpRight className="w-4 h-4 mr-2" />
                                            Rút tiền
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Transaction History */}
                    <Card className="col-span-1 md:col-span-2 shadow-lg">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <History className="w-5 h-5" /> Lịch sử giao dịch
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={fetchWalletData}
                                disabled={loading}
                            >
                                <RefreshCw
                                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                                />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : transactions.length > 0 ? (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {transactions.map((tx) => (
                                        <div
                                            key={tx.id}
                                            className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className={`p-2 rounded-full ${tx.type === "deposit"
                                                            ? "bg-green-100 dark:bg-green-900/30"
                                                            : "bg-blue-100 dark:bg-blue-900/30"
                                                        }`}
                                                >
                                                    {getTypeIcon(tx.type)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {tx.description}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(tx.created_at).toLocaleString("vi-VN")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p
                                                    className={`font-bold ${tx.type === "deposit"
                                                            ? "text-green-600"
                                                            : "text-slate-900 dark:text-slate-100"
                                                        }`}
                                                >
                                                    {tx.type === "deposit" ? "+" : "-"}
                                                    {formatVND(tx.amount)}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className={getStatusColor(tx.status)}
                                                >
                                                    {tx.status === "completed"
                                                        ? "Thành công"
                                                        : tx.status === "pending"
                                                            ? "Đang xử lý"
                                                            : "Thất bại"}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Chưa có giao dịch nào.</p>
                                    <p className="text-sm mt-1">
                                        Nạp tiền để bắt đầu mua khóa học!
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
