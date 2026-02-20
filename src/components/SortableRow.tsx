import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Employee } from "../types/employee";
import styles from "./SortableRow.module.css";

interface Props {
  employee: Employee;
}

function GripVertical() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

export function SortableRow({ employee }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });

  const rowStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={rowStyle}
      className={isDragging ? styles.dragging : undefined}
    >
      {/* Drag handle — only this element activates the drag sensor */}
      <td className={styles.handleCell}>
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className={styles.dragHandle}
          aria-label="Reorder employee"
          tabIndex={0}
          type="button"
        >
          <GripVertical />
        </button>
      </td>

      <td>{employee.name}</td>
      <td>{employee.role}</td>
      <td>
        <span title={employee.walletAddress}>
          {employee.walletAddress.slice(0, 6)}…
          {employee.walletAddress.slice(-4)}
        </span>
      </td>
      <td>{employee.currency}</td>
      <td>{employee.salary.toLocaleString()}</td>
    </tr>
  );
}
