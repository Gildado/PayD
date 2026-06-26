import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";

import { SortableRow } from "../components/SortableRow";
import { fetchEmployees } from "../services/employeeApi";
import {
  EMPLOYEES_QUERY_KEY,
  useUpdateEmployeeOrder,
} from "../hooks/useUpdateEmployeeOrder";
import styles from "./EmployeeTable.module.css";

export default function EmployeeTable() {
  const {
    data: employees,
    isLoading,
    isError,
  } = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployees,
    // Keep the stale snapshot in place while an optimistic update is live
    staleTime: 30_000,
  });

  const { mutate: reorder, error: mutationError } = useUpdateEmployeeOrder();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    reorder({
      activeId: String(active.id),
      overId: String(over.id),
    });
  }

  if (isLoading) {
    return <div className={styles.skeleton}>Loading employees…</div>;
  }

  if (isError || !employees) {
    return (
      <div className={styles.error}>
        Failed to load employees. Please try again.
      </div>
    );
  }

  const employeeIds = employees.map((e) => e.id);

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Employees</h1>

      {mutationError && (
        <p className={styles.mutationError} role="alert">
          Failed to save order: {mutationError.message}. The previous order has
          been restored.
        </p>
      )}

      <div className={styles.tableContainer}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th aria-label="Drag handle" />
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Wallet</th>
                <th scope="col">Currency</th>
                <th scope="col">Salary</th>
              </tr>
            </thead>
            <tbody>
              <SortableContext
                items={employeeIds}
                strategy={verticalListSortingStrategy}
              >
                {employees.map((employee) => (
                  <SortableRow key={employee.id} employee={employee} />
                ))}
              </SortableContext>
            </tbody>
          </table>
        </DndContext>
      </div>
    </div>
  );
}
