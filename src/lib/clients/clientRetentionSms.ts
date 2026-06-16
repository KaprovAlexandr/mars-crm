import { getApiBaseUrl } from "@/lib/data/provider";

export function buildClientRetentionSmsText(fullName: string): string {
  const name = fullName.trim() || "Уважаемый клиент";
  return `${name}, здравствуйте! 👋 Давно не виделись. Как поживает ваш автомобиль? Если пришло время для обслуживания или ремонта, будем рады снова помочь!`;
}

function toSmsHref(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;
  if (digits.startsWith("8") && digits.length >= 11) normalized = `7${digits.slice(1)}`;
  else if (digits.length === 10) normalized = `7${digits}`;
  return `sms:+${normalized}?body=${encodeURIComponent(body)}`;
}

function openNativeSmsComposer(phone: string, body: string): void {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = toSmsHref(phone, body);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

type SendRetentionSmsResult = {
  ok: boolean;
  mode?: "live" | "client-sms" | "demo";
  text?: string;
  error?: string;
  details?: string;
};

export async function sendClientRetentionSms(params: {
  phone: string;
  fullName: string;
}): Promise<"live" | "client-sms"> {
  const text = buildClientRetentionSmsText(params.fullName);
  const response = await fetch(`${getApiBaseUrl()}/api/clients/send-retention-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: params.phone,
      fullName: params.fullName,
    }),
  });

  let data: SendRetentionSmsResult = { ok: false };
  try {
    data = (await response.json()) as SendRetentionSmsResult;
  } catch {
    // ignore invalid JSON (e.g. HTML 404 page)
  }

  if (!response.ok) {
    const message = data.details || data.error;
    if (message) throw new Error(message);
    if (response.status === 404) {
      throw new Error("Сервис SMS недоступен. Перезапустите API: npm run dev:api");
    }
    throw new Error("Не удалось отправить SMS.");
  }

  if (data.mode === "client-sms") {
    openNativeSmsComposer(params.phone, data.text ?? text);
    return "client-sms";
  }

  return "live";
}
