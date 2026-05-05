import { subscribeArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Notice = { line1: string; line2: string };

type StackEntry = Notice & { id: string; leaving: boolean };

const TOAST_H = 84;
const GAP = 10;
const STRIDE = TOAST_H + GAP;
const MAX_VISIBLE = 6;
const LEAVE_AT_MS = 1900;
const REMOVE_AT_MS = 2350;

function StackToastCard({
  line1,
  line2,
  bottomPx,
  leaving,
  zIndex,
}: {
  line1: string;
  line2: string;
  bottomPx: number;
  leaving: boolean;
  zIndex: number;
}) {
  const [enterSettled, setEnterSettled] = useState(false);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnterSettled(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const motionBase =
    "absolute left-0 flex h-[84px] w-full items-center justify-between gap-3 rounded-[12px] bg-white px-4 py-3 text-[16px] font-medium tracking-[-0.04em] text-[#111111] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.38)]";

  const stateClass = leaving
    ? "pointer-events-none animate-[archiveToastOut_420ms_ease_forwards]"
    : `ease-[cubic-bezier(0.22,1,0.36,1)] ${
        enterSettled
          ? "translate-y-0 opacity-100 transition-[bottom,transform,opacity] duration-[420ms]"
          : "translate-y-3 opacity-0"
      }`;

  return (
    <div style={{ bottom: bottomPx, zIndex }} className={`${motionBase} ${stateClass}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <img src="/notification.svg" alt="" className="h-[25px] w-[25px] shrink-0" />
        <span className="min-w-0 leading-[1.2]">
          <span className="block truncate">{line1}</span>
          <span className="block truncate">{line2}</span>
        </span>
      </div>
      <span className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white">
        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
      </span>
    </div>
  );
}

const toastKeyframesCss = `
  @keyframes archiveToastOut {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    100% {
      opacity: 0;
      transform: translateY(10px) scale(0.98);
    }
  }
`;

export function InAppArchiveToastHost() {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    return subscribeArchiveStyleToast((p: Notice) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setStack((prev) => [...prev, { id, line1: p.line1, line2: p.line2, leaving: false }].slice(-MAX_VISIBLE));

      const tLeave = window.setTimeout(() => {
        setStack((prev) => prev.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      }, LEAVE_AT_MS);
      const tRemove = window.setTimeout(() => {
        setStack((prev) => prev.filter((x) => x.id !== id));
      }, REMOVE_AT_MS);
      timeoutsRef.current.push(tLeave, tRemove);
    });
  }, []);

  const n = stack.length;
  const stackHeight = n > 0 ? n * STRIDE - GAP : TOAST_H;

  return (
    <>
      <style>{toastKeyframesCss}</style>
      {n > 0 && typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-none fixed bottom-4 right-4 z-[500] w-[560px]">
              <div className="relative w-full" style={{ height: stackHeight }}>
                {stack.map((entry, i) => {
                  const bottomPx = (n - 1 - i) * STRIDE;
                  const zIndex = 36 + i;
                  return (
                    <StackToastCard
                      key={entry.id}
                      line1={entry.line1}
                      line2={entry.line2}
                      bottomPx={bottomPx}
                      leaving={entry.leaving}
                      zIndex={zIndex}
                    />
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
