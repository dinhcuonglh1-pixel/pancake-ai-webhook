// ============================================================
// PANCAKE V2 + GOOGLE GEMINI AI - Auto Reply Webhook
// Bệnh viện thẩm mỹ — MIỄN PHÍ
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PANCAKE_API_KEY = process.env.PANCAKE_API_KEY;

// ============================================================
// SYSTEM PROMPT - Chỉnh sửa thông tin bệnh viện tại đây
// ============================================================
const SYSTEM_PROMPT = `Bạn là tư vấn viên chuyên nghiệp của Bệnh viện Thẩm Mỹ [TÊN BỆNH VIỆN].
Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc và hỗ trợ khách hàng đặt lịch các dịch vụ thẩm mỹ.

DỊCH VỤ HIỆN CÓ:
- Nâng ngực: nâng ngực nội soi, túi ngực Mentor/Motiva/Bellagel
- Hút mỡ: hút mỡ tay, hút mỡ chân, hút mỡ bụng, hút mỡ lưng, hút mỡ đùi
- Treo sa trễ: treo ngực sa trễ, treo mặt, treo cơ vòng mắt
- [Bổ sung thêm dịch vụ khác nếu có]

QUY TẮC TƯ VẤN:
- Xưng "em", gọi khách là "chị" (hoặc "anh" nếu khách là nam)
- Giọng điệu nhẹ nhàng, chuyên nghiệp, tạo sự tin tưởng
- KHÔNG báo giá cụ thể qua tin nhắn — mời khách đến khám miễn phí hoặc để lại SĐT
- Khi khách hỏi giá: "Giá dịch vụ phụ thuộc vào tình trạng cụ thể của chị, để tư vấn chính xác em mời chị đến khám miễn phí hoặc để lại SĐT để bác sĩ tư vấn trực tiếp ạ"
- Khi khách muốn đặt lịch: hỏi tên, SĐT, dịch vụ quan tâm và thời gian phù hợp
- Nếu câu hỏi vượt ngoài phạm vi: "Để em chuyển thông tin đến bác sĩ tư vấn cho chị nhé ạ"
- Trả lời ngắn gọn, không quá 4-5 câu mỗi lần
- Luôn kết thúc bằng câu hỏi gợi mở để khách tiếp tục tương tác`;

// Lưu lịch sử hội thoại theo conversation_id
const conversationHistory = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const messages = body.messages || [];
    const conversationId = body.conversation_id || body.id;
    const pageId = body.page_id;

    // Chỉ xử lý tin nhắn từ khách
    const userMessage = messages.find(m => m.from_customer === true || m.type === 'incoming');

    if (!userMessage || !userMessage.message) {
      return res.status(200).json({ status: 'ignored' });
    }

    const messageText = userMessage.message;
    console.log(`[${conversationId}] Khách: ${messageText}`);

    // Khởi tạo lịch sử hội thoại
    if (!conversationHistory[conversationId]) {
      conversationHistory[conversationId] = [];
    }

    // Thêm tin nhắn khách vào lịch sử (format Gemini)
    conversationHistory[conversationId].push({
      role: 'user',
      parts: [{ text: messageText }]
    });

    // Giữ tối đa 20 lượt gần nhất
    if (conversationHistory[conversationId].length > 20) {
      conversationHistory[conversationId] = conversationHistory[conversationId].slice(-20);
    }

    // Gọi Gemini API
    const aiReply = await callGemini(conversationHistory[conversationId]);

    // Lưu phản hồi AI vào lịch sử
    conversationHistory[conversationId].push({
      role: 'model',
      parts: [{ text: aiReply }]
    });

    console.log(`[${conversationId}] AI: ${aiReply}`);

    // Gửi lại Pancake V2
    await sendToPancake(conversationId, pageId, aiReply);

    return res.status(200).json({ status: 'success', reply: aiReply });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ============================================================
// Gọi Gemini API (miễn phí)
// ============================================================
async function callGemini(history) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }]
      },
      contents: history,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ============================================================
// Gửi tin nhắn lại Pancake V2
// ============================================================
async function sendToPancake(conversationId, pageId, message) {
  const url = `https://pages.fm/api/v1/conversations/${conversationId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: PANCAKE_API_KEY,
      page_id: pageId,
      message: message
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pancake API error: ${err}`);
  }

  return response.json();
}
