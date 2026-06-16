import { AuthStyleExitOverlay } from "@/components/ui/AuthStyleExitOverlay";
import { logoutCurrentUser } from "@/lib/auth/firebaseAuth";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

type AccessRestrictedPageProps = {
  titleLines: [string, string];
  description: string;
};

export function AccessRestrictedPage({ titleLines, description }: AccessRestrictedPageProps) {
  const navigate = useNavigate();
  const [exitActive, setExitActive] = useState(false);

  const finishExitToPromo = useCallback(async () => {
    navigate("/promo", { replace: true });
    try {
      await logoutCurrentUser();
    } catch {
      // ignore
    }
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 py-10 tracking-[-0.04em]">
      <div className="flex w-full max-w-[min(100%,960px)] flex-col items-center text-center">
        <div className="mb-10 shrink-0 rounded-[11px] bg-black p-2">
          <div
            className="flex h-[90px] w-[90px] items-center justify-center rounded-[16px] bg-[#EC1C24] p-4 text-[18px] font-semibold tracking-[-0.04em] text-white"
            aria-label="Марс"
          >
            Марс
          </div>
        </div>

        <div className="flex w-full max-w-[min(100%,920px)] flex-col items-center justify-center px-2">
          <h1 className="flex flex-col items-center text-center font-['Inter',sans-serif] text-[clamp(16px,6.5vw,100px)] font-semibold leading-[1.08] tracking-[-4%] text-white">
            <span className="whitespace-nowrap">{titleLines[0]}</span>
            <span className="mt-2 whitespace-nowrap sm:mt-3">{titleLines[1]}</span>
          </h1>
        </div>

        <p className="mt-8 max-w-md text-center text-[15px] font-medium leading-snug text-white/55">{description}</p>
        <button
          type="button"
          onClick={() => {
            if (!exitActive) setExitActive(true);
          }}
          disabled={exitActive}
          className="mt-10 rounded-[12px] border border-white/20 bg-white/10 px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-wait disabled:opacity-60"
        >
          Выйти из аккаунта
        </button>
      </div>

      <AuthStyleExitOverlay active={exitActive} onFinished={finishExitToPromo} />
    </div>
  );
}
