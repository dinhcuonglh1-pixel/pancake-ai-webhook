const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'myverifytoken123';

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

const conversationHistory = {};
const processedMessages = new Set();

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    if (body.object !== 'page') {
      return res.status(200).json({ status: 'ignored' });
    }

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event.message || !event.message.text) continue;
        if (event.message.is_echo) continue;

        const senderId = event.sender.id;
        const messageId = event.message.mid;
        const messageText = event.message.text;

        if (processedMessages.has(messageId)) continue;
        processedMessages.add(messageId);
        if (processedMessages.size > 1000) {
          const first = processedMessages.values().next().value;
          processedMessages.delete(first);
        }

        console.log(`Khách [${senderId}]: ${messageText}`);

        if (!conversationHistory[senderId]) {
          conversationHistory[senderId] = [];
        }

        conversationHistory[senderId].push({
          role: 'user',
          content: messageText
        });

        if (conversationHistory[senderId].length > 20) {
          conversationHistory[senderId] = conversationHistory[senderId].slice(-20);
        }

        const aiReply = await callGroq(conversationHistory[senderId]);

        conversationHistory[senderId].push({
          role: 'assistant',
          content: aiReply
        });

        console.log(`AI [${senderId}]: ${aiReply}`);
        await sendToMessenger(senderId, aiReply);
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function callGroq(history) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history
      ],
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

async function sendToMessenger(recipientId, message) {
  const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message }
    })
  });

  if (!response.ok) throw new Error(`Messenger error: ${await response.text()}`);
  return response.json();
}
