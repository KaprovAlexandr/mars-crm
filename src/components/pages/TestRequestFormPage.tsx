import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { appendNewRequestFromSiteToFeed } from "@/lib/notifications/inAppNotificationFeed";
import { REQUEST_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import {
  insertRequestStorageRow,
  isRequestsRemoteEnabled,
  listRequestsStorageRows,
  type RequestsStorageRow,
} from "@/lib/data/requestsDataSource";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function maskRuPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  const body = normalized.slice(1, 11);
  const p1 = body.slice(0, 3);
  const p2 = body.slice(3, 6);
  const p3 = body.slice(6, 8);
  const p4 = body.slice(8, 10);
  if (body.length <= 3) return `+7${p1 ? ` (${p1}` : ""}`;
  if (body.length <= 6) return `+7 (${p1}) ${p2}`;
  if (body.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

export function TestRequestFormPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function formatRuDateToday(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}.${mm}.${yy}`;
  }

  function generateNextRequestId(rows: RequestsStorageRow[]): string {
    const numericIds = rows
      .map((row) => Number(row.id))
      .filter((value) => Number.isFinite(value) && value > 0);
    const next = (numericIds.length > 0 ? Math.max(...numericIds) : 100000) + 1;
    return String(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    const normalizedClient = fullName.trim();
    const normalizedPhone = phone.trim();
    const normalizedComment = comment.trim();
    if (!normalizedClient || !normalizedPhone || !normalizedComment) return;

    setIsSubmitting(true);
    try {
      const rows = await listRequestsStorageRows();
      const id = generateNextRequestId(rows);
      const nowIso = new Date().toISOString();
      const payload: RequestsStorageRow = {
        id,
        status: "Новая",
        client: normalizedClient,
        phone: normalizedPhone,
        manager: null,
        manager_photo: null,
        source: "Сайт",
        created_at: nowIso,
        last_activity_at: nowIso,
        archived: false,
        comment: normalizedComment,
      };
      const created = await insertRequestStorageRow(payload);
      const requestId = created.id ?? id;

      appendNewRequestFromSiteToFeed({
        requestId,
        client: created.client ?? normalizedClient,
        phone: created.phone ?? normalizedPhone,
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(REQUEST_LIST_FLASH_ARMED_KEY, requestId);
      }
      emitArchiveStyleToast({
        line1: `Новая заявка с сайта № ${requestId} (${created.client ?? normalizedClient})`,
        line2: `${created.phone ?? normalizedPhone} · поступила с сайта`,
        navigateTo: `/?request=${encodeURIComponent(requestId)}`,
      });

      setFullName("");
      setPhone("");
      setComment("");
      navigate(`/?request=${encodeURIComponent(requestId)}`);
    } catch (error) {
      console.warn("Failed to create site request from test page.", error);
      emitArchiveStyleToast({
        line1: "Ошибка синхронизации",
        line2: isRequestsRemoteEnabled()
          ? "Не удалось создать заявку в базе"
          : "Remote provider не включен для заявок",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F5F7] p-6">
      <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.18)]">
        <div className="border-b border-[#EEEDF0] p-5">
          <h1 className="text-[22px] font-semibold tracking-[-0.04em] text-[#111826]">Тестовая форма заявки</h1>
        </div>
        <form className="grid gap-3 p-5" onSubmit={handleSubmit}>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
            placeholder="ФИО"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(maskRuPhoneInput(e.target.value))}
            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
            placeholder="Телефон"
            required
          />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[120px] w-full resize-none rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 py-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
            placeholder="Комментарий"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full cursor-pointer rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] px-4 text-center text-[18px] font-medium tracking-[-0.04em] text-white disabled:cursor-default disabled:opacity-70"
          >
            {isSubmitting ? "Отправка..." : "Отправить"}
          </button>
        </form>
      </div>
    </main>
  );
}
