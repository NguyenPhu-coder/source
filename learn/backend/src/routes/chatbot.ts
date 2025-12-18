import express from "express";

const router = express.Router();

// Gemini API configuration
const GEMINI_API_KEY = "AIzaSyDLLCEg_RCdRgwNCxiXU_sNopjHLz_kWEw";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

// Chat with Gemini AI
router.post("/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required"
            });
        }

        // Build conversation context
        let conversationContext = `Bạn là một trợ lý AI hỗ trợ người dùng trên nền tảng học trực tuyến. Nhiệm vụ của bạn là:
                                - Trả lời các câu hỏi về khóa học, bài học, chức năng của hệ thống
                                - Hướng dẫn sử dụng các tính năng như nộp bài tập, ghi chú, thông báo
                                - Giúp đỡ về vấn đề kỹ thuật cơ bản
                                - Luôn lịch sự, thân thiện và hữu ích

                                `;

        // Add conversation history
        if (history.length > 0) {
            conversationContext += "\n\nLịch sử hội thoại:\n";
            history.forEach((msg: any) => {
                conversationContext += `${msg.role === "user" ? "Người dùng" : "Trợ lý"}: ${msg.content}\n`;
            });
        }

        conversationContext += `\n\nNgười dùng: ${message}\nTrợ lý:`;

        // Call Gemini API
        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: conversationContext
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API error:", errorData);
            return res.status(500).json({
                success: false,
                message: "Lỗi khi gọi Gemini API",
                error: errorData
            });
        }

        const data = await response.json();

        // Debug: Log response structure
        console.log("Gemini API response:", JSON.stringify(data, null, 2));

        // Extract response text
        const botResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, tôi không thể trả lời câu hỏi này.";

        res.json({
            success: true,
            message: botResponse
        });

    } catch (error) {
        console.error("Chatbot error:", error);
        res.status(500).json({
            success: false,
            message: "Đã xảy ra lỗi khi xử lý yêu cầu"
        });
    }
});

export default router;
