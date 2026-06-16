import {
  AUTH_POST_LOADER_CRM_BEFORE_MARS_MS,
  AUTH_POST_LOADER_DURATION_MS,
} from "@/lib/ui/authPostLoaderConstants";
import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

type AuthStyleExitOverlayProps = {
  active: boolean;
  /** Вызывается после полного цикла прогресса (например выход + navigate). */
  onFinished: () => void | Promise<void>;
  /** Класс z-index поверх текущей страницы (по умолчанию как на профиле). */
  zClassName?: string;
};

/**
 * Полноэкранный лоадер как после входа: CRM → МАРС, затем `onFinished`.
 */
export function AuthStyleExitOverlay({ active, onFinished, zClassName = "z-[500]" }: AuthStyleExitOverlayProps) {
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const [progress, setProgress] = useState(0);
  const [showMarsCube, setShowMarsCube] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setShowMarsCube(false);
      setProgress(0);
      return;
    }
    setShowMarsCube(false);
    const showMarsTimer = window.setTimeout(() => {
      setShowMarsCube(true);
    }, AUTH_POST_LOADER_CRM_BEFORE_MARS_MS);
    return () => {
      clearTimeout(showMarsTimer);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    setProgress(0);
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / AUTH_POST_LOADER_DURATION_MS);
      const eased = easeOutCubic(t);
      setProgress(Math.min(100, Math.round(eased * 100)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        void Promise.resolve(onFinishedRef.current()).catch(() => {
          // ignore
        });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={`auth-loader-root fixed inset-0 ${zClassName} flex flex-col`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="auth-loader-topbar-track pointer-events-none absolute left-0 right-0 top-0 z-20 h-[3px] bg-white/22">
        <div
          className="h-full w-full origin-left bg-white will-change-transform"
          style={{
            transform: `scaleX(${Math.max(0, progress) / 100})`,
            transition: "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 [perspective:800px]">
        {!showMarsCube ? (
          <p className="auth-loader-crm text-center text-[clamp(52px,16vw,140px)] font-semibold uppercase leading-none text-white">
            CRM
          </p>
        ) : (
          <div className="auth-loader-cube-wrap">
            <div className="box-border flex h-[156px] w-[156px] items-center justify-center rounded-[18px] bg-[#EC1C24] p-6 text-[clamp(26px,7vw,40px)] font-semibold uppercase leading-none text-white shadow-[0_12px_40px_-8px_rgba(236,28,36,0.55)] sm:h-[184px] sm:w-[184px] sm:rounded-[20px] sm:p-7 sm:text-[clamp(30px,6vw,44px)]">
              МАРС
            </div>
          </div>
        )}
      </div>
      <div className="auth-loader-percent pointer-events-none absolute bottom-6 right-5 sm:bottom-10 sm:right-8">
        <span className="text-[clamp(52px,14vw,118px)] font-semibold tabular-nums leading-none text-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
          {progress}%
        </span>
      </div>
    </div>
  );
}
