// ============================================================
// PANCAKE V2 + GOOGLE GEMINI AI - Auto Reply
// Bệnh viện thẩm mỹ — MIỄN PHÍ
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PANCAKE_API_KEY = process.env.PANCAKE_API_KEY;
const PAGE_ID = process.env.PAGE_ID;

const SYSTEM_PROMPT = `Bạn là tư vấn viên chuyên nghiệp của Bệnh viện Thẩm Mỹ Dr Trần Thái Hưng.
Nhiệm vụ của bạn là tư vấn, giải đáp thắc mắc và hỗ trợ khách hàng đặt lịch các dịch vụ thẩm mỹ.

DỊCH VỤ HIỆN CÓ:
- Nâng ngực: nâng ngực nội soi, túi ngực Mentor/Motiva/Bellagel
- Hút mỡ: hút mỡ tay, hút mỡ chân, hút mỡ bụng, hút mỡ lưng, hút mỡ đùi
- Treo sa trễ: treo ngực sa trễ, treo mặt, treo cơ vòng mắt

QUY TẮC TƯ VẤN:
- Xưng "em", gọi khách là "chị" (hoặc "anh" nếu khách là nam)
- Giọng điệu nhẹ nhàng, chuyên nghiệp, tạo sự tin tưởng
- KHÔNG báo giá cụ thể qua tin nhắn — mời khách đến khám miễn phí hoặc để lại SĐT
- Khi khách hỏi giá: mời khách đến khám miễn phí hoặc để lại SĐT để bác sĩ tư vấn trực tiếp
- Khi khách muốn đặt lịch: hỏi tên, SĐT, dịch vụ quan tâm và thời gian phù hợp
- Trả lời ngắn gọn, không quá 4-5 câu mỗi lần
- Luôn kết thúc bằng câu hỏi gợi mở`;

// Lưu tin nhắn đã xử lý để tránh reply trùng
const processedMessages = new Set();
// Lưu lịch sử hội thoại
const conversationHistory = {};

export default async function handler(req, res) {
  // Endpoint kiểm tra server còn sống
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', message: 'Pancake AI Bot đang chạy!' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Nhận webhook từ Pancake khi có tin nhắn mới
    const body = req.body;
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Lấy thông tin tin nhắn
    const event = body.event;
    const conversation = body.conversation || {};
    const message = body.message || {};

    // Chỉ xử lý tin nhắn mới từ khách
    if (event !== 'new_message') {
      return res.status(200).json({ status: 'ignored', reason: 'not new_message event' });
    }

    // Chỉ xử lý tin nhắn từ khách (from_customer = true)
    if (!message.from_customer) {
      return res.status(200).json({ status: 'ignored', reason: 'not from customer' });
    }

    const messageId = message.id;
    const conversationId = conversation.id || body.conversation_id;
    const messageText = message.message || message.text;

    if (!messageText || !conversationId) {
      return res.status(200).json({ status: 'ignored', reason: 'no message text' });
    }

    // Tránh xử lý tin nhắn trùng
    if (processedMessages.has(messageId)) {
      return res.status(200).json({ status: 'ignored', reason: 'already processed' });
    }
    processedMessages.add(messageId);

    // Giữ set không quá lớn
    if (processedMessages.size > 1000) {
      const firstItem = processedMessages.values().next().value;
      processedMessages.delete(firstItem);
    }

    console.log(`[${conversationId}] Khách: ${messageText}`);

    // Khởi tạo lịch sử hội thoại
    if (!conversationHistory[conversationId]) {
      conversationHistory[conversationId] = [];
    }

    conversationHistory[conversationId].push({
      role: 'user',
      parts: [{ text: messageText }]
    });

    if (conversationHistory[conversationId].length > 20) {
      conversationHistory[conversationId] = conversationHistory[conversationId].slice(-20);
    }

    // Gọi Gemini AI
    const aiReply = await callGemini(conversationHistory[conversationId]);

    conversationHistory[conversationId].push({
      role: 'model',
      parts: [{ text: aiReply }]
    });

    console.log(`[${conversationId}] AI: ${aiReply}`);

    // Gửi lại Pancake
    await sendToPancake(conversationId, aiReply);

    return res.status(200).json({ status: 'success', reply: aiReply });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

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

async function sendToPancake(conversationId, message) {
  const url = `https://pages.fm/api/v1/conversations/${conversationId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: PANCAKE_API_KEY,
      page_id: PAGE_ID,
      message: message
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Pancake API error: ${err}`);
  }

  return response.json();
}
