import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SortableRow } from "../components/SortableRow";
import type { Employee } from "../types/employee";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: vi.fn(() => ({
    attributes: { role: "button" },
    listeners: { onKeyDown: vi.fn() },
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

// CSS modules resolve to plain objects in jsdom — no extra mock needed.

// Fixtures

const EMPLOYEE: Employee = {
  id: "emp-1",
  name: "Alice Nguyen",
  role: "Engineer",
  walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGPWQTESTADDR",
  currency: "USDC",
  salary: 5000,
  orderIndex: 0,
};

function renderRow(employee: Employee = EMPLOYEE) {
  // SortableRow renders a <tr> which requires a table context to be valid HTML.
  return render(
    <table>
      <tbody>
        <SortableRow employee={employee} />
      </tbody>
    </table>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("SortableRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the employee name, role, currency and salary", () => {
    renderRow();

    expect(screen.getByText("Alice Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });

  it("truncates the wallet address and preserves full address in title", () => {
    renderRow();

    const walletSpan = screen.getByTitle(EMPLOYEE.walletAddress);
    expect(walletSpan).toBeInTheDocument();

    // First 6 chars + ellipsis + last 4 chars
    const expected = `${EMPLOYEE.walletAddress.slice(0, 6)}…${EMPLOYEE.walletAddress.slice(-4)}`;
    expect(walletSpan.textContent).toBe(expected);
  });

  it("renders a drag handle button with the correct aria-label", () => {
    renderRow();

    const handle = screen.getByRole("button", { name: "Reorder employee" });
    expect(handle).toBeInTheDocument();
  });

  it("drag handle has tabIndex={0} for keyboard accessibility", () => {
    renderRow();

    const handle = screen.getByRole("button", { name: "Reorder employee" });
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("grip SVG icon has aria-hidden so screen readers skip it", () => {
    renderRow();

    const svg = screen
      .getByRole("button", { name: "Reorder employee" })
      .querySelector("svg");

    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("applies the dragging class when isDragging is true", async () => {
    const { useSortable } = await import("@dnd-kit/sortable");
    vi.mocked(useSortable).mockReturnValueOnce({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      setActivatorNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: true,
      // cast because real return type has many more fields we don't need
    } as unknown as ReturnType<typeof useSortable>);

    const { container } = renderRow();
    const row = container.querySelector("tr");

    // The CSS module class name in jsdom tests resolves to the key string.
    expect(row?.className).toContain("dragging");
  });

  it("does not apply a className when isDragging is false", () => {
    const { container } = renderRow();
    const row = container.querySelector("tr");
    expect(row?.className).toBeFalsy();
  });
});
