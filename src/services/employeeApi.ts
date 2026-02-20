import type { Employee, EmployeeOrderPayload } from "../types/employee";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

async function handleResponse(res: Response): Promise<void> {
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `HTTP ${res.status}`);
  }
}

export async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${BASE_URL}/employees`);
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Employee[]>;
}

export async function updateEmployeeOrder(
  updates: EmployeeOrderPayload[],
): Promise<void> {
  const res = await fetch(`${BASE_URL}/employees/order`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  await handleResponse(res);
}
