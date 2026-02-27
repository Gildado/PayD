import { useMutation, useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";

import { updateEmployeeOrder } from "../services/employeeApi";
import type { Employee, EmployeeOrderPayload } from "../types/employee";

export const EMPLOYEES_QUERY_KEY = ["employees"] as const;

export interface ReorderArgs {
  activeId: string;
  overId: string;
}

interface MutationContext {
  previous: Employee[];
}

export function useUpdateEmployeeOrder() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ReorderArgs, MutationContext>({
    /**
     * By the time mutationFn fires, onMutate has already applied the
     * optimistic reorder to the cache — so we read the new order from
     * the cache and build the minimal payload the API actually needs.
     */
    mutationFn: async () => {
      const reordered =
        queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY) ?? [];

      const payload: EmployeeOrderPayload[] = reordered.map((emp, i) => ({
        id: emp.id,
        newIndex: i,
      }));

      return updateEmployeeOrder(payload);
    },

    onMutate: async ({ activeId, overId }) => {
      // Stop any in-flight refetch from overwriting our optimistic update.
      await queryClient.cancelQueries({ queryKey: EMPLOYEES_QUERY_KEY });

      const previous =
        queryClient.getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY) ?? [];

      const activeIndex = previous.findIndex((e) => e.id === activeId);
      const overIndex = previous.findIndex((e) => e.id === overId);

      if (activeIndex !== -1 && overIndex !== -1) {
        queryClient.setQueryData<Employee[]>(
          EMPLOYEES_QUERY_KEY,
          arrayMove(previous, activeIndex, overIndex),
        );
      }

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Employee[]>(
          EMPLOYEES_QUERY_KEY,
          context.previous,
        );
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
    },
  });
}
