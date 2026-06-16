import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import {
  isFirebaseConfigured,
  isGoogleAccountLinkRequiredError,
  loginWithEmailPassword,
  loginWithGoogle,
  mapFirebaseAuthError,
  registerWithEmailPassword,
  sendPasswordResetForEmail,
} from "@/lib/auth/firebaseAuth";
import { resolvePostAuthLandingPath, getEmployeeFullName } from "@/lib/auth/employeeRole";
import { isEmployeeBlocked } from "@/lib/auth/employeeBlockPersistence";
import { ensureFirebasePasswordAccess } from "@/lib/auth/ensureFirebasePasswordAccess";
import { loadPersistedFullName, persistUserFullName, syncUserDisplayName } from "@/lib/auth/userFullName";
import { syncPendingEmployeeFromAuth } from "@/lib/settings/pendingEmployeesPersistence";
import { syncPendingAccessToApi } from "@/lib/settings/pendingEmployeesApi";
import {
  clearRegisterDraft,
  readRegisterDraft,
  writeRegisterDraft,
} from "@/lib/auth/authRegisterDraft";
import {
  AUTH_POST_LOADER_CRM_BEFORE_MARS_MS,
  AUTH_POST_LOADER_DURATION_MS,
} from "@/lib/ui/authPostLoaderConstants";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const EMPTY_REGISTER: RegisterForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function initialRegisterForm(): RegisterForm {
  const draft = readRegisterDraft();
  if (!draft) return EMPTY_REGISTER;
  return {
    name: draft.name,
    email: draft.email,
    password: draft.password,
    confirmPassword: draft.confirmPassword,
  };
}

function initialPolicyAccepted(): boolean {
  return readRegisterDraft()?.policyAccepted ?? false;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Как на странице «Заявки»: одинаковый box-model в обоих состояниях (без сдвига верстки). */
function ClientsStyleCheckboxBox({ checked, dark }: { checked: boolean; dark: boolean }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 box-border items-center justify-center rounded-[3px] border-[2px] ${
        checked
          ? "border-transparent bg-[#d51a21] text-white"
          : dark
            ? "border-[#6B758A] bg-transparent"
            : "border-[#D8DBDE] bg-transparent"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

export function AuthLandingPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isRegister = pathname.startsWith("/register");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterForm>(initialRegisterForm);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [postAuthLoading, setPostAuthLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [policyAccepted, setPolicyAccepted] = useState(initialPolicyAccepted);
  const [rememberMe, setRememberMe] = useState(false);
  const [googleLinkEmail, setGoogleLinkEmail] = useState<string | null>(null);
  const [googleLinkPassword, setGoogleLinkPassword] = useState("");
  const [googleLinkSending, setGoogleLinkSending] = useState(false);
  const [loaderShowMarsCube, setLoaderShowMarsCube] = useState(false);
  const loaderRafRef = useRef<number | null>(null);
  const postAuthTargetRef = useRef("/");

  const fieldClass =
    "h-11 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] sm:h-12 sm:text-[18px]";

  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);

  useEffect(() => {
    setAuthError("");
    setAuthNotice("");
    if (isRegister) {
      const draft = readRegisterDraft();
      if (draft) {
        setRegisterForm({
          name: draft.name,
          email: draft.email,
          password: draft.password,
          confirmPassword: draft.confirmPassword,
        });
        setPolicyAccepted(draft.policyAccepted);
      }
    } else {
      setRememberMe(false);
    }
  }, [isRegister]);

  useEffect(() => {
    if (!isRegister) return;
    writeRegisterDraft({
      ...registerForm,
      policyAccepted,
    });
  }, [isRegister, registerForm, policyAccepted]);

  useEffect(() => {
    if (!postAuthLoading) {
      setLoaderShowMarsCube(false);
      return;
    }
    setLoaderShowMarsCube(false);
    const showMarsTimer = window.setTimeout(() => {
      setLoaderShowMarsCube(true);
    }, AUTH_POST_LOADER_CRM_BEFORE_MARS_MS);
    return () => {
      clearTimeout(showMarsTimer);
    };
  }, [postAuthLoading]);

  useEffect(() => {
    if (!postAuthLoading) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / AUTH_POST_LOADER_DURATION_MS);
      const eased = easeOutCubic(t);
      const pct = Math.min(100, Math.round(eased * 100));
      setLoadProgress(pct);
      if (t < 1) {
        loaderRafRef.current = requestAnimationFrame(tick);
      } else {
        loaderRafRef.current = null;
        navigate(postAuthTargetRef.current, { replace: true });
      }
    }
    loaderRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (loaderRafRef.current != null) {
        cancelAnimationFrame(loaderRafRef.current);
        loaderRafRef.current = null;
      }
    };
  }, [postAuthLoading, navigate]);

  function beginPostAuthTransition(nextPath: string) {
    postAuthTargetRef.current = nextPath;
    setAuthError("");
    setLoadProgress(0);
    setPostAuthLoading(true);
  }

  async function finishSuccessfulAuth(user: User, fallbackFullName?: string) {
    const email = user.email;
    const fullName =
      fallbackFullName?.trim() ||
      (await loadPersistedFullName(user)) ||
      getEmployeeFullName(email) ||
      user.displayName?.trim() ||
      email ||
      "Пользователь";
    syncPendingEmployeeFromAuth(email, fullName);
    try {
      const idToken = await user.getIdToken();
      await syncPendingAccessToApi({ idToken, fullName });
    } catch {
      // API optional
    }
    beginPostAuthTransition(resolvePostAuthLandingPath(email, isEmployeeBlocked(email)));
  }

  async function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    const email = normalizeEmail(loginEmail);
    const password = loginPassword;

    if (!isValidEmail(email)) {
      setAuthError("Введите корректный e-mail.");
      return;
    }
    if (!password) {
      setAuthError("Введите пароль.");
      return;
    }
    try {
      const user = await loginWithEmailPassword({ email, password });
      setLoginPassword("");
      await finishSuccessfulAuth(user);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  }

  async function handleRegisterSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError("");
    if (!policyAccepted) {
      setAuthError("Отметьте согласие с политикой конфиденциальности.");
      return;
    }
    const name = registerForm.name.trim();
    const email = normalizeEmail(registerForm.email);
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!name) {
      setAuthError("Введите ФИО.");
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError("Введите корректный e-mail.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Пароль должен содержать минимум 6 символов.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Пароли не совпадают.");
      return;
    }
    try {
      const user = await registerWithEmailPassword({ name, email, password });
      clearRegisterDraft();
      setRegisterForm(EMPTY_REGISTER);
      setPolicyAccepted(false);
      await finishSuccessfulAuth(user, name);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    }
  }

  async function handleForgotPassword() {
    setAuthError("");
    setAuthNotice("");
    const email = normalizeEmail(loginEmail);

    if (!isValidEmail(email)) {
      setAuthError("Введите e-mail, указанный при регистрации.");
      return;
    }
    if (!firebaseReady || resetSending) return;

    setResetSending(true);
    try {
      await sendPasswordResetForEmail(email);
      setAuthNotice(`Ссылка для восстановления пароля отправлена на ${email}. Проверьте почту.`);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setResetSending(false);
    }
  }

  async function handleGoogleAuth(linkPassword?: string) {
    setAuthError("");
    setAuthNotice("");
    try {
      const user = await loginWithGoogle(linkPassword ? { linkPassword } : undefined);
      if (isRegister && registerForm.name.trim()) {
        await persistUserFullName(user, registerForm.name.trim());
      }
      await ensureFirebasePasswordAccess(user);
      setGoogleLinkEmail(null);
      setGoogleLinkPassword("");
      const fullName = await syncUserDisplayName(user);
      await finishSuccessfulAuth(user, fullName);
    } catch (error) {
      if (isGoogleAccountLinkRequiredError(error)) {
        setGoogleLinkEmail(error.email);
        setGoogleLinkPassword("");
        setAuthError("Введите пароль от e-mail аккаунта, чтобы связать его с Google.");
        return;
      }
      const message = mapFirebaseAuthError(error);
      if (message) setAuthError(message);
    }
  }

  async function handleGoogleLinkSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!googleLinkEmail || !googleLinkPassword.trim()) {
      setAuthError("Введите пароль от e-mail аккаунта.");
      return;
    }
    setGoogleLinkSending(true);
    setAuthError("");
    try {
      const user = await loginWithGoogle({ linkPassword: googleLinkPassword });
      await ensureFirebasePasswordAccess(user);
      setGoogleLinkEmail(null);
      setGoogleLinkPassword("");
      const fullName = await syncUserDisplayName(user);
      await finishSuccessfulAuth(user, fullName);
    } catch (error) {
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setGoogleLinkSending(false);
    }
  }

  return (
    <div className="box-border flex h-dvh min-h-dvh flex-col overflow-y-auto bg-black p-2 tracking-[-0.04em]">
      <div className="grid min-h-0 w-full flex-1 gap-2 max-lg:grid-rows-[minmax(160px,1fr)_auto] lg:grid-cols-[1.25fr_1fr] lg:grid-rows-1">
        <section className="relative min-h-0 h-full overflow-hidden rounded-[16px]">
          <img src="/auth-hero.png" alt="Мастер за диагностикой автомобиля" className="h-full min-h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <h1 className="absolute left-6 top-6 right-6 flex max-w-[560px] flex-col gap-1 text-[clamp(24px,4.5vw,56px)] font-semibold leading-[1.08] text-white sm:left-8 sm:top-8 sm:right-auto">
            <span className="block whitespace-nowrap">Ускорьте свою работу</span>
            <span className="block whitespace-nowrap">с нашим веб-приложением!</span>
          </h1>
        </section>

        <section className="flex flex-col items-center justify-center overflow-y-auto rounded-[16px] bg-white px-4 py-6 max-lg:justify-start sm:px-6 sm:py-8 md:px-10 lg:min-h-0 lg:h-full">
          <div className="w-full max-w-[430px]">
            <div className="mb-6 text-center sm:mb-7">
              <div
                className="mx-auto mb-4 grid h-[72px] w-[84px] place-items-center rounded-[16px] bg-[#EC1C24] text-[17px] font-semibold tracking-[-0.04em] text-white sm:mb-5 sm:h-[90px] sm:w-[100px] sm:text-[18px]"
                aria-label="Марс"
              >
                Марс
              </div>
              <h2 className="text-[34px] font-semibold leading-[1.2] text-[#111111] sm:text-[42px]">
                {isRegister ? "Создайте аккаунт" : "Добро пожаловать в Марс!"}
              </h2>
              {!firebaseReady ? (
                <p className="mt-3 text-[13px] text-[#D45A5A]">
                  Firebase не настроен. Добавьте переменные <code className="text-[12px]">VITE_FIREBASE_*</code> в{" "}
                  <code className="text-[12px]">.env</code>.
                </p>
              ) : null}
            </div>

            {isRegister ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                <input
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ФИО"
                  autoComplete="name"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />
                <input
                  required
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="E-mail"
                  autoComplete="email"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />
                <input
                  required
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Пароль (не менее 6 символов)"
                  autoComplete="new-password"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />
                <input
                  required
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />

                {authError ? <p className="text-[13px] text-[#C62828]">{authError}</p> : null}

                <button
                  type="submit"
                  disabled={!firebaseReady || !policyAccepted}
                  className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#EC1C24] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
                >
                  Зарегистрироваться
                </button>

                <div className="flex w-full justify-center px-1">
                  <label className="flex min-h-[44px] w-full max-w-[420px] cursor-pointer select-none items-center gap-2 text-[12px] font-medium leading-snug tracking-[-0.04em] text-[#8A8A8A]">
                    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={policyAccepted}
                        onChange={(e) => setPolicyAccepted(e.target.checked)}
                        className="absolute inset-0 z-[1] m-0 h-4 w-4 cursor-pointer opacity-0"
                        aria-label="Согласие с политикой конфиденциальности"
                      />
                      <span className="pointer-events-none" aria-hidden>
                        <ClientsStyleCheckboxBox checked={policyAccepted} dark={false} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      Нажимая на кнопку, я соглашаюсь с{" "}
                      <button
                        type="button"
                        className="cursor-pointer font-semibold text-[#5652CE] hover:underline"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          navigate("/privacy");
                        }}
                      >
                        политикой конфиденциальности
                      </button>
                    </span>
                  </label>
                </div>

                <div className="relative py-1.5 text-center text-[12px] text-[#B7B7B7]">
                  <span className="bg-white px-2">или</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-[#EFEFEF]" />
                </div>

                <button
                  type="button"
                  disabled={!firebaseReady}
                  onClick={() => void handleGoogleAuth()}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#EAEAEA] bg-white text-[14px] font-medium text-[#3D3D3D] disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
                >
                  <span className="text-[16px]">G</span>
                  Продолжить через Google
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-2.5">
                <input
                  required
                  type="email"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    setAuthNotice("");
                  }}
                  placeholder="E-mail"
                  autoComplete="email"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />
                <input
                  required
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Пароль"
                  autoComplete="current-password"
                  disabled={!firebaseReady}
                  className={fieldClass}
                />

                <div className="flex items-center justify-between px-1 pt-1">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-[12px] font-medium leading-snug tracking-[-0.04em] text-[#8A8A8A]">
                    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="absolute inset-0 z-[1] m-0 h-4 w-4 cursor-pointer opacity-0"
                        aria-label="Запомнить меня"
                      />
                      <span className="pointer-events-none" aria-hidden>
                        <ClientsStyleCheckboxBox checked={rememberMe} dark={false} />
                      </span>
                    </span>
                    Запомнить меня
                  </label>
                  <button
                    type="button"
                    disabled={!firebaseReady || resetSending}
                    onClick={() => void handleForgotPassword()}
                    className="shrink-0 cursor-pointer text-[13px] font-semibold text-[#5652CE] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resetSending ? "Отправка…" : "Забыли пароль?"}
                  </button>
                </div>

                {authNotice ? <p className="text-[13px] text-[#1B7F3A]">{authNotice}</p> : null}
                {authError ? <p className="text-[13px] text-[#C62828]">{authError}</p> : null}

                <button
                  type="submit"
                  disabled={!firebaseReady}
                  className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#EC1C24] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
                >
                  Войти
                </button>

                <div className="relative py-1.5 text-center text-[12px] text-[#B7B7B7]">
                  <span className="bg-white px-2">или</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-[#EFEFEF]" />
                </div>

                <button
                  type="button"
                  disabled={!firebaseReady}
                  onClick={() => void handleGoogleAuth()}
                  className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-[#EAEAEA] bg-white text-[14px] font-medium text-[#3D3D3D] disabled:cursor-not-allowed disabled:opacity-50 sm:h-12"
                >
                  <span className="text-[16px]">G</span>
                  Войти через Google
                </button>
              </form>
            )}

            {googleLinkEmail ? (
              <form onSubmit={handleGoogleLinkSubmit} className="mt-4 space-y-2.5 rounded-[12px] border border-[#EAEAEA] bg-[#FAFAFA] p-4">
                <p className="text-[13px] font-medium leading-snug text-[#3D3D3D]">
                  Аккаунт <span className="font-semibold text-[#111111]">{googleLinkEmail}</span> уже зарегистрирован по e-mail.
                  Введите пароль, чтобы связать Google с этим аккаунтом.
                </p>
                <input
                  required
                  type="password"
                  value={googleLinkPassword}
                  onChange={(e) => setGoogleLinkPassword(e.target.value)}
                  placeholder="Пароль от e-mail аккаунта"
                  autoComplete="current-password"
                  disabled={!firebaseReady || googleLinkSending}
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!firebaseReady || googleLinkSending}
                    className="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] bg-[#EC1C24] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {googleLinkSending ? "Связываем…" : "Связать и войти"}
                  </button>
                  <button
                    type="button"
                    disabled={googleLinkSending}
                    onClick={() => {
                      setGoogleLinkEmail(null);
                      setGoogleLinkPassword("");
                      setAuthError("");
                    }}
                    className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white px-4 text-[14px] font-medium text-[#3D3D3D] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            ) : null}

            {isRegister ? (
              <p className="mt-4 text-center text-[13px] text-[#8A8A8A]">
                У вас уже есть учётная запись?{" "}
                <button type="button" onClick={() => navigate("/auth")} className="cursor-pointer font-semibold text-[#5652CE]">
                  Войдите
                </button>
              </p>
            ) : (
              <p className="mt-4 text-center text-[13px] text-[#8A8A8A]">
                У вас нет учётной записи?{" "}
                <button type="button" onClick={() => navigate("/register")} className="cursor-pointer font-semibold text-[#5652CE]">
                  Зарегистрируйтесь
                </button>
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-[12px] text-[#C1C1C1] sm:mt-14 sm:justify-between">
              <span className="w-full text-center sm:w-auto sm:text-left">© 2026 Капров А. Н.</span>
              <div className="flex w-full flex-wrap items-center justify-center gap-4 sm:w-auto sm:justify-start sm:gap-5">
                <button
                  type="button"
                  onClick={() => navigate("/privacy")}
                  className="cursor-pointer hover:text-[#8A8A8A]"
                >
                  Политика конфиденциальности
                </button>
                <span>Служба поддержки</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {postAuthLoading ? (
        <div
          className="auth-loader-root fixed inset-0 z-[300] flex flex-col"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-valuenow={loadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Верхняя белая полоса прогресса */}
          <div className="auth-loader-topbar-track pointer-events-none absolute left-0 right-0 top-0 z-20 h-[3px] bg-white/22">
            <div
              className="h-full w-full origin-left bg-white will-change-transform"
              style={{
                transform: `scaleX(${Math.max(0, loadProgress) / 100})`,
                transition: "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>

          {/* Центр: сначала CRM, затем красный квадрат МАРС */}
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 [perspective:800px]">
            {!loaderShowMarsCube ? (
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

          {/* Проценты — правый нижний угол */}
          <div className="auth-loader-percent pointer-events-none absolute bottom-6 right-5 sm:bottom-10 sm:right-8">
            <span className="text-[clamp(52px,14vw,118px)] font-semibold tabular-nums leading-none text-white transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
              {loadProgress}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
