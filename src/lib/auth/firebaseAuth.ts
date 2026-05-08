import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

let appInstance: FirebaseApp | null = null;
let configured = true;

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
  const credential = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  if (params.name.trim()) {
    await updateProfile(credential.user, { displayName: params.name.trim() });
  }
  return credential.user;
}

export async function loginWithEmailPassword(params: { email: string; password: string }): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, params.email.trim(), params.password);
  return credential.user;
}

export async function loginWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logoutCurrentUser(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export function mapFirebaseAuthError(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code ?? "") : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Пользователь с таким e-mail уже существует.";
    case "auth/invalid-email":
      return "Введите корректный e-mail.";
    case "auth/weak-password":
      return "Слишком слабый пароль. Минимум 6 символов.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверный e-mail или пароль.";
    case "auth/popup-closed-by-user":
      return "Вход через Google отменен.";
    case "auth/popup-blocked":
      return "Браузер заблокировал всплывающее окно Google.";
    case "auth/network-request-failed":
      return "Ошибка сети. Проверьте подключение к интернету.";
    default:
      return "Не удалось выполнить авторизацию. Попробуйте снова.";
  }
}
