import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import {
  useUpdateEmployeeOrder,
  EMPLOYEES_QUERY_KEY,
} from "../hooks/useUpdateEmployeeOrder";
import * as employeeApi from "../services/employeeApi";
import type { Employee } from "../types/employee";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../services/employeeApi", () => ({
  updateEmployeeOrder: vi.fn(),
  fetchEmployees: vi.fn(),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Alice",
    role: "Eng",
    walletAddress: "ADDR1111",
    currency: "USDC",
    salary: 5000,
    orderIndex: 0,
  },
  {
    id: "2",
    name: "Bob",
    role: "Des",
    walletAddress: "ADDR2222",
    currency: "USDC",
    salary: 4500,
    orderIndex: 1,
  },
  {
    id: "3",
    name: "Carol",
    role: "PM",
    walletAddress: "ADDR3333",
    currency: "XLM",
    salary: 6000,
    orderIndex: 2,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(EMPLOYEES_QUERY_KEY, [...EMPLOYEES]);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, Wrapper };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("useUpdateEmployeeOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("optimistically reorders the cache in onMutate before the API resolves", async () => {
    // Never resolves — lets us inspect cache while mutationFn is in-flight
    vi.mocked(employeeApi.updateEmployeeOrder).mockReturnValue(
      new Promise(() => {}),
    );

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "3" });
    });

    // onMutate is async but settles on the microtask queue
    await waitFor(() => {
      const cached = queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY)!;
      // Alice (id=1) should now be at index 2, Carol (id=3) at index 0
      expect(cached[0].id).toBe("2");
      expect(cached[1].id).toBe("3");
      expect(cached[2].id).toBe("1");
    });
  });

  it("sends only minimal { id, newIndex } payload — not the full Employee object", async () => {
    vi.mocked(employeeApi.updateEmployeeOrder).mockResolvedValue(undefined);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const callArg = vi.mocked(employeeApi.updateEmployeeOrder).mock.calls[0][0];

    // Every item must only carry id and newIndex
    callArg.forEach((item, index) => {
      expect(Object.keys(item)).toEqual(["id", "newIndex"]);
      expect(item.newIndex).toBe(index);
    });
  });

  it("rollbacks to the previous cache state when the API returns an error", async () => {
    vi.mocked(employeeApi.updateEmployeeOrder).mockRejectedValue(
      new Error("Network failure"),
    );

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "3" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY)!;
    expect(cached.map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("exposes the API error message after a failed mutation", async () => {
    vi.mocked(employeeApi.updateEmployeeOrder).mockRejectedValue(
      new Error("Server unavailable"),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "2" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Server unavailable");
  });

  it("invalidates the employees query on settled (success path)", async () => {
    vi.mocked(employeeApi.updateEmployeeOrder).mockResolvedValue(undefined);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: EMPLOYEES_QUERY_KEY,
    });
  });

  it("invalidates the employees query on settled (error path)", async () => {
    vi.mocked(employeeApi.updateEmployeeOrder).mockRejectedValue(
      new Error("fail"),
    );

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEmployeeOrder(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ activeId: "1", overId: "2" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: EMPLOYEES_QUERY_KEY,
    });
  });
});
