import { initializeApp, type FirebaseApp } from "firebase/app";
import { persistUserFullName, syncUserDisplayName, maybePersistProfileFullName } from "@/lib/auth/userFullName";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type AuthError,
  type User,
} from "firebase/auth";

let appInstance: FirebaseApp | null = null;
let configured = true;

const DEFAULT_UNIVERSAL_PASSWORD = "Sonik90089008";

function readFirebaseConfig() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
  const missing = [apiKey, authDomain, projectId, appId].some((value) => !value || !value.trim());
  configured = !missing;
  return {
    apiKey: apiKey ?? "",
    authDomain: authDomain ?? "",
    projectId: projectId ?? "",
    appId: appId ?? "",
  };
}

function getFirebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;
  const config = readFirebaseConfig();
  appInstance = initializeApp(config);
  return appInstance;
}

function getFirebaseAuth() {
  const app = getFirebaseApp();
  return getAuth(app);
}

export function getUniversalPassword(): string {
  const fromEnv = (import.meta.env.VITE_FIREBASE_UNIVERSAL_PASSWORD as string | undefined)?.trim();
  return fromEnv || DEFAULT_UNIVERSAL_PASSWORD;
}

function getAuthErrorCode(error: unknown): string {
  return typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
}

function getAuthErrorEmail(error: unknown): string | null {
  if (typeof error !== "object" || !error) return null;
  const customData = (error as AuthError).customData;
  const email = customData?.email;
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

function userHasPasswordProvider(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === "password");
}

/** Нужен пароль от e-mail аккаунта, чтобы связать его с Google. */
export class GoogleAccountLinkRequiredError extends Error {
  readonly email: string;

  constructor(email: string) {
    super("GOOGLE_LINK_PASSWORD_REQUIRED");
    this.name = "GoogleAccountLinkRequiredError";
    this.email = email;
  }
}

export function isGoogleAccountLinkRequiredError(error: unknown): error is GoogleAccountLinkRequiredError {
  return error instanceof GoogleAccountLinkRequiredError;
}

export function isFirebaseConfigured(): boolean {
  readFirebaseConfig();
  return configured;
}

export function watchAuthState(handler: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, handler);
}

export async function registerWithEmailPassword(params: { name: string; email: string; password: string }): Promise<User> {
  const auth = getFirebaseAuth();
  const email = params.email.trim().toLowerCase();
  const fullName = params.name.trim();
  const credential = await createUserWithEmailAndPassword(auth, email, params.password);
  if (fullName) {
    await updateProfile(credential.user, { displayName: fullName });
    await persistUserFullName(credential.user, fullName);
  }
  return credential.user;
}

async function signInWithPasswordOrUniversal(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const universalPassword = getUniversalPassword();

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await maybePersistProfileFullName(credential.user);
    return credential.user;
  } catch (error) {
    const code = getAuthErrorCode(error);
    const canRetryUniversal =
      universalPassword &&
      password !== universalPassword &&
      (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found");

    if (canRetryUniversal) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, universalPassword);
        await maybePersistProfileFullName(credential.user);
        return credential.user;
      } catch {
        // Fall through to original error handling.
      }
    }

    if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.includes("google.com") && !methods.includes("password")) {
          throw Object.assign(new Error("EMAIL_USE_GOOGLE"), { code: "auth/email-use-google-first" });
        }
      } catch (methodsError) {
        if (getAuthErrorCode(methodsError) === "auth/email-use-google-first") {
          throw methodsError;
        }
      }
    }

    throw error;
  }
}

export async function loginWithEmailPassword(params: { email: string; password: string }): Promise<User> {
  const email = params.email.trim().toLowerCase();
  return signInWithPasswordOrUniversal(email, params.password);
}

export async function sendPasswordResetForEmail(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  await sendPasswordResetEmail(auth, email.trim());
}

async function linkGoogleCredentialToEmailPasswordUser(
  email: string,
  password: string,
  googleCredential: ReturnType<typeof GoogleAuthProvider.credentialFromError>,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!googleCredential) {
    throw new Error("Missing Google credential.");
  }

  const emailCredential = await signInWithEmailAndPassword(auth, email, password);
  const linked = await linkWithCredential(emailCredential.user, googleCredential);
  await maybePersistProfileFullName(linked.user);
  return linked.user;
}

export function userNeedsPasswordProviderLink(user: User): boolean {
  return Boolean(user.email) && !userHasPasswordProvider(user);
}

export async function ensurePasswordProviderLinked(user: User, password: string): Promise<User> {
  if (!user.email || !password) return user;
  if (userHasPasswordProvider(user)) return user;

  try {
    const linked = await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await linked.user.reload();
    return linked.user;
  } catch (error) {
    const code = getAuthErrorCode(error);
    if (code === "auth/provider-already-linked" || code === "auth/credential-already-in-use") {
      return user;
    }
    throw error;
  }
}

export async function loginWithGoogle(params?: { linkPassword?: string }): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const universalPassword = getUniversalPassword();
  const linkPassword = params?.linkPassword?.trim() || universalPassword;

  try {
    const credential = await signInWithPopup(auth, provider);
    const linked = await ensurePasswordProviderLinked(credential.user, universalPassword);
    await syncUserDisplayName(linked);
    return linked;
  } catch (error) {
    const code = getAuthErrorCode(error);
    if (code !== "auth/account-exists-with-different-credential") {
      throw error;
    }

    const email = getAuthErrorEmail(error);
    const pendingGoogleCredential = GoogleAuthProvider.credentialFromError(error as AuthError);
    if (!email || !pendingGoogleCredential) {
      throw error;
    }

    if (!params?.linkPassword?.trim()) {
      try {
        const linked = await linkGoogleCredentialToEmailPasswordUser(email, universalPassword, pendingGoogleCredential);
        await syncUserDisplayName(linked);
        return linked;
      } catch {
        throw new GoogleAccountLinkRequiredError(email);
      }
    }

    const linked = await linkGoogleCredentialToEmailPasswordUser(email, linkPassword, pendingGoogleCredential);
    const withPassword = await ensurePasswordProviderLinked(linked, universalPassword);
    await syncUserDisplayName(withPassword);
    return withPassword;
  }
}

export async function logoutCurrentUser(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

/** Сжатое data URL для `photoURL` (Firebase ограничивает длину строки). */
export async function updateCurrentUserProfilePhoto(file: File): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const dataUrl = await resizeImageFileToJpegDataUrl(file, 320, 0.86);
  await updateProfile(user, { photoURL: dataUrl });
}

function resizeImageFileToJpegDataUrl(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (!w || !h) {
        reject(new Error("Invalid image"));
        return;
      }
      const scale = Math.min(1, maxEdge / Math.max(w, h));
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("toDataURL failed"));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to read image"));
    };
    img.src = url;
  });
}

export function mapFirebaseAuthError(error: unknown): string {
  const code = getAuthErrorCode(error);
  switch (code) {
    case "auth/email-already-in-use":
      return "Пользователь с таким e-mail уже существует.";
    case "auth/invalid-email":
      return "Введите корректный e-mail.";
    case "auth/weak-password":
      return "Слишком слабый пароль. Минимум 6 символов.";
    case "auth/email-use-google-first":
      return `Для этого e-mail сначала войдите через Google один раз, затем используйте пароль ${getUniversalPassword()}.`;
    case "auth/account-exists-with-different-credential":
      return "Аккаунт с этим e-mail уже существует. Введите пароль от e-mail, чтобы связать Google.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный e-mail или пароль.";
    case "auth/popup-closed-by-user":
      return "";
    case "auth/popup-blocked":
      return "Браузер заблокировал всплывающее окно Google.";
    case "auth/network-request-failed":
      return "Ошибка сети. Проверьте подключение к интернету.";
    case "auth/too-many-requests":
      return "Слишком много попыток. Подождите немного и попробуйте снова.";
    case "auth/missing-email":
      return "Введите e-mail.";
    case "auth/credential-already-in-use":
      return "Этот Google-аккаунт уже привязан к другому пользователю.";
    default:
      return "Не удалось выполнить авторизацию. Попробуйте снова.";
  }
}
