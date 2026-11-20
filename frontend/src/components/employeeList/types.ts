export interface Employee {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  position: string;
  wallet?: string;
  salary?: number;
  status?: 'Active' | 'Inactive';
}

export type StatusFilter = 'All' | 'Active' | 'Inactive';

export interface EmployeeListProps {
  employees: Employee[];
  isLoading?: boolean;
  onEmployeeClick?: (employee: Employee) => void;
  onAddEmployee: (employee: Employee) => void;
  onEditEmployee?: (employee: Employee) => void;
  onRemoveEmployee?: (id: string) => void;
  onUpdateEmployeeImage?: (id: string, imageUrl: string) => void;
}
