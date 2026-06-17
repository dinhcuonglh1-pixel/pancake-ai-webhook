# 🏥 Pancake V2 + Gemini AI — Bệnh viện Thẩm Mỹ
## Hướng dẫn deploy từng bước (MIỄN PHÍ - không cần biết code)

---

## BƯỚC 1: Lấy Gemini API Key (MIỄN PHÍ)

1. Vào: https://aistudio.google.com
2. Đăng nhập bằng tài khoản Google
3. Nhấn **Get API Key** → **Create API Key**
4. Copy key (dạng: AIzaSy...) → lưu lại

✅ Hoàn toàn miễn phí, không cần nhập thẻ tín dụng
✅ Giới hạn 1.500 request/ngày (đủ cho ~1.500 tin nhắn/ngày)

---

## BƯỚC 2: Lấy Pancake API Key

1. Đăng nhập Pancake V2
2. Vào **Cấu hình** (bánh răng góc trái)
3. Tìm mục **Webhook - API** (trong phần Nâng cao)
4. Copy **API Key** → lưu lại

---

## BƯỚC 3: Tạo tài khoản GitHub (miễn phí)

1. Vào: https://github.com → Sign up
2. Tạo repository mới:
   - Nhấn dấu **+** góc trên → **New repository**
   - Tên: `pancake-ai-webhook`
   - Chọn **Public**
   - Nhấn **Create repository**
3. Upload các file trong ZIP này lên:
   - Nhấn **Add file** → **Upload files**
   - Kéo thả toàn bộ file vào
   - Nhấn **Commit changes**

---

## BƯỚC 4: Deploy lên Vercel (miễn phí)

1. Vào: https://vercel.com → **Sign up with GitHub**
2. Nhấn **Add New Project**
3. Chọn repository `pancake-ai-webhook` → **Import**
4. Nhấn **Deploy** (chờ ~1 phút)

### Thêm biến môi trường:
5. Vào **Settings** → **Environment Variables**
6. Thêm 2 biến:

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | AIzaSy... (key Gemini của bạn) |
| `PANCAKE_API_KEY` | key Pancake của bạn |

7. Nhấn **Save** → vào tab **Deployments** → nhấn **Redeploy**

### Lấy Webhook URL:
8. Vào tab **Overview** → copy URL dạng:
   `https://pancake-ai-webhook-xxx.vercel.app/webhook`

---

## BƯỚC 5: Cài Webhook vào Pancake V2

1. Đăng nhập Pancake V2
2. Vào **Cấu hình → Webhook - API**
3. Dán URL vừa copy vào ô **Webhook URL**
4. Chọn sự kiện: **Tin nhắn mới từ khách**
5. Nhấn **Lưu**

---

## BƯỚC 6: Tuỳ chỉnh nội dung AI

Mở file `api/webhook.js`, tìm dòng `const SYSTEM_PROMPT` và sửa:
- Thay [TÊN BỆNH VIỆN] bằng tên thật
- Thêm đầy đủ dịch vụ
- Thêm quy trình đặt lịch, địa chỉ, hotline

---

## BƯỚC 7: Test thử

1. Nhắn tin thử vào Fanpage
2. Vào Vercel → **Logs** để xem AI phản hồi
3. Kiểm tra tin nhắn trên Pancake V2

---

## XỬ LÝ SỰ CỐ

**AI không trả lời:**
→ Kiểm tra Vercel Logs (tab Logs)
→ Kiểm tra lại 2 API Key đã điền đúng chưa
→ Kiểm tra URL webhook đã đúng chưa

**AI trả lời không đúng ý:**
→ Sửa SYSTEM_PROMPT trong file webhook.js
→ Mô tả rõ hơn dịch vụ và quy tắc trả lời

**Hết 1.500 request/ngày (Gemini free):**
→ Chờ reset lúc 0h hôm sau
→ Hoặc nâng lên gói trả phí của Gemini (~rất rẻ)
