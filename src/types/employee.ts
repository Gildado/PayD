export interface Employee {
  id: string;
  name: string;
  role: string;
  walletAddress: string;
  currency: string;
  salary: number;
  orderIndex: number;
}

// Payload that the backend needs to reorder rows.
export interface EmployeeOrderPayload {
  id: string;
  newIndex: number;
}
