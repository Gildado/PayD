import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";

import EmployeeTable from "../pages/EmployeeTable";
import * as employeeApi from "../services/employeeApi";
import type { Employee } from "../types/employee";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Isolate from the real dnd-kit browser APIs
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn((arr: unknown[]) => arr),
}));

// Thin stand-in so we can assert row rendering without mounting useSortable
vi.mock("../components/SortableRow", () => ({
  SortableRow: ({ employee }: { employee: Employee }) => (
    <tr data-testid="employee-row">
      <td>{employee.name}</td>
      <td>{employee.role}</td>
    </tr>
  ),
}));

vi.mock("../services/employeeApi", () => ({
  fetchEmployees: vi.fn(),
  updateEmployeeOrder: vi.fn(),
}));

// Allow per-test control of mutationError
const mockReorder = vi.fn();
let mockMutationError: Error | null = null;

vi.mock("../hooks/useUpdateEmployeeOrder", () => ({
  useUpdateEmployeeOrder: () => ({
    mutate: mockReorder,
    error: mockMutationError,
  }),
  EMPLOYEES_QUERY_KEY: ["employees"],
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "Alice",
    role: "Engineer",
    walletAddress: "ADDR1",
    currency: "USDC",
    salary: 5000,
    orderIndex: 0,
  },
  {
    id: "2",
    name: "Bob",
    role: "Designer",
    walletAddress: "ADDR2",
    currency: "USDC",
    salary: 4500,
    orderIndex: 1,
  },
];

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderTable(queryClient = createClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <EmployeeTable />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("EmployeeTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationError = null;
  });

  it("shows a loading indicator while data is in-flight", () => {
    vi.mocked(employeeApi.fetchEmployees).mockReturnValue(
      new Promise(() => {}),
    );

    renderTable();

    expect(screen.getByText(/loading employees/i)).toBeInTheDocument();
  });

  it("shows an error message when fetchEmployees rejects", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockRejectedValue(new Error("500"));

    renderTable();

    await waitFor(() => {
      expect(screen.getByText(/failed to load employees/i)).toBeInTheDocument();
    });
  });

  it("renders the table headings and a row for each employee", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(EMPLOYEES);

    renderTable();

    await waitFor(() => {
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.getByText("Currency")).toBeInTheDocument();
    expect(screen.getByText("Salary")).toBeInTheDocument();

    const rows = screen.getAllByTestId("employee-row");
    expect(rows).toHaveLength(EMPLOYEES.length);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows a mutation error alert when the reorder API call fails", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(EMPLOYEES);
    mockMutationError = new Error("Reorder failed");

    renderTable();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/reorder failed/i);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /previous order has been restored/i,
    );
  });

  it("does not show the alert banner when there is no mutation error", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(EMPLOYEES);
    mockMutationError = null;

    renderTable();

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("renders a table element with thead and tbody", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(EMPLOYEES);

    const { container } = renderTable();

    await waitFor(() => {
      expect(container.querySelector("table")).toBeInTheDocument();
    });

    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toBeInTheDocument();
  });
});
