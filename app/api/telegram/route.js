// API Route ฝั่งเซิร์ฟเวอร์: ทำหน้าที่ส่งข้อความไป Telegram แทน client
// เก็บ Token ไว้ที่นี่เท่านั้น ไม่ใช้ prefix NEXT_PUBLIC_ เพื่อไม่ให้หลุดไปฝั่งเบราว์เซอร์
export async function POST(request) {
  try {
    const { text } = await request.json();

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return Response.json(
        { ok: false, error: "Telegram env vars not configured" },
        { status: 500 }
      );
    }

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await telegramRes.json();

    if (!telegramRes.ok) {
      return Response.json({ ok: false, error: data }, { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
