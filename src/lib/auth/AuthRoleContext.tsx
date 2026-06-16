import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { userNeedsPasswordProviderLink, watchAuthState } from "@/lib/auth/firebaseAuth";
import { ensureFirebasePasswordAccess } from "@/lib/auth/ensureFirebasePasswordAccess";
import { isEmployeeBlocked } from "@/lib/auth/employeeBlockPersistence";
import { resolveUserFullName, syncUserDisplayName } from "@/lib/auth/userFullName";
import { syncPendingEmployeeFromAuth } from "@/lib/settings/pendingEmployeesPersistence";
import { syncPendingAccessToApi, fetchMyRoleOverrideFromApi } from "@/lib/settings/pendingEmployeesApi";
import { setEmployeeRoleOverride } from "@/lib/auth/employeeRoleOverrides";
import {
  getBlockedNavAccess,
  getNavAccess,
  resolveEmployeeRoleFromEmail,
  type EmployeeRole,
  type NavAccess,
} from "@/lib/auth/employeeRole";

type AuthRoleContextValue = {
  firebaseUser: User | null;
  email: string | null;
  fullName: string;
  role: EmployeeRole;
  access: NavAccess;
  blocked: boolean;
  /** Первый колбэк onAuthStateChanged уже отработал */
  authReady: boolean;
};

const AuthRoleContext = createContext<AuthRoleContextValue | null>(null);

export function AuthRoleProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("Пользователь");
  const [authReady, setAuthReady] = useState(false);
  const [roleOverrideVersion, setRoleOverrideVersion] = useState(0);

  useEffect(() => {
    return watchAuthState((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setFullName("Пользователь");
        return;
      }

      setFullName(resolveUserFullName(user, user.email));

      void (async () => {
        const syncedName = await syncUserDisplayName(user);
        setFullName(syncedName);
        syncPendingEmployeeFromAuth(user.email, syncedName);
        try {
          const idToken = await user.getIdToken();
          await syncPendingAccessToApi({ idToken, fullName: syncedName });
          const overrideRole = await fetchMyRoleOverrideFromApi(idToken);
          if (overrideRole) {
            setEmployeeRoleOverride(user.email, overrideRole);
            setRoleOverrideVersion((v) => v + 1);
          }
        } catch {
          // API optional
        }
      })();

      if (userNeedsPasswordProviderLink(user)) {
        void ensureFirebasePasswordAccess(user).catch(() => {
          // Не блокируем сессию, если привязка пароля не удалась.
        });
      }
    });
  }, []);

  const email = firebaseUser?.email ?? null;
  const role = useMemo(() => resolveEmployeeRoleFromEmail(email), [email, roleOverrideVersion]);
  const blocked = useMemo(() => isEmployeeBlocked(email), [email]);
  const access = useMemo(() => (blocked ? getBlockedNavAccess() : getNavAccess(role, email)), [blocked, role, email]);

  const value = useMemo(
    () => ({ firebaseUser, email, fullName, role, access, blocked, authReady }),
    [firebaseUser, email, fullName, role, access, blocked, authReady],
  );

  return <AuthRoleContext.Provider value={value}>{children}</AuthRoleContext.Provider>;
}

export function useEmployeeRole(): AuthRoleContextValue {
  const ctx = useContext(AuthRoleContext);
  if (!ctx) {
    throw new Error("useEmployeeRole must be used within AuthRoleProvider");
  }
  return ctx;
}
