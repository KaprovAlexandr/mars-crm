function normalizeRuPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return digits;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

export function buildClientRetentionSmsText(fullName) {
  const name = String(fullName ?? "").trim() || "Уважаемый клиент";
  return `${name}, здравствуйте! 👋 Давно не виделись. Как поживает ваш автомобиль? Если пришло время для обслуживания или ремонта, будем рады снова помочь!`;
}

function readSmsRuEntry(data, phone) {
  const bucket = data?.sms;
  if (!bucket || typeof bucket !== "object") return null;
  return bucket[phone] ?? bucket[String(phone)] ?? Object.values(bucket)[0] ?? null;
}

async function sendViaSmsRu(phone, text) {
  const apiId = (process.env.SMS_RU_API_ID ?? "").trim();
  if (!apiId) return null;

  const params = new URLSearchParams({
    api_id: apiId,
    to: phone,
    msg: text,
    json: "1",
  });

  const response = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`SMS.ru HTTP ${response.status}`);
  }

  const data = await response.json();
  const topStatus = data?.status ?? data?.status_code;
  if (topStatus !== "OK" && topStatus !== 100) {
    throw new Error(typeof data?.status_text === "string" ? data.status_text : "SMS.ru отклонил запрос");
  }

  const entry = readSmsRuEntry(data, phone);
  if (entry?.status === "ERROR") {
    const error = new Error(
      typeof entry.status_text === "string" ? entry.status_text : "SMS.ru не отправил сообщение",
    );
    error.code = entry.status_code;
    throw error;
  }

  return { provider: "sms.ru", phone, messageId: entry?.sms_id ?? null };
}

export async function sendClientRetentionSms(phone, fullName) {
  const normalizedPhone = normalizeRuPhone(phone);
  if (normalizedPhone.length < 11) {
    throw new Error("Некорректный номер телефона.");
  }

  const text = buildClientRetentionSmsText(fullName);

  try {
    const smsRuResult = await sendViaSmsRu(normalizedPhone, text);
    if (smsRuResult) {
      console.log(`[sms] sent via SMS.ru to ${normalizedPhone}`);
      return { ...smsRuResult, text, mode: "live" };
    }
  } catch (error) {
    console.warn("[sms] SMS.ru failed, fallback to client SMS composer:", error?.message ?? error);
    return {
      provider: "client-sms",
      phone: normalizedPhone,
      text,
      mode: "client-sms",
      warning: String(error?.message ?? error),
    };
  }

  console.log(`[sms:demo] to=${normalizedPhone} text=${text}`);
  return { provider: "client-sms", phone: normalizedPhone, text, mode: "client-sms" };
}
