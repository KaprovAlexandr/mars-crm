import { resolveEmployeeDisplayFullName } from "@/lib/auth/employeeRole";
import type { EmployeeRole } from "@/lib/auth/employeeRole";
import { setEmployeeRoleOverride, type StoredEmployeeRole } from "@/lib/auth/employeeRoleOverrides";
import type { PendingEmployee } from "@/lib/settings/pendingEmployeesPersistence";
import { replacePendingEmployees } from "@/lib/settings/pendingEmployeesPersistence";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8787";

type PendingEmployeesResponse = {
  employees?: Array<{
    id?: unknown;
    email?: unknown;
    fullName?: unknown;
    registeredAt?: unknown;
  }>;
};

type RoleOverrideResponse = {
  role?: unknown;
};

type RoleOverridesMapResponse = {
  overrides?: Record<string, unknown>;
};

function parsePendingEmployees(data: PendingEmployeesResponse): PendingEmployee[] {
  if (!Array.isArray(data.employees)) return [];
  return data.employees
    .map((item) => {
      const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : "";
      const fullName = typeof item.fullName === "string" ? item.fullName.trim() : "";
      const registeredAt = typeof item.registeredAt === "string" ? item.registeredAt : "";
      const id =
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : email
            ? `pending-${email.replace(/[^a-z0-9]+/gi, "-")}`
            : "";
      if (!email || !fullName || !id) return null;
      return {
        id,
        email,
        fullName: resolveEmployeeDisplayFullName(email, fullName, id),
        registeredAt: registeredAt || "—",
      };
    })
    .filter((item): item is PendingEmployee => item !== null);
}

export async function fetchPendingEmployeesFromApi(idToken: string): Promise<PendingEmployee[]> {
  const response = await fetch(`${API_BASE_URL}/api/employees/pending`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as PendingEmployeesResponse;
  const rows = parsePendingEmployees(data);
  replacePendingEmployees(rows);
  return rows;
}

export async function syncPendingAccessToApi(params: {
  idToken: string;
  fullName?: string;
}): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/auth/sync-pending-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: params.idToken,
        fullName: params.fullName?.trim() ?? "",
      }),
    });
  } catch {
    // API optional
  }
}

export async function persistEmployeeRoleOverrideToApi(params: {
  idToken: string;
  email: string;
  role: StoredEmployeeRole;
}): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/employees/role-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: params.idToken,
      email: params.email.trim().toLowerCase(),
      role: params.role,
    }),
  });
  return response.ok;
}

export async function hydrateEmployeeRoleOverridesFromApi(idToken: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/employees/role-overrides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return;
  const data = (await response.json()) as RoleOverridesMapResponse;
  const overrides = data.overrides;
  if (!overrides || typeof overrides !== "object") return;
  for (const [email, role] of Object.entries(overrides)) {
    if (role === "head" || role === "administrator" || role === "manager" || role === "master") {
      setEmployeeRoleOverride(email, role);
    }
  }
}

export async function fetchMyRoleOverrideFromApi(idToken: string): Promise<EmployeeRole | null> {
  const response = await fetch(`${API_BASE_URL}/api/employees/my-role-override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as RoleOverrideResponse;
  const role = data.role;
  if (role === "head" || role === "administrator" || role === "manager" || role === "master") {
    return role;
  }
  return null;
}
