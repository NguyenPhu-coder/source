import CryptoJS from "crypto-js";
import axios from "axios";

// MoMo Configuration
// Test credentials from MoMo official example
export const MOMO_CONFIG = {
  partnerCode: process.env.MOMO_PARTNER_CODE || "MOMO",
  accessKey: process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85",
  secretKey: process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz",
  endpoint: "https://test-payment.momo.vn/v2/gateway/api/create",
  redirectUrl:
    process.env.MOMO_REDIRECT_URL ||
    "http://localhost:5173/wallet",
  ipnUrl:
    process.env.MOMO_IPN_URL || "http://localhost:3000/api/wallet/ipn",
  requestType: "captureWallet",
};

interface MoMoPaymentRequest {
  orderId: string;
  orderCode: string;
  amount: number;
  orderInfo: string;
  returnUrl?: string;
  ipnUrl?: string;
  extraData?: string;
}

interface MoMoPaymentResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

/**
 * Tạo chữ ký HMAC SHA256 cho request theo MoMo spec
 * Format: accessKey=xxx&amount=xxx&extraData=xxx&ipnUrl=xxx&orderId=xxx&orderInfo=xxx&partnerCode=xxx&redirectUrl=xxx&requestId=xxx&requestType=xxx
 */
export function createMoMoSignature(data: Record<string, any>): string {
  // MoMo yêu cầu thứ tự cụ thể cho các fields trong signature
  const rawSignature =
    `accessKey=${data.accessKey}` +
    `&amount=${data.amount}` +
    `&extraData=${data.extraData}` +
    `&ipnUrl=${data.ipnUrl}` +
    `&orderId=${data.orderId}` +
    `&orderInfo=${data.orderInfo}` +
    `&partnerCode=${data.partnerCode}` +
    `&redirectUrl=${data.redirectUrl}` +
    `&requestId=${data.requestId}` +
    `&requestType=${data.requestType}`;

  console.log("🔐 Raw signature string:", rawSignature);

  // Hash với HMAC SHA256
  const signature = CryptoJS.HmacSHA256(rawSignature, MOMO_CONFIG.secretKey);

  return signature.toString(CryptoJS.enc.Hex);
}

/**
 * Tạo payment request đến MoMo
 */
export async function createMoMoPayment(
  params: MoMoPaymentRequest
): Promise<MoMoPaymentResponse> {
  const {
    orderId,
    orderCode,
    amount,
    orderInfo,
    returnUrl = MOMO_CONFIG.redirectUrl,
    ipnUrl = MOMO_CONFIG.ipnUrl,
    extraData = "",
  } = params;

  const requestId = `${orderId}_${Date.now()}`;

  const requestData = {
    partnerCode: MOMO_CONFIG.partnerCode,
    accessKey: MOMO_CONFIG.accessKey, // Required for signature verification
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl: returnUrl,
    ipnUrl: ipnUrl,
    lang: "vi",
    extraData,
    requestType: MOMO_CONFIG.requestType,
  };

  // Tạo signature
  const signatureData = {
    accessKey: MOMO_CONFIG.accessKey,
    amount: requestData.amount,
    extraData: requestData.extraData,
    ipnUrl: requestData.ipnUrl,
    orderId: requestData.orderId,
    orderInfo: requestData.orderInfo,
    partnerCode: requestData.partnerCode,
    redirectUrl: requestData.redirectUrl,
    requestId: requestData.requestId,
    requestType: requestData.requestType,
  };

  const signature = createMoMoSignature(signatureData);

  const requestBody = {
    ...requestData,
    signature,
  };

  try {
    console.log("🔐 MoMo Request:", {
      requestId,
      orderId,
      amount,
    });

    const response = await axios.post<MoMoPaymentResponse>(
      MOMO_CONFIG.endpoint,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ MoMo Response:", {
      resultCode: response.data.resultCode,
      message: response.data.message,
    });

    if (response.data.resultCode !== 0) {
      throw new Error(`MoMo Error: ${response.data.message}`);
    }

    return response.data;
  } catch (error: any) {
    console.error("❌ MoMo Payment Error:", error.message);
    if (error.response) {
      console.error("MoMo Error Response:", {
        status: error.response.status,
        data: error.response.data,
      });
    }
    throw new Error(`Failed to create MoMo payment: ${error.message}`);
  }
}

/**
 * Verify MoMo callback signature
 */
export function verifyMoMoSignature(data: Record<string, any>): boolean {
  const { signature, ...restData } = data;

  // Remove signature from data
  delete restData.signature;

  const calculatedSignature = createMoMoSignature(restData);

  return calculatedSignature === signature;
}

/**
 * Parse MoMo result code
 */
export function parseMoMoResultCode(resultCode: number): string {
  const resultMessages: Record<number, string> = {
    0: "Giao dịch thành công",
    9000: "Giao dịch được khởi tạo, chờ người dùng xác nhận thanh toán",
    1000: "Giao dịch đã được khởi tạo, chờ người dùng xác nhận thanh toán",
    1001: "Giao dịch thất bại do người dùng từ chối xác nhận thanh toán",
    1002: "Giao dịch bị từ chối do thông tin không hợp lệ",
    1003: "Giao dịch bị từ chối do người dùng hủy",
    1004: "Giao dịch thất bại do hết phiên thanh toán",
    1005: "Giao dịch thất bại do lỗi từ MoMo",
    1006: "Giao dịch bị từ chối do người dùng hủy",
    1007: "Giao dịch bị từ chối do người dùng chưa đăng ký/chưa liên kết ví",
    2001: "Giao dịch thất bại do sai thông tin",
    4001: "Số dư không đủ để thanh toán",
    4010: "Giao dịch bị giới hạn theo quy định",
  };

  return (
    resultMessages[resultCode] || `Lỗi không xác định (Code: ${resultCode})`
  );
}
