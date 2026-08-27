/**
 * Frontend API client for Advanced Reports & Monthly Payroll Digest Agent
 */

export interface MonthlyPayrollDigestParams {
  organizationId: number | string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchMonthlyPayrollDigest(params: MonthlyPayrollDigestParams) {
  const query = new URLSearchParams();
  query.append('organizationId', String(params.organizationId));
  if (params.month) query.append('month', params.month);
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);

  const response = await fetch(`/api/v1/reports/payroll/monthly-digest?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch monthly payroll digest: ${response.statusText}`);
  }
  return response.json();
}
